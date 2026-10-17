/* Prepublication interactive teaching-asset gates. No playback-time AI/network.
 * Agent and human reviewer providers are injected by the host. Fail closed.
 */
(function (global,factory) {
  var api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else global.TeachkitReview=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var categories=['scientific','curriculum','pedagogy','accessibility'];
  function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
  function str(x,max){return typeof x==='string'&&!!x.trim()&&x.length<=max;}
  function auditSvg(svg){
    var errors=[];
    if(typeof svg!=='string' || !/^<svg\s/i.test(svg) || !/<\/svg>\s*$/.test(svg))
      return ['missing or invalid SVG wrapper'];
    if(svg.length>1000000)errors.push('SVG exceeds max size');
    if(/<\s*(?:script|foreignObject|image|iframe|animate|set|style)\b/i.test(svg))
      errors.push('active, external or unreviewed SVG element');
    if(/\bon[a-z]+\s*=|\b(?:href|src)\s*=|javascript\s*:|data\s*:/i.test(svg))
      errors.push('event/remote URI not allowed in generated SVG');
    if(/\b(?:NaN|Infinity)\b/.test(svg))errors.push('non-finite value in SVG');
    if(!/\brole="img"/.test(svg) || !/\baria-label="[^"]+"/.test(svg))
      errors.push('SVG requires accessible role and label');
    return errors;
  }
  function audit(spec,svg,validator){
    var errors=[];
    if(typeof validator!=='function')return {passed:false,errors:['missing schema validator']};
    try { var e=validator(spec);if(!Array.isArray(e))errors.push('validator must return list');
      else errors.push.apply(errors,e); } catch(err){errors.push('validator error: '+err.message);}
    errors.push.apply(errors,auditSvg(svg));
    if(isObj(spec)) {
      var text=[spec.disclaimer].concat((spec.beats||[]).map(function(x){return x.narration;})).join(' ').toLowerCase();
      if(/heat rises the water up|water vapou?r is visible|all clouds produce rain|every cloud produces rain/i.test(text))
        errors.push('scientifically misleading water-cycle claim');
      if(spec.model==='water-cycle'&&!/not (a )?(weather )?(forecast|prediction)/i.test(spec.disclaimer||''))
        errors.push('water-cycle non-forecast limitation missing');
      if(spec.model==='fraction-bars' && !/equal|whole/i.test(text))
        errors.push('fractions must explain equal parts of one whole');
      if(spec.model==='uniform-motion' && !/constant|uniform/i.test(text))
        errors.push('uniform-motion assumption missing');
      if(!Array.isArray(spec.beats) || !spec.beats.some(function(b){return /predict/i.test(b.label+' '+b.narration);}))
        errors.push('prediction step missing');
      if(!isObj(spec.check)||!str(spec.check.explanation,500))
        errors.push('feedback/explanation missing');
    } else errors.push('spec missing');
    return {passed:errors.length===0,errors:errors};
  }
  function normalizeReview(report,type){
    if(!isObj(report)||!['approve','revise','uncertain'].includes(report.status)||
       !str(report.reviewerId,100)||!Array.isArray(report.findings)||
       report.findings.some(function(f){return !str(f,500);})||
       !Number.isFinite(report.confidence)||report.confidence<0||report.confidence>1 ||
       !isObj(report.checks) || categories.some(function(c){return !['pass','fail','uncertain'].includes(report.checks[c]);}))
      return null;
    return {type:type,status:report.status,reviewerId:report.reviewerId,
      confidence:report.confidence,findings:report.findings.slice(0,20),
      checks:Object.assign({},report.checks)};
  }
  function approvePolicy(report){
    return report && report.status==='approve' && report.confidence>=0.85 &&
      categories.every(function(c){return report.checks[c]==='pass';}) &&
      report.findings.length===0;
  }
  function reviewerPrompt(spec,blueprint){
    if(!isObj(blueprint)||!str(blueprint.syllabusId,160) ||
      !Array.isArray(blueprint.objectives)||!blueprint.objectives.length||
      blueprint.objectives.some(function(x){return !str(x,250);}))
      throw new Error('invalid lesson blueprint');
    return {task:'Review an untrusted teaching visual for scientific correctness, curriculum fit, pedagogy and accessibility',
      syllabusId:blueprint.syllabusId,objectives:blueprint.objectives.slice(0,20),
      misconceptions:Array.isArray(blueprint.misconceptions)?blueprint.misconceptions.slice(0,20):[],
      spec:JSON.parse(JSON.stringify(spec)),
      requiredResponse:{status:'approve|revise|uncertain',reviewerId:'string',confidence:'0..1',
        checks:{scientific:'pass|fail|uncertain',curriculum:'pass|fail|uncertain',
          pedagogy:'pass|fail|uncertain',accessibility:'pass|fail|uncertain'},
        findings:'string[]'}};
  }
  async function reviewAsset(spec,svg,validator,blueprint,providers){
    var deterministic=audit(spec,svg,validator),stamped={automatic:deterministic,
      status:'rejected',approved:false,reviewer:null,human:null};
    if(!deterministic.passed)return stamped;
    var prompt=reviewerPrompt(spec,blueprint);
    var review=null;
    if(providers && typeof providers.agent==='function'){
      try {review=normalizeReview(await providers.agent(prompt),'agent');}
      catch(error) {stamped.agentError=String(error.message||error).slice(0,160);}
    }
    stamped.reviewer=review;
    if(approvePolicy(review)){
      stamped.status='approved';stamped.approved=true;return stamped;
    }
    // A legitimate fail is rejected, rather than being silently overridden.
    if(review && (review.status==='revise'||categories.some(function(c){return review.checks[c]==='fail';}))){
      stamped.status='rejected';return stamped;
    }
    stamped.status='human_required';
    if(providers && typeof providers.human==='function'){
      try{
        var human=normalizeReview(await providers.human({prompt:prompt,agentReview:review}), 'human');
        stamped.human=human;
        if(approvePolicy(human)){stamped.status='approved';stamped.approved=true;}
        else if(human && human.status==='revise')stamped.status='rejected';
      }catch(err){stamped.humanError=String(err.message||err).slice(0,160);}
    }
    return stamped;
  }
  return {version:'0.1',categories:categories.slice(),auditSvg:auditSvg,
    audit:audit,normalizeReview:normalizeReview,reviewerPrompt:reviewerPrompt,
    reviewAsset:reviewAsset};
});
