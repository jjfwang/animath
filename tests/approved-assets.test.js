'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const asset=require('../generator/approved-assets.js');
const kit=require('../player/simulation-kit.js');
const review=require('../generator/interactive-review.js');
const water=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations/secondary-water-cycle.json'),'utf8'));
const ctx={curriculum:'sg-moe',curriculumRevision:'2026',level:'secondary',track:'o-level',
  subject:'science',topic:'water-cycle',locale:'en-sg',objectivesHash:'abc123',
  difficulty:'core',promptVersion:'p2',engineVersion:'sim0.2'};
const pack={'interactive.json':JSON.stringify(water),'notes.md':'Water vapour is an invisible gas.'};
const blueprint={syllabusId:'sg-moe/2026/secondary/science/water-cycle',
  objectives:['Describe evaporation, condensation and precipitation.']};
async function goodVerdict(){
 const r=await review.reviewAsset(water,kit.svgFor(water,kit.createSession(water).getState()),
   kit.validate,blueprint,{agent:async()=>({status:'approve',reviewerId:'science-v1',
     confidence:0.98,findings:[],checks:{scientific:'pass',curriculum:'pass',
      pedagogy:'pass',accessibility:'pass'}})});
 a.equal(r.status,'approved');return r;
}
test('canonical JSON ignores key insertion order',()=>{
 a.equal(asset.canonical({b:2,a:{z:3,x:1}}),asset.canonical({a:{x:1,z:3},b:2}));
 a.throws(()=>asset.canonical({x:Infinity}));
});
test('SHA-256 is cryptographic and byte deterministic',async()=>{
 a.equal(await asset.sha256('abc'),
   'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('curriculum keys include syllabus revision, subject and objectives',()=>{
 a.match(asset.prefix(ctx),/^teaching\/sg-moe\/2026\/secondary\/o-level\/science\/water-cycle\/en-sg\/abc123\/core$/);
 a.throws(()=>asset.prefix({...ctx,subject:'../math'}),/invalid curriculum/);
 a.throws(()=>asset.prefix({...ctx,locale:'en/../es'}),/invalid curriculum/);
 a.notEqual(asset.prefix(ctx),asset.prefix({...ctx,curriculum:'uk-gcse'}));
 a.throws(()=>asset.prefix({...ctx,studentId:'private-user-123'}),/unsupported shared-asset context field/);
});
test('publish and read require approval and verify all hashes',async()=>{
 const s=asset.createMemoryStore(),verdict=await goodVerdict();
 const pub=await asset.publish(s,ctx,pack,verdict);
 a.match(pub.assetRevision,/^[a-f0-9]{32}$/);
 const value=await asset.read(s,ctx);
 a.deepEqual(value.assets,pack);
 a.equal(value.manifest.approvalStatus,'approved');
 a.equal(value.manifest.approvedBy.reviewerId,'science-v1');
 a.equal((await asset.publish(s,ctx,pack,verdict)).assetRevision,pub.assetRevision);
 const different=await asset.publish(s,ctx,{...pack,'notes.md':'Different wording'},verdict);
 a.notEqual(different.assetRevision,pub.assetRevision);
 a.equal((await asset.read(s,ctx)).assets['notes.md'],'Different wording');
 await asset.rollback(s,ctx,pub.assetRevision);
 a.equal((await asset.read(s,ctx)).assets['notes.md'],pack['notes.md']);
});
test('unapproved verdict and inconsistent contract cannot publish',async()=>{
 const s=asset.createMemoryStore();
 await a.rejects(asset.publish(s,ctx,pack,{approved:false,status:'human_required'}),/unapproved/);
 await a.rejects(asset.publish(s,ctx,{'script.exe':'no'},await goodVerdict()),/filename|visual/);
 await a.rejects(asset.publish(s,ctx,{'notes.md':'text'},await goodVerdict()),/visual/);
 await a.rejects(asset.publish(s,ctx,{'interactive.json':''},await goodVerdict()),/nonempty/);
});
test('tampering, missing files and wrong objective path cannot be displayed',async()=>{
 const s=asset.createMemoryStore(),v=await goodVerdict();
 const pub=await asset.publish(s,ctx,pack,v);
 await a.rejects(asset.read(s,{...ctx,objectivesHash:'changed'}),/no approved/);
 await s.put(asset.prefix(ctx)+'/'+pub.assetRevision+'/notes.md','tampered');
 await a.rejects(asset.read(s,ctx),/hash mismatch/);
});
test('CAS conflict aborts revision publication without exposing an unapproved pointer',async()=>{
 const s=asset.createMemoryStore(),v=await goodVerdict(),original=s.compareAndSwap;
 s.compareAndSwap=async()=>false;
 await a.rejects(asset.publish(s,ctx,pack,v),/concurrent approved/);
 await a.rejects(asset.read(s,ctx),/no approved/);
 s.compareAndSwap=original;
 await asset.publish(s,ctx,pack,v);
 a.equal((await asset.read(s,ctx)).manifest.files.length,2);
});
test('read detects changed manifest even when file hashes are internally consistent',async()=>{
 const s=asset.createMemoryStore(),v=await goodVerdict();
 const pub=await asset.publish(s,ctx,pack,v);
 const data=JSON.parse(await s.get(pub.manifestKey));
 data.assetRevision='0'.repeat(32);
 await s.put(pub.manifestKey,JSON.stringify(data));
 await a.rejects(asset.read(s,ctx),/invalid manifest|revision/);
});
