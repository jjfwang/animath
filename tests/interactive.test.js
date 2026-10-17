/* Interactive water-cycle pilot contract and DOM harness; no third-party dependencies. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Interactive = require('../player/interactive.js');
const root = path.join(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'samples/interactive/secondary-science-water-cycle.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('Secondary water-cycle interactive spec is versioned and valid', () => {
  assert.deepEqual(Interactive.validate(spec), []);
  assert.equal(spec.model, 'water-cycle');
  assert.deepEqual(Interactive.parameterIds, ['solar','cooling','growth']);
  assert.deepEqual(Interactive.beatIds, ['overview','evaporation','condensation','precipitation','collection']);
});
test('reject invalid version and unsupported syllabus/model identity', () => {
  for (const [key, value] of [['interactive', '0.2'], ['model', 'arbitrary'],
    ['topic', 'fractions'], ['subject', 'math'], ['level', 'primary']]) {
    const bad = clone(spec); bad[key] = value;
    assert.notDeepEqual(Interactive.validate(bad), []);
    assert.throws(() => Interactive.createSession(bad), /invalid interactive spec/);
  }
  assert.ok(Interactive.validate(null).length);
});
test('invalid controls, duplicate controls and missing controls fail closed', () => {
  let bad = clone(spec); bad.parameters[0].default = 101;
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.parameters[0].step = 5;
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.parameters[1].id = 'solar';
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.parameters.pop();
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.parameters[0].label = '';
  assert.ok(Interactive.validate(bad).length);
});
test('unknown, duplicate and missing teaching beats fail closed', () => {
  let bad = clone(spec); bad.beats[1].id = 'not-a-beat';
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.beats[1].id = 'overview';
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.beats.pop();
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.beats[0].narration = '';
  assert.ok(Interactive.validate(bad).length);
});
test('mandatory scientific limitation and correct answer bounds enforced', () => {
  let bad = clone(spec); bad.disclaimer = 'This predicts actual rainfall';
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.title = '';
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.check.correctIndex = -1;
  assert.ok(Interactive.validate(bad).length);
  bad = clone(spec); bad.check.options = [];
  assert.ok(Interactive.validate(bad).length);
});
test('qualitative evaluation is bounded, deterministic and prerequisite-aware', () => {
  assert.deepEqual(Interactive.evaluate({ solar: 60, cooling: 70, growth: 40 }),
    { evaporation: 60, condensation: 60, precipitation: 40, collection: 40 });
  assert.equal(Interactive.evaluate({ solar: 0, cooling: 100, growth: 100 }).condensation, 0);
  assert.equal(Interactive.evaluate({ solar: 100, cooling: 0, growth: 100 }).precipitation, 0);
  assert.equal(Interactive.evaluate({ solar: 100, cooling: 100, growth: 0 }).precipitation, 0);
  assert.deepEqual(Interactive.evaluate({ solar: 100, cooling: 100, growth: 100 }),
    { evaporation: 100, condensation: 100, precipitation: 100, collection: 100 });
  assert.throws(() => Interactive.evaluate({solar:NaN,cooling:80,growth:50}), /invalid/);
  assert.throws(() => Interactive.evaluate({solar:20.5,cooling:80,growth:50}), /invalid/);
});
test('tutor and student commands update state and emit ordered snapshots', () => {
  const s = Interactive.createSession(spec);
  const seen = []; const off = s.on((e) => seen.push(e));
  assert.equal(s.getState().beat, 'overview');
  const e1 = s.playBeat('condensation', 'tutor');
  assert.equal(e1.seq, 1);
  assert.equal(e1.source, 'tutor');
  const e2 = s.setParameter('cooling', 20);
  assert.equal(e2.seq, 2);
  assert.equal(e2.source, 'student');
  assert.equal(s.getState().activity.condensation, 20);
  assert.equal(s.getHistory().length, 2);
  e1.detail.id = 'corrupted';
  assert.equal(s.getHistory()[0].detail.id, 'condensation', 'events must be immutable to callers');
  off();
  s.reset('tutor');
  assert.equal(seen.length, 2, 'unsubscribe works');
  assert.equal(s.getState().beat, 'overview');
  assert.equal(s.getState().parameters.cooling, 70);
  assert.equal(s.getHistory()[2].source, 'tutor');
  s.destroy();
  assert.throws(() => s.getState(), /destroyed/);
});
test('invalid commands and invalid source cannot partially mutate state', () => {
  const s = Interactive.createSession(spec);
  const before = s.getState();
  assert.throws(() => s.setParameter('solar', Infinity), /invalid parameter/);
  assert.throws(() => s.setParameter('solar', 55), /invalid parameter/);
  assert.throws(() => s.setParameter('other', 50), /invalid parameter/);
  assert.throws(() => s.setParameter('solar', 20, 'external'), /source/);
  assert.throws(() => s.playBeat('unknown'), /unknown beat/);
  assert.throws(() => s.playBeat('collection', 'external'), /source/);
  assert.throws(() => s.answer(100), /invalid answer/);
  assert.throws(() => s.answer(0, 'external'), /source/);
  assert.throws(() => s.reset('external'), /source/);
  assert.deepEqual(s.getState(), before);
  assert.deepEqual(s.getHistory(), []);
  assert.throws(() => s.on(123), /listener/);
  s.destroy();
});
test('checks capture feedback with correct/incorrect outcomes and reset', () => {
  const s = Interactive.createSession(spec);
  const wrong = s.answer(0);
  assert.equal(wrong.detail.correct, false);
  assert.equal(s.getState().answer.correct, false);
  const right = s.answer(1, 'tutor');
  assert.equal(right.detail.correct, true);
  assert.equal(s.getState().answer.correct, true);
  s.reset();
  assert.equal(s.getState().answer, null);
});
test('external mutation of passed spec does not change existing session defaults', () => {
  const input = clone(spec);
  const s = Interactive.createSession(input);
  input.parameters[0].default = 0;
  input.check.correctIndex = 0;
  s.reset();
  assert.equal(s.getState().parameters.solar, 60);
  assert.equal(s.answer(1).detail.correct, true);
});
test('SVG output reflects changing activity and selection without external HTML', () => {
  const s = Interactive.createSession(spec);
  const before = Interactive.svgFor(s.getState());
  assert.match(before, /aria-label="Conceptual water cycle/);
  assert.match(before, /opacity="0.60"/);
  s.setParameter('solar', 0);
  s.playBeat('precipitation', 'tutor');
  const after = Interactive.svgFor(s.getState());
  assert.match(after, /opacity="0.00"/);
  assert.match(after, /drop-shadow/);
  assert.notEqual(before, after);
  assert.doesNotMatch(after, /<script|onload=|NaN/);
});
// A small DOM shim tests mount's public API, wiring, event feedback and teardown.
function fakeDocument() {
  const doc = {};
  doc.createElement = function (tag) {
    return {
      tagName: tag.toUpperCase(), ownerDocument: doc, children: [], listeners: {},
      attributes: {}, textContent: '', innerHTML: '', value: '',
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      fire(type) { this.listeners[type](); }
    };
  };
  return doc;
}
function walk(node, found=[]) {
  found.push(node);
  for (const child of node.children || []) walk(child, found);
  return found;
}
test('DOM mount can be driven by student controls and tutor API', () => {
  const doc = fakeDocument();
  const container = doc.createElement('div');
  const ctl = Interactive.mount(container, spec);
  assert.equal(container.children.length, 1);
  assert.match(walk(container).find((n) => n.className === 'tki-stage').innerHTML, /<svg/);
  const sliders = walk(container).filter((n) => n.tagName === 'INPUT');
  assert.equal(sliders.length, 3);
  sliders[0].value = '90'; sliders[0].fire('input');
  assert.equal(ctl.getState().parameters.solar, 90);
  ctl.playBeat('condensation', 'tutor');
  assert.equal(ctl.getState().beat, 'condensation');
  const buttons = walk(container).filter((n) => n.className === 'tki-answer');
  buttons[1].fire('click');
  assert.equal(ctl.getState().answer.correct, true);
  const feedback = walk(container).find((n) => n.className === 'tki-feedback');
  assert.match(feedback.textContent, /Correct/);
  const reset = walk(container).find((n) => n.className === 'tki-reset');
  reset.fire('click');
  assert.equal(ctl.getState().parameters.solar, 60);
  ctl.destroy();
  assert.equal(container.textContent, '');
});
test('mount validation prevents misuse before touching the DOM', () => {
  assert.throws(() => Interactive.mount(null, spec), /DOM container/);
  const bad = clone(spec); bad.model = 'arbitrary';
  assert.throws(() => Interactive.mount({}, bad), /invalid interactive spec/);
});
test('science gold sample guards invisibility, condensation and non-automatic rain', () => {
  const narrations = Object.fromEntries(spec.beats.map((b) => [b.id, b.narration]));
  assert.match(narrations.evaporation, /invisible gas/i);
  assert.match(narrations.condensation, /tiny liquid droplets/i);
  assert.match(narrations.precipitation, /does not always mean rain/i);
  assert.match(narrations.collection, /again/i);
  assert.match(spec.disclaimer, /not a weather forecast/i);
  assert.match(spec.check.explanation, /not all clouds produce rain/i);
});
test('visual controls ship reduced-motion fallback and no generic eval', () => {
  const css = fs.readFileSync(path.join(root, 'player/interactive.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'player/interactive.js'), 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /tki-vapour-flow/);
  assert.equal(js.includes('eval('), false);
  assert.equal(js.includes('new Function('), false);
});
test('interactive demo and published file layout are present', () => {
  const html = fs.readFileSync(path.join(root, 'player/interactive-demo.html'), 'utf8');
  assert.match(html, /interactive\.js/);
  assert.match(html, /secondary-science-water-cycle\.json/);
  assert.match(html, /interactive\.css/);
  assert.match(html, /teachkitTutor/);
});
