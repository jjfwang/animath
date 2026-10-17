/* Content-addressed syllabus-keyed immutable approved lesson assets.
 * Production host injects durable object storage + atomic metadata CAS.
 * This module never runs an LLM or trusts unapproved content.
 */
(function (global,factory){
  var api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else global.TeachkitAssetStore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function obj(x){return x!==null && typeof x==='object'&&!Array.isArray(x);}
  function segment(s){return typeof s==='string' && /^[a-z0-9][a-z0-9._-]{0,100}$/.test(s)&&s!=='.'&&s!=='..';}
  var fields=['curriculum','curriculumRevision','level','track','subject','topic','locale','objectivesHash'];
  function context(ctx){
    if(!obj(ctx)||fields.some(function(k){return !segment(ctx[k]);}))
      throw new Error('invalid curriculum or syllabus asset path');
    if(Object.keys(ctx).some(function(k){return fields.indexOf(k)<0 && ['difficulty','promptVersion','engineVersion'].indexOf(k)<0;}))
      throw new Error('unsupported shared-asset context field');
    if(typeof ctx.promptVersion!=='string'||!segment(ctx.promptVersion)||
      typeof ctx.engineVersion!=='string'||!segment(ctx.engineVersion)||
      typeof ctx.difficulty!=='string'||!segment(ctx.difficulty))
      throw new Error('invalid asset generation version or difficulty');
    return ctx;
  }
  function prefix(ctx){
    context(ctx);
    return 'teaching/'+fields.map(function(k){return ctx[k];}).join('/')+'/'+ctx.difficulty;
  }
  function canonical(x,depth){
    if(depth===undefined)depth=0;
    if(depth>40)throw new Error('asset nesting exceeds limit');
    if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
    if(typeof x==='number'){
      if(!Number.isFinite(x))throw new Error('non-finite JSON asset value');
      return JSON.stringify(x);
    }
    if(Array.isArray(x))return '['+x.map(function(v){return canonical(v,depth+1);}).join(',')+']';
    if(obj(x)){
      return '{'+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+':'+canonical(x[k],depth+1);}).join(',')+'}';
    }
    throw new Error('unsupported asset value');
  }
  async function sha256(text) {
    if(typeof text!=='string')throw new Error('hash input must be a string');
    var web=typeof globalThis!=='undefined'&&globalThis.crypto&&globalThis.crypto.subtle;
    if(!web && typeof require==='function')web=require('node:crypto').webcrypto.subtle;
    if(!web)throw new Error('WebCrypto SHA-256 required');
    var bytes=new TextEncoder().encode(text);
    var buf=await web.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  function storeContract(store){
    if(!store||typeof store.get!=='function'||typeof store.put!=='function'||
      typeof store.compareAndSwap!=='function')throw new Error('durable object+atomic CAS adapter required');
    return store;
  }
  function approval(verdict) {
    if(!verdict||verdict.approved!==true||verdict.status!=='approved'||
      !verdict.automatic||verdict.automatic.passed!==true)
      throw new Error('unapproved asset cannot be published');
    var who=verdict.human || verdict.reviewer;
    if(!who||!['agent','human'].includes(who.type)||who.status!=='approve'||typeof who.reviewerId!=='string'||
      !who.reviewerId.trim()||!Number.isFinite(who.confidence)||who.confidence<0.85||
      !who.checks||['scientific','curriculum','pedagogy','accessibility'].some(function(k){return who.checks[k]!=='pass';})||
      !Array.isArray(who.findings)||who.findings.length)
      throw new Error('invalid approval evidence');
    return {type:who.type,reviewerId:who.reviewerId,checks:Object.assign({},who.checks),
      confidence:who.confidence};
  }
  function assetList(assets){
    if(!obj(assets)||Object.keys(assets).length===0||Object.keys(assets).length>20)
      throw new Error('missing or oversized asset collection');
    var names=Object.keys(assets).sort();
    names.forEach(function(name){
      if(!segment(name)|| !/^[a-z0-9-]+\.(?:json|svg|txt|md)$/.test(name))
        throw new Error('asset filename not allowed: '+name);
      if(typeof assets[name]!=='string' || !assets[name].length || assets[name].length>2000000)
        throw new Error('assets must be nonempty bounded UTF-8 text');
    });
    if(!Object.prototype.hasOwnProperty.call(assets,'interactive.json') &&
       !Object.prototype.hasOwnProperty.call(assets,'animation.json'))
      throw new Error('lesson requires an interactive or animation visual');
    return names;
  }
  async function publish(store,ctx,assets,verdict){
    storeContract(store);var base=prefix(ctx),approvedBy=approval(verdict),names=assetList(assets);
    // Hash entire pack AND generation context; objective/difficulty changes produce
    // different immutable revisions. Avoid storing private student overlays.
    var canonicalPack=canonical({ctx:ctx,assets:assets}),revision=(await sha256(canonicalPack)).slice(0,32);
    var root=base+'/'+revision,entries=[];
    for(var i=0;i<names.length;i++){
      var name=names[i],data=assets[name],hash=await sha256(data);
      var key=root+'/'+name;
      var existing=await store.get(key);
      if(existing!==null&&existing!==undefined&&existing!==data)throw new Error('immutable object collision');
      if(existing===null||existing===undefined)await store.put(key,data);
      entries.push({name:name,key:key,sha256:hash,length:data.length});
    }
    var manifest={schema:'teachkit-approved-v1',approvalStatus:'approved',
      assetRevision:revision,curriculum:fields.reduce(function(o,k){o[k]=ctx[k];return o;},{}),
      promptVersion:ctx.promptVersion,engineVersion:ctx.engineVersion,
      difficulty:ctx.difficulty,approvedBy:approvedBy,files:entries};
    var manifestKey=root+'/manifest.json',manifestData=canonical(manifest);
    var previous=await store.get(manifestKey);
    if(previous!==null&&previous!==undefined&&previous!==manifestData)
      throw new Error('immutable manifest collision');
    if(previous===null||previous===undefined)await store.put(manifestKey,manifestData);
    var pointerKey=base+'/current.json';
    var current=await store.get(pointerKey);
    var next=canonical({manifestKey:manifestKey,assetRevision:revision});
    if(current!==next){
      var won=await store.compareAndSwap(pointerKey,current,next);
      if(won!==true)throw new Error('concurrent approved revision publication: retry with newest pointer');
    }
    return {manifestKey:manifestKey,assetRevision:revision,pointerKey:pointerKey};
  }
  async function read(store,ctx,revision){
    storeContract(store);var base=prefix(ctx),pointer;
    if(revision===undefined||revision===null){
      pointer=await store.get(base+'/current.json');
      if(!pointer)throw new Error('no approved asset revision found');
      try{pointer=JSON.parse(pointer);}catch(_){throw new Error('invalid revision pointer');}
      if(!pointer||typeof pointer.manifestKey!=='string'||
        pointer.manifestKey.indexOf(base+'/')!==0)throw new Error('invalid revision pointer');
    }else{
      if(!/^[0-9a-f]{32}$/.test(revision))throw new Error('invalid revision');
      pointer={manifestKey:base+'/'+revision+'/manifest.json',assetRevision:revision};
    }
    var raw=await store.get(pointer.manifestKey);
    if(!raw)throw new Error('approved manifest missing');
    var manifest;
    try{manifest=JSON.parse(raw);}catch(_){throw new Error('malformed approved manifest');}
    if(!manifest||manifest.schema!=='teachkit-approved-v1'||
      manifest.approvalStatus!=='approved'||!Array.isArray(manifest.files)||
      !/^[0-9a-f]{32}$/.test(manifest.assetRevision)||
      pointer.manifestKey!==base+'/'+manifest.assetRevision+'/manifest.json')
      throw new Error('unapproved or invalid manifest');
    var result={};
    for(var i=0;i<manifest.files.length;i++){
      var item=manifest.files[i];
      if(!segment(item.name)||item.key!==base+'/'+manifest.assetRevision+'/'+item.name||
        !/^[0-9a-f]{64}$/.test(item.sha256)||
        Object.prototype.hasOwnProperty.call(result,item.name))
        throw new Error('manifest entry invalid');
      var body=await store.get(item.key);
      if(typeof body!=='string'||await sha256(body)!==item.sha256)
        throw new Error('asset hash mismatch or missing content');
      result[item.name]=body;
    }
    var digest=(await sha256(canonical({ctx:ctx,assets:result}))).slice(0,32);
    if(digest!==manifest.assetRevision)throw new Error('pack revision hash mismatch');
    return {manifest:manifest,assets:result};
  }
  async function rollback(store,ctx,revision){
    storeContract(store);
    var previous=await read(store,ctx,revision);
    if(previous.manifest.approvalStatus!=='approved')throw new Error('not an approved revision');
    var base=prefix(ctx),pointerKey=base+'/current.json',original=await store.get(pointerKey);
    var next=canonical({manifestKey:base+'/'+revision+'/manifest.json',assetRevision:revision});
    if(!(await store.compareAndSwap(pointerKey,original,next)))throw new Error('rollback pointer conflict');
    return {pointerKey:pointerKey,assetRevision:revision};
  }
  function createMemoryStore(){
    var map=new Map();
    return {get:async function(k){return map.has(k)?map.get(k):null;},
      put:async function(k,v){map.set(k,v);},
      compareAndSwap:async function(k,expected,next){
        var now=map.has(k)?map.get(k):null;
        if(now!==expected)return false;
        map.set(k,next);return true;}};
  }
  return {version:'0.1',prefix:prefix,canonical:canonical,sha256:sha256,
    publish:publish,read:read,rollback:rollback,createMemoryStore:createMemoryStore};
});
