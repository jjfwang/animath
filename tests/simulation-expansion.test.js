'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const kit=require('../player/simulation-kit.js');
const files=['secondary-water-cycle','primary-fractions','secondary-motion','ohms-law',
  'ideal-gas','quadratic-curve','transpiration','erosion'];
const specs=files.map(f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations',f+'.json'),'utf8')));
const map=Object.fromEntries(specs.map(s=>[s.model,s]));
test('eight syllabus models share one strict simulation contract',()=>{
 a.equal(new Set(kit.models).size,8);
 a.equal(new Set(specs.map(s=>s.model)).size,8);
 for(const spec of specs){
   a.deepEqual(kit.validate(spec),[]);
   const session=kit.createSession(spec);
   a.match(kit.svgFor(spec,session.getState()),/^<svg/);
   a.equal(typeof session.setParameter,'function');
   a.ok(spec.beats.some(b=>/predict/i.test(b.label)));
 }
});
test('model-to-syllabus binding prevents wrong-level educational reuse',()=>{
 const wrong=JSON.parse(JSON.stringify(map['ideal-gas']));
 wrong.level='primary';
 a.ok(kit.validate(wrong).some(e=>/syllabus mismatch/.test(e)));
 a.throws(()=>kit.createSession(wrong),/syllabus mismatch/);
 const wrongSubject=JSON.parse(JSON.stringify(map['ohms-law']));
 wrongSubject.subject='math';
 a.ok(kit.validate(wrongSubject).length);
});
test('every gold topic is present in syllabus taxonomy',()=>{
 const markdown=fs.readFileSync(path.join(__dirname,'../SYLLABUS.md'),'utf8');
 for(const s of specs)a.ok(markdown.includes('| `'+s.topic+'` |'),
   'missing syllabus topic: '+s.topic);
});
test('Ohm law preserves mathematical relationship for same temperature',()=>{
 a.deepEqual(kit.calculate('ohms-law',{voltage:6,resistance:3}),
   {voltage:6,resistance:3,current:2,power:12});
 const s=kit.createSession(map['ohms-law']);
 s.setParameter('resistance',6);
 a.equal(s.getState().output.current,1);
 a.throws(()=>s.setParameter('resistance',0),/invalid parameter/);
 a.throws(()=>kit.calculate('ohms-law',{voltage:6,resistance:0}),/circuit/);
});
test('ideal gas computes pressure in kPa from absolute Kelvin and litres',()=>{
 const s=kit.createSession(map['ideal-gas']);
 a.ok(Math.abs(s.getState().output.pressureKPa-498.84)<0.001);
 s.setParameter('volumeL',10);
 a.ok(Math.abs(s.getState().output.pressureKPa-249.42)<0.001);
 a.throws(()=>kit.calculate('ideal-gas',{temperatureK:0,volumeL:5}),/Kelvin/);
});
test('quadratic curve respects vertex transformations and no linear degeneracy',()=>{
 const s=kit.createSession(map['quadratic-curve']);
 s.setParameter('h',2);s.setParameter('k',-3);s.setParameter('a',2);
 a.deepEqual(s.getState().output,{a:2,h:2,k:-3,vertexX:2,vertexY:-3,yIntercept:5});
 a.throws(()=>s.setParameter('a',0),/quadratic a/);
 a.match(kit.svgFor(map['quadratic-curve'],s.getState()),/Vertex/);
});
test('transpiration and erosion remain bounded illustrative activity scores',()=>{
 const s=kit.createSession(map.transpiration);
 s.setParameter('humidity',100);
 a.ok(s.getState().output.activity < 52);
 const e=kit.createSession(map.erosion);
 e.setParameter('rockResistance',100);
 a.equal(e.getState().output.activity,0);
 e.setParameter('rockResistance',0);
 a.equal(e.getState().output.activity,60);
 a.throws(()=>kit.calculate('erosion',{waterEnergy:200,rockResistance:50}),/conceptual/);
});
test('subject samples include explicit model limitations and feedback',()=>{
 for(const s of specs){
   a.ok(s.disclaimer.length>30,s.model);
   a.ok(s.check.explanation.length>15,s.model);
   a.ok(s.beats.length>=3,s.model);
 }
});
test('models render deterministic safe SVG at boundary values',()=>{
 for(const spec of specs){
   const s=kit.createSession(spec),a1=kit.svgFor(spec,s.getState()),a2=kit.svgFor(spec,s.getState());
   a.equal(a1,a2);
   a.doesNotMatch(a1,/<script|NaN|Infinity|onload=/);
   a.match(a1,/aria-label=/);
 }
});
