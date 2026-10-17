'use strict';
const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../player/simulation-kit.js');
const samples = ['secondary-water-cycle.json','primary-fractions.json','secondary-motion.json'].map(
  (f) => JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/simulations',f),'utf8')));
const copy = (x) => JSON.parse(JSON.stringify(x));
test('three independent syllabus models validate and render', () => {
  a.ok(['water-cycle','fraction-bars','uniform-motion'].every((id)=>core.models.includes(id)));
  a.equal(new Set(core.models).size,core.models.length);
  samples.forEach((s) => {
    a.deepEqual(core.validate(s),[]);
    const controller = core.createSession(s);
    const svg = core.svgFor(s,controller.getState());
    a.match(svg,/<svg/);a.match(svg,/role="img"/);
    a.equal(svg.includes('<script'),false);
  });
});
test('domain formulas produce expected results', () => {
  a.deepEqual(core.calculate('water-cycle',{solar:60,cooling:30,growth:90}),
    {evaporation:60,condensation:30,precipitation:30,collection:30});
  a.deepEqual(core.calculate('fraction-bars',{numerator:6,denominator:8}),
    {numerator:6,denominator:8,fraction:0.75});
  a.deepEqual(core.calculate('uniform-motion',{speed:10,time:12}),
    {speed:10,time:12,distance:120});
});
test('invalid docs and unsafe model ids fail closed', () => {
  const input = copy(samples[0]);input.model='javascript:alert(1)';
  a.ok(core.validate(input).length);
  a.throws(()=>core.createSession(input));
  const duplicate = copy(samples[0]);duplicate.beats[1].id='predict';
  a.ok(core.validate(duplicate).length);
  const badStep = copy(samples[2]);badStep.parameters[0].step=0;
  a.ok(core.validate(badStep).length);
});
test('fraction invariant rejects impossible choices atomically', () => {
  const s=core.createSession(samples[1]),initial=s.getState();
  a.throws(()=>s.setParameter('numerator',8),/invalid fraction/);
  a.deepEqual(s.getState(),initial);
  s.setParameter('numerator',2);s.setParameter('denominator',8);
  a.equal(s.getState().output.fraction,0.25);
});
test('student-tutor events and callback snapshots cannot corrupt replay', () => {
  const s=core.createSession(samples[2]),seen=[];
  const off=s.on(e=>{seen.push(e);e.state.parameters.time=999;});
  s.playBeat('observe','tutor');
  s.setParameter('speed',5);
  s.answer(0,'student');
  a.equal(s.getState().output.distance,60);
  a.equal(s.getHistory().length,3);
  a.equal(s.getHistory()[0].state.parameters.time,12);
  a.equal(s.getHistory()[1].source,'student');
  a.equal(seen.length,3);
  off();s.reset();a.equal(seen.length,3);
  a.equal(s.getState().parameters.speed,10);
  a.throws(()=>s.playBeat('unknown'),/unknown beat/);
  a.throws(()=>s.setParameter('speed',7,'server'),/actor/);
  s.destroy();a.throws(()=>s.getState(),/destroyed/);
});
test('rendered spec strings are HTML and attribute escaped', () => {
  const x=copy(samples[2]);x.title='<svg onload="alert(1)">';
  a.deepEqual(core.validate(x),[]);
  const svg=core.svgFor(x,core.createSession(x).getState());
  a.doesNotMatch(svg,/onload="/);
  a.match(svg,/&lt;svg/);
});
test('model assumptions do not become weather predictions', () => {
  const x=copy(samples[0]);x.disclaimer='Accurate rainfall prediction';
  a.ok(core.validate(x).length);
  a.throws(()=>core.calculate('uniform-motion',{speed:-5,time:10}));
  a.throws(()=>core.calculate('fraction-bars',{numerator:9,denominator:4}));
  a.throws(()=>core.calculate('other',{a:1}));
});

test('renderer rejects untrusted state and recomputes outputs', () => {
  const state=core.createSession(samples[2]).getState();
  state.output.distance='<script>alert(1)</script>';
  const svg=core.svgFor(samples[2],state);
  a.doesNotMatch(svg,/<script|alert\(1\)/);
  const malicious=JSON.parse(JSON.stringify(state));
  malicious.parameters.speed='<svg onload="alert(1)">';
  a.throws(()=>core.svgFor(samples[2],malicious),/invalid visualization parameter/);
  a.throws(()=>core.svgFor(samples[2],{...state,model:'unknown'}),/invalid visualization state/);
  a.throws(()=>core.svgFor(samples[2],{...state,beat:'bogus'}),/invalid visualization state/);
});

test('exposed spec is a defensive copy, not mutable session validation state', () => {
  const s=core.createSession(samples[1]);
  s.spec.parameters.find((p)=>p.id==='numerator').min=-1000;
  s.spec.check.correctIndex=99;
  a.throws(()=>s.setParameter('numerator',-1),/invalid parameter/);
  a.equal(s.answer(samples[1].check.correctIndex).detail.correct,true);
});
