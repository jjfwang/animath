'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const kit=require('../player/simulation-kit.js');
const review=require('../generator/interactive-review.js');
const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations/secondary-water-cycle.json'),'utf8'));
const blueprint={syllabusId:'sg-moe/2026/secondary/science/water-cycle',
  objectives:['Explain evaporation, condensation and precipitation without conflating the processes'],
  misconceptions:['Clouds do not always produce rain.']};
const draw=spec=>kit.svgFor(spec,kit.createSession(spec).getState());
function report(status='approve',confidence=0.98){
  return {status,reviewerId:'science-reviewer-v1',confidence,findings:[],
    checks:{scientific:'pass',curriculum:'pass',pedagogy:'pass',accessibility:'pass'}};
}
test('strict SVG gate rejects scripts and external references',()=>{
  const good=draw(sample);a.deepEqual(review.auditSvg(good),[]);
  a.ok(review.auditSvg('<svg role="img" aria-label="x"><script>alert(1)</script></svg>').length);
  a.ok(review.auditSvg('<svg role="img" aria-label="x"><image href="https://evil"/></svg>').length);
  a.ok(review.auditSvg('<svg><rect/></svg>').length);
  a.ok(review.auditSvg('<svg role="img" aria-label="x"><rect width="NaN"/></svg>').length);
});
test('deterministic pedagogical and scientific gate catches bad claims',()=>{
  a.equal(review.audit(sample,draw(sample),kit.validate).passed,true);
  let s=JSON.parse(JSON.stringify(sample));
  s.beats[0].narration='Water vapour is visible in the air.';
  a.ok(review.audit(s,draw(s),kit.validate).errors.some(x=>x.includes('scientifically')));
  s=JSON.parse(JSON.stringify(sample));
  s.beats=s.beats.map(x=>({...x,label:'Explore',narration:'Observe water.'}));
  a.ok(review.audit(s,draw(s),kit.validate).errors.some(x=>x.includes('prediction')));
  a.equal(review.audit(sample,draw(sample),null).passed,false);
});
test('review prompt preserves syllabus objectives and yields typed schema',()=>{
 const p=review.reviewerPrompt(sample,blueprint);
 a.equal(p.syllabusId,blueprint.syllabusId);
 a.equal(p.objectives.length,1);
 a.equal(p.spec.model,'water-cycle');
 a.throws(()=>review.reviewerPrompt(sample,{objectives:[]}),/invalid lesson blueprint/);
});
test('review policy validates independent model report fields',()=>{
 a.equal(review.normalizeReview(report(),'agent').status,'approve');
 let bad=report();bad.checks.scientific='unknown';
 a.equal(review.normalizeReview(bad,'agent'),null);
 bad=report();bad.confidence=NaN;
 a.equal(review.normalizeReview(bad,'agent'),null);
});
test('automatic approval needs agent evidence and high confidence',async()=>{
 const svg=draw(sample);
 const approved=await review.reviewAsset(sample,svg,kit.validate,blueprint,
   {agent:async()=>report()});
 a.equal(approved.status,'approved');
 a.equal(approved.approved,true);
 a.equal(approved.reviewer.type,'agent');
 const uncertain=await review.reviewAsset(sample,svg,kit.validate,blueprint,
   {agent:async()=>report('uncertain')});
 a.equal(uncertain.status,'human_required');
 const low=await review.reviewAsset(sample,svg,kit.validate,blueprint,
   {agent:async()=>report('approve',0.6)});
 a.equal(low.status,'human_required');
});
test('human escalation requires explicit typed approval',async()=>{
 const svg=draw(sample);
 const out=await review.reviewAsset(sample,svg,kit.validate,blueprint,{
   agent:async()=>report('uncertain'),human:async()=>report('approve')});
 a.equal(out.status,'approved');
 a.equal(out.human.type,'human');
 const missing=await review.reviewAsset(sample,svg,kit.validate,blueprint,{});
 a.equal(missing.status,'human_required');
});
test('deterministic blockers and agent scientific failures prevent publish',async()=>{
 const wrong=JSON.parse(JSON.stringify(sample));
 wrong.beats[0].narration='Heat rises the water up';
 let called=0;
 const r=await review.reviewAsset(wrong,draw(wrong),kit.validate,blueprint,{
    agent:async()=>{called++;return report();}});
 a.equal(r.status,'rejected');a.equal(called,0);
 const failed=report('approve');failed.checks.scientific='fail';
 const rejected=await review.reviewAsset(sample,draw(sample),kit.validate,blueprint,
   {agent:async()=>failed,human:async()=>report()});
 a.equal(rejected.status,'rejected');
});
test('provider exceptions fail to human queue, not automatic approval',async()=>{
 const result=await review.reviewAsset(sample,draw(sample),kit.validate,blueprint,
   {agent:async()=>{throw Error('provider unavailable');}});
 a.equal(result.status,'human_required');
 a.match(result.agentError,/provider unavailable/);
});
