/* Slide presenter - zero-dependency deck renderer (issue #746).
 *
 * Presents a slide deck validated by AnimathValidate.validateSlides
 * (SPEC.md "Slide spec"): one slide at a time, next/prev navigation with
 * a counter, keyboard arrows/space, speaker notes on demand (never in
 * the audience view-model unless toggled on), mechanism visuals mounted
 * from the referenced animation spec, and a print view with one slide
 * per page and notes always excluded.
 *
 * UMD, zero dependencies, no DOM at load: the controller is DOM-free and
 * the thin attach layer receives the document through its parameters,
 * so the whole flow is node-testable with fakes (export-ui.js style).
 *
 * Usage from a demo page (thin bootstrap only):
 *   var handle = AnimathSlidesPresenter.attachPresenter(
 *     document, document.getElementById('stage'), deck,
 *     { animSpec: animSpec });
 */
(function (global) {
  'use strict';

  var SHAPES = ['text', 'rect', 'circle', 'line', 'arrow', 'polygon', 'latex', 'sector'];

  function getValidateSlides() {
    return (global.AnimathValidate && global.AnimathValidate.validateSlides) || (typeof require !== 'undefined' ? require('./validate.js').validateSlides : null);
  }

  function assertValidDeck(deck) {
    var fn = getValidateSlides();
    if (!fn) throw new Error('animath presenter: player/validate.js is missing - include it before presenter.js so decks can be validated');
    var errors = fn(deck);
    if (errors.length) throw new Error('invalid slide deck: ' + errors.join('; '));
  }

  // Resolve a slide visual to a render instruction. String form and a
  // descriptor with a sceneId mount an animation scene; a descriptor
  // with only a shape kind names a diagram (no scene exists to mount);
  // when both are present the scene wins and the kind is retained.
  // Absent or invalid visuals resolve to null.
  function resolveVisual(visual) {
    if (typeof visual === 'string') return visual.trim() ? { type: 'scene', sceneId: visual } : null;
    if (!visual || typeof visual !== 'object' || Array.isArray(visual)) return null;
    var hasSceneId = typeof visual.sceneId === 'string' && visual.sceneId.trim().length > 0;
    var hasKind = SHAPES.indexOf(visual.kind) !== -1;
    if (visual.sceneId !== undefined && !hasSceneId) return null;
    if (visual.kind !== undefined && !hasKind) return null;
    if (hasSceneId) {
      var out = { type: 'scene', sceneId: visual.sceneId };
      if (hasKind) out.kind = visual.kind;
      return out;
    }
    if (hasKind) return { type: 'diagram', kind: visual.kind };
    return null;
  }

  // Map a keyboard event to a presenter action. Pure: takes an
  // event-like {key, target} so Node tests can call it directly.
  // Mirrors player.js keyAction's form-field guard, but space advances
  // the deck (next) instead of toggling play/pause.
  function keyAction(eventLike) {
    var t = eventLike && eventLike.target;
    if (t && t.tagName) {
      var tag = String(t.tagName).toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
    }
    var key = eventLike && eventLike.key;
    if (key === 'ArrowLeft') return 'prev';
    if (key === 'ArrowRight' || key === ' ' || key === 'Spacebar') return 'next';
    return null;
  }

  function viewFor(deck, idx, notesVisible) {
    var slide = deck.slides[idx];
    return {
      index: idx,
      count: deck.slides.length,
      counter: (idx + 1) + ' / ' + deck.slides.length,
      kind: slide.kind,
      heading: slide.heading || '',
      bullets: slide.bullets ? slide.bullets.slice() : [],
      notes: notesVisible ? (slide.notes || '') : null,
      visual: resolveVisual(slide.visual)
    };
  }

  // View-models for every slide with notes always null: the print
  // handout can never leak speaker notes.
  function printViews(deck) {
    assertValidDeck(deck);
    return deck.slides.map(function (slide, i) { return viewFor(deck, i, false); });
  }

  // DOM-free presenter controller. Validates the deck on construction
  // and throws on errors, like AnimathPlayer.mount does for specs.
  function createPresenter(deck) {
    assertValidDeck(deck);
    var state = { index: 0, notesVisible: false };
    function count() { return deck.slides.length; }
    function clamp(i) { return Math.max(0, Math.min(deck.slides.length - 1, i)); }
    function index() { return state.index; }
    function current() { return deck.slides[state.index]; }
    function counter() { return (state.index + 1) + ' / ' + deck.slides.length; }
    function next() { state.index = clamp(state.index + 1); return state.index; }
    function prev() { state.index = clamp(state.index - 1); return state.index; }
    function goTo(i) { state.index = clamp(i); return state.index; }
    function toggleNotes() { state.notesVisible = !state.notesVisible; return state.notesVisible; }
    function setNotes(v) { state.notesVisible = !!v; return state.notesVisible; }
    function notesVisible() { return state.notesVisible; }
    function view() { return viewFor(deck, state.index, state.notesVisible); }
    function handleKey(eventLike) {
      var action = keyAction(eventLike);
      if (!action) return null;
      if (action === 'prev') prev();
      else next();
      return action;
    }
    return {
      count: count, index: index, current: current, counter: counter,
      next: next, prev: prev, goTo: goTo,
      toggleNotes: toggleNotes, setNotes: setNotes, notesVisible: notesVisible,
      view: view, keyAction: keyAction, handleKey: handleKey,
      printViews: function () { return printViews(deck); }
    };
  }

  // Thin DOM layer: renders only the controller's current view-model.
  //   doc:       the document (real on the page, fake in tests)
  //   container: element the presenter fills; becomes focusable
  //   deck:      a slide deck (validated on construction)
  //   opts:      { mountPlayer, animSpec } - mountPlayer defaults to
  //              global AnimathPlayer.mount; animSpec is the animation
  //              spec whose scenes deck visuals reference by id.
  function attachPresenter(doc, container, deck, opts) {
    opts = opts || {};
    var ctl = createPresenter(deck);
    var mountPlayer = opts.mountPlayer || (global.AnimathPlayer && global.AnimathPlayer.mount) || null;
    var animSpec = opts.animSpec || null;
    var playerHandle = null;

    function make(tag, cls, text) {
      var e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    var screen = make('div', 'sp-screen');
    var headingEl = make('div', 'sp-heading');
    var bulletsEl = make('ul', 'sp-bullets');
    var visualEl = make('div', 'sp-visual');
    var counterEl = make('div', 'sp-counter');
    var notesEl = make('div', 'sp-notes');
    screen.appendChild(headingEl);
    screen.appendChild(bulletsEl);
    screen.appendChild(visualEl);
    screen.appendChild(counterEl);
    container.appendChild(screen);

    var controls = make('div', 'sp-controls');
    var prevBtn = make('button', 'sp-prev', 'Prev');
    var nextBtn = make('button', 'sp-next', 'Next');
    var notesBtn = make('button', 'sp-notes-toggle', 'Notes');
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(notesBtn);
    container.appendChild(controls);
    container.appendChild(notesEl);

    var printEl = make('div', 'sp-print');
    printViews(deck).forEach(function (pv) {
      var ps = make('div', 'sp-print-slide');
      ps.appendChild(make('div', 'sp-print-heading', pv.heading));
      var ul = make('ul', 'sp-print-bullets');
      pv.bullets.forEach(function (b) { ul.appendChild(make('li', 'sp-print-bullet', b)); });
      ps.appendChild(ul);
      printEl.appendChild(ps);
    });
    container.appendChild(printEl);

    function renderVisual(vm) {
      if (playerHandle) { playerHandle.destroy(); playerHandle = null; }
      visualEl.innerHTML = '';
      if (!vm.visual) return;
      if (vm.visual.type === 'diagram') {
        visualEl.appendChild(make('div', 'sp-visual-diagram', 'Diagram: ' + vm.visual.kind));
        return;
      }
      var sceneIdx = -1;
      if (animSpec && Array.isArray(animSpec.scenes)) {
        for (var i = 0; i < animSpec.scenes.length; i++) {
          if (animSpec.scenes[i].id === vm.visual.sceneId) { sceneIdx = i; break; }
        }
      }
      if (sceneIdx === -1 || typeof mountPlayer !== 'function') {
        visualEl.appendChild(make('div', 'sp-visual-diagram', 'Scene: ' + vm.visual.sceneId));
        return;
      }
      var sub = make('div', 'sp-visual-scene');
      visualEl.appendChild(sub);
      playerHandle = mountPlayer(sub, animSpec);
      playerHandle.seekScene(sceneIdx, 0);
      playerHandle.pause();
    }

    function render() {
      var vm = ctl.view();
      headingEl.textContent = vm.heading;
      bulletsEl.innerHTML = '';
      vm.bullets.forEach(function (b) { bulletsEl.appendChild(make('li', 'sp-bullet', b)); });
      counterEl.textContent = vm.counter;
      notesEl.textContent = vm.notes === null ? '' : vm.notes;
      prevBtn.disabled = vm.index === 0;
      nextBtn.disabled = vm.index === vm.count - 1;
      renderVisual(vm);
    }

    prevBtn.addEventListener('click', function () { ctl.prev(); render(); });
    nextBtn.addEventListener('click', function () { ctl.next(); render(); });
    notesBtn.addEventListener('click', function () { ctl.toggleNotes(); render(); });
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', function (e) {
      var action = ctl.handleKey(e);
      if (!action) return;
      e.preventDefault();
      render();
    });

    render();
    return { controller: ctl, render: render };
  }

  var api = {
    createPresenter: createPresenter,
    resolveVisual: resolveVisual,
    printViews: printViews,
    keyAction: keyAction,
    attachPresenter: attachPresenter
  };
  global.AnimathSlidesPresenter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
