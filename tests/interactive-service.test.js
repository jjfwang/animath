'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=require('../generator/interactive-service.js');
const storeApi=require('../generator/approved-assets.js');
const sim=require('../player/simulation-kit.js');
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations/secondary-water-cycle.json'),'utf8'));
const anchors=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations/water-cycle-anchor-map.json'),'utf8'));
const ctx={curriculum:'sg-moe',curriculumRevision:'2026',level:'secondary',track:'o-level',
  subject:'science',topic:'water-cycle',locale:'en-sg',objectivesHash:'water-p1',
  difficulty:'core',promptVersion:'v1',engineVersion:'sim0.2'};
const blueprint={syllabusId:'sg-moe/2026/secondary/science/water-cycle',
  objectives:['Identify the conditions for evaporation, condensation and rainfall.']};
const approved={agent:async()=>({status:'approve',reviewerId:'external-reviewer',
  confidence:0.96,findings:[],checks:{scientific:'pass',curriculum:'pass',pedagogy:'pass',accessibility:'pass'}})};
function fakeElement(){
 const doc={};
 doc.createElement=function(tag){
  return {tagName:tag.toUpperCase(),ownerDocument:doc,children:[],textContent:'',
    attributes:{},listeners:{},appendChild(x){this.children.push(x);},
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(t,fn){this.listeners[t]=fn;},
    innerHTML:'',value:''};
 };
 return doc.createElement('div');
}
test('prepare and publish approved sample with slides, speech anchors and notes',async()=>{
 const store=storeApi.createMemoryStore();
 const answer=await service.prepareAndPublish({spec,store,context:ctx,blueprint,reviewers:approved,
   materials:{'anchors.json':JSON.stringify(anchors),'notes.md':'Invisible water vapour condenses.'}});
 a.equal(answer.status,'published');
 const data=await service.loadApproved({store,context:ctx});
 a.equal(data.spec.model,'water-cycle');
 a.ok(data.materials['preview.svg'].includes('<svg'));
 a.equal(data.manifest.files.length,4);
});
test('approved store mounts a tutor-controllable offline visual without LLM callbacks',async()=>{
 const store=storeApi.createMemoryStore();
 let reviews=0;
 const reviewers={agent:async()=>{reviews++;return approved.agent();}};
 await service.prepareAndPublish({spec,store,context:ctx,blueprint,reviewers,
   materials:{'anchors.json':JSON.stringify(anchors)}});
 const mounted=await service.mountApproved({container:fakeElement(),store,context:ctx});
 a.equal(mounted.controller.getState().beat,'predict');
 a.ok(mounted.bridge);
 mounted.bridge.command({sequence:1,type:'play',beatId:'observe'});
 a.equal(mounted.controller.getState().beat,'observe');
 a.equal(mounted.bridge.state().slideId,'water-cycle/observe');
 a.equal(reviews,1,'reviewer must not run during playback');
 mounted.destroy();
});
test('unreviewed and scientifically invalid assets never publish',async()=>{
 const store=storeApi.createMemoryStore();
 const uncertain=await service.prepareAndPublish({spec,store,context:ctx,blueprint,
   reviewers:{agent:async()=>({status:'uncertain',reviewerId:'reviewer',
     confidence:0.5,findings:[],checks:{scientific:'uncertain',curriculum:'pass',
       pedagogy:'pass',accessibility:'pass'}})}});
 a.equal(uncertain.status,'human_required');
 await a.rejects(service.loadApproved({store,context:ctx}),/no approved/);
 const wrong=JSON.parse(JSON.stringify(spec));
 wrong.beats[0].narration='Water vapour is visible.';
 const rejected=await service.prepareAndPublish({spec:wrong,store,context:ctx,blueprint,reviewers:approved});
 a.equal(rejected.status,'rejected');
});
test('invalid requests and malformed approved content fail closed',async()=>{
 const store=storeApi.createMemoryStore();
 await a.rejects(service.prepareAndPublish({}),/missing/);
 await a.rejects(service.mountApproved({store,context:ctx}),/DOM container/);
 await a.rejects(service.loadApproved({store,context:ctx}),/no approved/);
});

test('curriculum mismatch is rejected before invoking external reviewer',async()=>{
 const store=storeApi.createMemoryStore();let calls=0;
 const agent={agent:async()=>{calls++;return approved.agent();}};
 await a.rejects(service.prepareAndPublish({spec,store,context:{...ctx,level:'jc'},
   blueprint,reviewers:agent}),/does not match curriculum storage path/);
 await a.rejects(service.prepareAndPublish({spec,store,context:ctx,
   blueprint:{...blueprint,syllabusId:'another/2026/primary/science/water-cycle'},
   reviewers:agent}),/blueprint does not match curriculum storage path/);
 a.equal(calls,0);
});
test('approved playback rejects curriculum identity mismatch on read',async()=>{
 const store=storeApi.createMemoryStore();
 await service.prepareAndPublish({spec,store,context:ctx,blueprint,reviewers:approved});
 const key=ctx.level;
 const wrong={...ctx,level:key==='primary'?'secondary':'primary'};
 await a.rejects(service.loadApproved({store,context:wrong}),/no approved/);
});
