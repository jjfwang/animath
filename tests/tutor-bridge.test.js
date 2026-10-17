'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const kit=require('../player/simulation-kit.js');
const {createTutorBridge}=require('../player/tutor-bridge.js');
const load=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8'));
const spec=load('../samples/simulations/secondary-water-cycle.json');
const map=load('../samples/simulations/water-cycle-anchor-map.json');
function fresh(){return createTutorBridge(kit.createSession(spec),map,{clock:()=>12345});}
test('beat/slide/voice mapping must be complete and unique',()=>{
 const s=kit.createSession(spec);
 a.throws(()=>createTutorBridge(null,map));
 a.throws(()=>createTutorBridge(s,[map[0]]));
 a.throws(()=>createTutorBridge(s,[map[0],map[0],map[2]]));
 a.throws(()=>createTutorBridge(s,map.map((x,i)=>({...x,speechCue:i?'dup':'other'}))));
 a.equal(fresh().state().slideId,'water-cycle/predict');
});
test('tutor drives a synchronized semantic beat snapshot',()=>{
 const b=fresh();
 const e=b.command({sequence:1,type:'play',beatId:'observe'});
 a.equal(e.state.beatId,'observe');
 a.equal(e.state.slideId,'water-cycle/observe');
 a.equal(e.state.speechCue,'water-cycle/wc-02');
 a.equal(e.state.visual.beat,'observe');
 a.equal(e.state.paused,false);
 a.equal(e.time,12345);
 a.equal(b.speech('water-cycle/wc-02',250).state.speechPosition,250);
 a.equal(b.command({sequence:2,type:'pause'}).state.paused,true);
 a.throws(()=>b.speech('water-cycle/wc-02',300));
 a.equal(b.command({sequence:3,type:'resume'}).state.speechPosition,250);
});
test('replayed, reordered and invalid commands do not double-advance state',()=>{
 const b=fresh();
 a.throws(()=>b.command({sequence:2,type:'play',beatId:'explain'}),/out of order/);
 a.throws(()=>b.command({sequence:1,type:'play',beatId:'missing'}),/unmapped/);
 a.equal(b.command({sequence:1,type:'play',beatId:'explain'}).state.slideId,'water-cycle/explain');
 const duplicate=b.command({sequence:1,type:'play',beatId:'observe'});
 a.equal(duplicate.status,'duplicate');
 a.equal(b.state().beatId,'explain');
 a.throws(()=>b.command({sequence:2,type:'bad'}),/unknown/);
 a.equal(b.events().length,1);
});
test('interruption and seek reset speech clock, retaining current visuals',()=>{
 const b=fresh();
 b.command({sequence:1,type:'play',beatId:'observe'});b.speech('water-cycle/wc-02',850);
 b.command({sequence:2,type:'interrupt'});
 a.equal(b.state().speechPosition,850);
 a.throws(()=>b.speech('water-cycle/wc-02',900));
 b.command({sequence:3,type:'seek',beatId:'predict'});
 a.equal(b.state().speechPosition,0);
 a.equal(b.state().slideId,'water-cycle/predict');
 a.throws(()=>b.speech('wrong',20));
 a.throws(()=>b.speech('water-cycle/wc-01',-1));
});
test('question checkpoint never auto repeats indefinitely',()=>{
 const b=fresh();
 b.command({sequence:1,type:'ask'});
 a.equal(b.state().questionPending,true);
 a.throws(()=>b.command({sequence:2,type:'resume'}),/checkpoint/);
 b.answer(1);b.answer(1);
 a.equal(b.state().needsAdaptation,true);
 a.equal(b.state().attempts,2);
 a.equal(b.state().questionPending,true);
 const correct=b.answer(0);
 a.equal(correct.detail.correct,true);
 a.equal(b.state().questionPending,false);
 b.command({sequence:2,type:'resume'});
 a.equal(b.state().paused,false);
});
test('student manipulation and tutor parameter commands emit auditable events',()=>{
 const b=fresh(),view=[];
 b.on(e=>{view.push(e);e.state.visual.parameters.solar=999;});
 b.setParameter('solar',30);
 b.command({sequence:1,type:'parameter',parameterId:'cooling',value:20});
 a.equal(b.state().visual.output.condensation,20);
 a.equal(b.events().length,2);
 a.equal(b.events()[0].state.visual.parameters.solar,30);
 a.equal(view.length,2);
});
test('end prevents further commands or student changes',()=>{
 const b=fresh();b.command({sequence:1,type:'end'});
 a.equal(b.state().ended,true);
 a.throws(()=>b.command({sequence:2,type:'resume'}));
 a.throws(()=>b.answer(0));
 a.throws(()=>b.setParameter('solar',60));
});
