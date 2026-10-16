/* Tests for player/presenter.js - slide presenter (issue #746).
 * Node-only, zero dependencies: the controller is DOM-free and the
 * attach layer runs against fake document/elements with an injected
 * fake mountPlayer, in export-ui.test.js style.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const presenter = require('../player/presenter.js');
const { validateSlides } = require('../player/validate.js');

const ROOT = path.join(__dirname, '..');

function validDeck() {
  return {
    title: 'The Water Cycle',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    slides: [
      { kind: 'title', heading: 'The Water Cycle', bullets: ['One drop, round and round'], notes: 'Welcome everyone in.' },
      { kind: 'objective', bullets: ['Name the four stages in order'], notes: 'Read the goals aloud.' },
      { kind: 'mechanism', heading: 'Evaporation', visual: { kind: 'arrow' } },
      { kind: 'exit-ticket', heading: 'Exit ticket', bullets: ['Write the four stages in order'] }
    ]
  };
}

describe('createPresenter controller', () => {
  test('starts at the first slide with count, current and counter', () => {
    const ctl = presenter.createPresenter(validDeck());
    assert.equal(ctl.count(), 4);
    assert.equal(ctl.index(), 0);
    assert.equal(ctl.current().kind, 'title');
    assert.equal(ctl.counter(), '1 / 4');
    assert.equal(ctl.notesVisible(), false);
  });

  test('next and prev move one slide and clamp at both bounds without wrapping', () => {
    const ctl = presenter.createPresenter(validDeck());
    assert.equal(ctl.prev(), 0);
    assert.equal(ctl.next(), 1);
    assert.equal(ctl.next(), 2);
    assert.equal(ctl.counter(), '3 / 4');
    assert.equal(ctl.next(), 3);
    assert.equal(ctl.next(), 3);
    assert.equal(ctl.prev(), 2);
    assert.equal(ctl.current().kind, 'mechanism');
  });

  test('goTo clamps out-of-range indexes', () => {
    const ctl = presenter.createPresenter(validDeck());
    assert.equal(ctl.goTo(99), 3);
    assert.equal(ctl.goTo(-5), 0);
    assert.equal(ctl.goTo(2), 2);
    assert.equal(ctl.index(), 2);
  });

  test('view returns the current slide view-model with defaults for absent fields', () => {
    const ctl = presenter.createPresenter(validDeck());
    assert.deepEqual(ctl.view(), {
      index: 0, count: 4, counter: '1 / 4', kind: 'title',
      heading: 'The Water Cycle', bullets: ['One drop, round and round'],
      notes: null, visual: null
    });
    ctl.goTo(1);
    const v1 = ctl.view();
    assert.equal(v1.heading, '');
    assert.deepEqual(v1.bullets, ['Name the four stages in order']);
    ctl.goTo(2);
    const v2 = ctl.view();
    assert.deepEqual(v2.bullets, []);
    assert.deepEqual(v2.visual, { type: 'diagram', kind: 'arrow' });
  });

  test('view bullets are a copy, not the deck array', () => {
    const deck = validDeck();
    const ctl = presenter.createPresenter(deck);
    ctl.view().bullets.push('mutated');
    assert.deepEqual(deck.slides[0].bullets, ['One drop, round and round']);
  });

  test('notes are structurally absent from the view until toggled on', () => {
    const ctl = presenter.createPresenter(validDeck());
    assert.equal(ctl.view().notes, null);
    assert.equal(ctl.toggleNotes(), true);
    assert.equal(ctl.notesVisible(), true);
    assert.equal(ctl.view().notes, 'Welcome everyone in.');
    ctl.goTo(1);
    assert.equal(ctl.view().notes, 'Read the goals aloud.');
    ctl.goTo(2);
    assert.equal(ctl.view().notes, '');
    assert.equal(ctl.toggleNotes(), false);
    assert.equal(ctl.view().notes, null);
    assert.equal(ctl.setNotes(true), true);
    assert.equal(ctl.view().notes, '');
    assert.equal(ctl.setNotes(false), false);
    assert.equal(ctl.notesVisible(), false);
  });

  test('printViews returns every slide with notes always null', () => {
    const ctl = presenter.createPresenter(validDeck());
    ctl.setNotes(true);
    const views = ctl.printViews();
    assert.equal(views.length, 4);
    assert.deepEqual(views.map((v) => v.counter), ['1 / 4', '2 / 4', '3 / 4', '4 / 4']);
    assert.ok(views.every((v) => v.notes === null));
    const standalone = presenter.printViews(validDeck());
    assert.deepEqual(standalone.map((v) => v.kind), ['title', 'objective', 'mechanism', 'exit-ticket']);
  });

  test('invalid decks throw on construction and in printViews', () => {
    assert.throws(() => presenter.createPresenter(null), /invalid slide deck: spec: must be an object/);
    assert.throws(() => presenter.createPresenter({ title: 'x' }), /invalid slide deck/);
    assert.throws(() => presenter.printViews({}), /invalid slide deck/);
  });
});

describe('keyAction and handleKey', () => {
  test('maps arrows and space to navigation, space advances the deck', () => {
    assert.equal(presenter.keyAction({ key: 'ArrowLeft' }), 'prev');
    assert.equal(presenter.keyAction({ key: 'ArrowRight' }), 'next');
    assert.equal(presenter.keyAction({ key: ' ' }), 'next');
    assert.equal(presenter.keyAction({ key: 'Spacebar' }), 'next');
    assert.equal(presenter.keyAction({ key: 'Enter' }), null);
    assert.equal(presenter.keyAction({ key: 'a' }), null);
    assert.equal(presenter.keyAction(null), null);
    assert.equal(presenter.keyAction({}), null);
  });

  test('ignores keys typed into form fields, mirroring player.js', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) {
      assert.equal(presenter.keyAction({ key: 'ArrowRight', target: { tagName: tag } }), null);
    }
    assert.equal(presenter.keyAction({ key: 'ArrowRight', target: { tagName: 'DIV' } }), 'next');
    assert.equal(presenter.keyAction({ key: 'ArrowRight', target: {} }), 'next');
  });

  test('handleKey applies the action and returns it, or null when unmapped', () => {
    const ctl = presenter.createPresenter(validDeck());
    ctl.goTo(1);
    assert.equal(ctl.handleKey({ key: 'ArrowLeft' }), 'prev');
    assert.equal(ctl.index(), 0);
    assert.equal(ctl.handleKey({ key: ' ' }), 'next');
    assert.equal(ctl.index(), 1);
    assert.equal(ctl.handleKey({ key: 'x' }), null);
    assert.equal(ctl.index(), 1);
    assert.equal(ctl.handleKey({ key: 'ArrowRight', target: { tagName: 'INPUT' } }), null);
    assert.equal(ctl.index(), 1);
    assert.equal(ctl.keyAction({ key: 'ArrowRight' }), 'next');
    assert.equal(ctl.index(), 1);
  });
});

describe('resolveVisual', () => {
  test('string form resolves to a scene', () => {
    assert.deepEqual(presenter.resolveVisual('s1'), { type: 'scene', sceneId: 's1' });
  });

  test('descriptor with sceneId resolves to a scene, kind retained when present', () => {
    assert.deepEqual(presenter.resolveVisual({ sceneId: 's2' }), { type: 'scene', sceneId: 's2' });
    assert.deepEqual(presenter.resolveVisual({ sceneId: 's2', kind: 'rect' }), { type: 'scene', sceneId: 's2', kind: 'rect' });
  });

  test('descriptor with kind only resolves to a diagram', () => {
    assert.deepEqual(presenter.resolveVisual({ kind: 'arrow' }), { type: 'diagram', kind: 'arrow' });
  });

  test('absent and invalid visuals resolve to null', () => {
    assert.equal(presenter.resolveVisual(undefined), null);
    assert.equal(presenter.resolveVisual(null), null);
    assert.equal(presenter.resolveVisual(42), null);
    assert.equal(presenter.resolveVisual([]), null);
    assert.equal(presenter.resolveVisual(''), null);
    assert.equal(presenter.resolveVisual('   '), null);
    assert.equal(presenter.resolveVisual({}), null);
    assert.equal(presenter.resolveVisual({ sceneId: '' }), null);
    assert.equal(presenter.resolveVisual({ sceneId: '', kind: 'rect' }), null);
    assert.equal(presenter.resolveVisual({ sceneId: 7 }), null);
    assert.equal(presenter.resolveVisual({ kind: 'bogus' }), null);
    assert.equal(presenter.resolveVisual({ sceneId: 's1', kind: 'bogus' }), null);
  });
});

describe('gold deck', () => {
  const deck = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'decks', 'primary-science-water-cycle.json'), 'utf8'));
  const anim = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'primary-science-water-cycle.json'), 'utf8'));

  test('loads from disk, passes validateSlides, and walks end to end', () => {
    assert.deepEqual(validateSlides(deck), []);
    const ctl = presenter.createPresenter(deck);
    assert.equal(ctl.count(), 11);
    assert.deepEqual(anim.scenes.map((s) => s.id), ['s1', 's2', 's3', 's4']);
    const visuals = [];
    for (let i = 0; i < 11; i++) {
      ctl.goTo(i);
      const v = ctl.view();
      assert.equal(v.counter, (i + 1) + ' / 11');
      if (v.visual) visuals.push(v.visual);
    }
    assert.deepEqual(visuals, [
      { type: 'scene', sceneId: 's1' },
      { type: 'scene', sceneId: 's2' },
      { type: 'scene', sceneId: 's3' },
      { type: 'scene', sceneId: 's4' }
    ]);
    assert.equal(ctl.counter(), '11 / 11');
    assert.equal(ctl.next(), 10);
    const pv = presenter.printViews(deck);
    assert.equal(pv.length, 11);
    assert.ok(pv.every((v) => v.notes === null));
  });
});

describe('presenter.css print rules', () => {
  const css = fs.readFileSync(path.join(ROOT, 'player', 'presenter.css'), 'utf8');

  test('print stylesheet hides screen chrome and notes, one slide per page', () => {
    assert.ok(css.includes('@media print'));
    assert.ok(css.includes('break-after: page'));
    assert.ok(css.includes('.sp-screen, .sp-controls, .sp-notes { display: none; }'));
    assert.ok(css.includes('.sp-print { display: none; }'));
    assert.ok(css.includes('.sp-print { display: block; }'));
    assert.ok(css.includes('.sp-print-slide { break-after: page; }'));
  });
});

// --- fake DOM for the attach layer ---

function fakeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    disabled: false,
    children: [],
    listeners: {},
    attrs: {},
    appendChild: function (c) { this.children.push(c); return c; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (type, fn) { this.listeners[type] = fn; }
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = v; if (v === '') el.children.length = 0; }
  });
  return el;
}

function fakeDoc() {
  return { createElement: function (tag) { return fakeEl(tag); } };
}

function findAll(el, cls, out) {
  out = out || [];
  if (el.className === cls) out.push(el);
  el.children.forEach((c) => findAll(c, cls, out));
  return out;
}

function findOne(el, cls) {
  const found = findAll(el, cls);
  assert.equal(found.length, 1, 'exactly one .' + cls);
  return found[0];
}

function allText(el, out) {
  out = out || [];
  if (el.textContent) out.push(el.textContent);
  el.children.forEach((c) => allText(c, out));
  return out;
}

function mountSpy() {
  const spy = { calls: [], handles: [] };
  spy.mount = function (container, spec) {
    const handle = {
      seeks: [],
      pauses: 0,
      destroys: 0,
      seekScene: function (i, ms) { this.seeks.push([i, ms]); },
      pause: function () { this.pauses++; },
      destroy: function () { this.destroys++; }
    };
    spy.calls.push({ container: container, spec: spec });
    spy.handles.push(handle);
    return handle;
  };
  return spy;
}

function attachDeck() {
  return {
    title: 'Deck',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    slides: [
      { kind: 'title', heading: 'Title slide', bullets: ['alpha'], notes: 'note-zero' },
      { kind: 'mechanism', heading: 'Evaporation', bullets: ['beta'], visual: 's1' },
      { kind: 'mechanism', heading: 'Diagram slide', bullets: ['gamma'], visual: { kind: 'arrow' } },
      { kind: 'exit-ticket', heading: 'Exit ticket', bullets: ['delta'] }
    ]
  };
}

const ANIM = { scenes: [{ id: 's1' }, { id: 's2' }] };

describe('attachPresenter', () => {
  test('renders one slide, navigates by buttons, mounts and destroys the scene player', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    const handle = presenter.attachPresenter(doc, container, attachDeck(), { mountPlayer: spy.mount, animSpec: ANIM });
    const heading = findOne(container, 'sp-heading');
    const bullets = findOne(container, 'sp-bullets');
    const counter = findOne(container, 'sp-counter');
    const visual = findOne(container, 'sp-visual');
    const notes = findOne(container, 'sp-notes');
    const prevBtn = findOne(container, 'sp-prev');
    const nextBtn = findOne(container, 'sp-next');

    assert.equal(container.attrs.tabindex, '0');
    assert.equal(heading.textContent, 'Title slide');
    assert.deepEqual(bullets.children.map((c) => c.textContent), ['alpha']);
    assert.equal(counter.textContent, '1 / 4');
    assert.equal(visual.children.length, 0);
    assert.equal(notes.textContent, '');
    assert.equal(prevBtn.disabled, true);
    assert.equal(nextBtn.disabled, false);
    assert.equal(spy.calls.length, 0);

    nextBtn.listeners.click();
    assert.equal(handle.controller.index(), 1);
    assert.equal(heading.textContent, 'Evaporation');
    assert.equal(counter.textContent, '2 / 4');
    assert.equal(spy.calls.length, 1);
    assert.equal(spy.calls[0].spec, ANIM);
    assert.equal(spy.calls[0].container.className, 'sp-visual-scene');
    assert.deepEqual(spy.handles[0].seeks, [[0, 0]]);
    assert.equal(spy.handles[0].pauses, 1);
    assert.equal(findOne(visual, 'sp-visual-scene'), spy.calls[0].container);

    nextBtn.listeners.click();
    assert.equal(handle.controller.index(), 2);
    assert.equal(spy.handles[0].destroys, 1);
    assert.equal(spy.calls.length, 1);
    const placeholder = findOne(visual, 'sp-visual-diagram');
    assert.equal(placeholder.textContent, 'Diagram: arrow');

    prevBtn.listeners.click();
    assert.equal(handle.controller.index(), 1);
    assert.equal(spy.calls.length, 2);
    assert.deepEqual(spy.handles[1].seeks, [[0, 0]]);

    handle.controller.goTo(3);
    handle.render();
    assert.equal(spy.handles[1].destroys, 1);
    assert.equal(nextBtn.disabled, true);
    assert.equal(counter.textContent, '4 / 4');
  });

  test('notes element stays empty until toggled on', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    presenter.attachPresenter(doc, container, attachDeck(), { mountPlayer: spy.mount, animSpec: ANIM });
    const notes = findOne(container, 'sp-notes');
    const notesBtn = findOne(container, 'sp-notes-toggle');
    assert.equal(notes.textContent, '');
    notesBtn.listeners.click();
    assert.equal(notes.textContent, 'note-zero');
    notesBtn.listeners.click();
    assert.equal(notes.textContent, '');
  });

  test('keydown on the container navigates and prevents default only for mapped keys', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    const handle = presenter.attachPresenter(doc, container, attachDeck(), { mountPlayer: spy.mount, animSpec: ANIM });
    let prevented = 0;
    const ev = (key, target) => ({ key: key, target: target, preventDefault: function () { prevented++; } });
    container.listeners.keydown(ev('ArrowRight', { tagName: 'DIV' }));
    assert.equal(handle.controller.index(), 1);
    assert.equal(prevented, 1);
    container.listeners.keydown(ev('x', { tagName: 'DIV' }));
    assert.equal(handle.controller.index(), 1);
    assert.equal(prevented, 1);
    container.listeners.keydown(ev('ArrowRight', { tagName: 'INPUT' }));
    assert.equal(handle.controller.index(), 1);
    assert.equal(prevented, 1);
    container.listeners.keydown(ev('ArrowLeft', { tagName: 'DIV' }));
    assert.equal(handle.controller.index(), 0);
    assert.equal(prevented, 2);
  });

  test('scene missing from the animation spec renders a labelled placeholder, never throws', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    const deck = attachDeck();
    deck.slides[1].visual = 'sX';
    const handle = presenter.attachPresenter(doc, container, deck, { mountPlayer: spy.mount, animSpec: ANIM });
    handle.controller.goTo(1);
    handle.render();
    assert.equal(spy.calls.length, 0);
    assert.equal(findOne(container, 'sp-visual-diagram').textContent, 'Scene: sX');
  });

  test('scene visual without a mountPlayer renders a placeholder', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const handle = presenter.attachPresenter(doc, container, attachDeck(), { animSpec: ANIM });
    handle.controller.goTo(1);
    handle.render();
    assert.equal(findOne(container, 'sp-visual-diagram').textContent, 'Scene: s1');
  });

  test('default mountPlayer comes from the global AnimathPlayer', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    globalThis.AnimathPlayer = { mount: spy.mount };
    try {
      const handle = presenter.attachPresenter(doc, container, attachDeck(), { animSpec: ANIM });
      handle.controller.goTo(1);
      handle.render();
      assert.equal(spy.calls.length, 1);
    } finally {
      delete globalThis.AnimathPlayer;
    }
  });

  test('attach works with no opts at all', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const handle = presenter.attachPresenter(doc, container, attachDeck());
    assert.equal(handle.controller.index(), 0);
    assert.equal(findOne(container, 'sp-counter').textContent, '1 / 4');
  });

  test('print section holds one print slide per deck slide and never any notes', () => {
    const doc = fakeDoc();
    const container = fakeEl('div');
    const spy = mountSpy();
    presenter.attachPresenter(doc, container, attachDeck(), { mountPlayer: spy.mount, animSpec: ANIM });
    const print = findOne(container, 'sp-print');
    assert.equal(print.children.length, 4);
    assert.ok(print.children.every((c) => c.className === 'sp-print-slide'));
    assert.deepEqual(findAll(print, 'sp-print-heading').map((h) => h.textContent),
      ['Title slide', 'Evaporation', 'Diagram slide', 'Exit ticket']);
    assert.ok(!allText(print).join(' ').includes('note-zero'));
  });
});
