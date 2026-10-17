/* teachkit interactive teaching pilot — independent, zero-dependency v0.1.
 * The legacy animath:"0.1" animation player is not modified by this module.
 * A water-cycle model reports conceptual activity, NOT measured weather.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TeachkitInteractive = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var PARAM_IDS = ['solar', 'cooling', 'growth'];
  var BEAT_IDS = ['overview', 'evaporation', 'condensation', 'precipitation', 'collection'];
  var PARAM_LABELS = { solar: 'Solar energy', cooling: 'Cooling of moist air', growth: 'Cloud droplet growth' };
  var BEAT_LABELS = { overview: 'Whole cycle', evaporation: 'Evaporation', condensation: 'Condensation', precipitation: 'Precipitation', collection: 'Collection' };

  function object(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function boundedText(x, max) { return typeof x === 'string' && x.trim().length > 0 && x.length <= max; }
  function inRange(x) { return Number.isInteger(x) && x >= 0 && x <= 100 && x % 10 === 0; }
  function validate(spec) {
    var problems = [];
    if (!object(spec)) return ['interactive spec must be an object'];
    if (spec.interactive !== '0.1') problems.push('interactive version must be "0.1"');
    if (spec.model !== 'water-cycle') problems.push('unsupported model');
    if (spec.level !== 'secondary' || spec.subject !== 'science' || spec.topic !== 'water-cycle') problems.push('model syllabus identity must be secondary/science/water-cycle');
    if (!boundedText(spec.title, 100)) problems.push('title must be 1–100 characters');
    if (!boundedText(spec.disclaimer, 300) || !/not.*(forecast|weather prediction)/i.test(spec.disclaimer)) problems.push('a non-forecast limitation statement is required');
    if (!Array.isArray(spec.parameters) || spec.parameters.length !== PARAM_IDS.length) {
      problems.push('parameters must contain exactly solar, cooling and growth');
    } else {
      var seen = {};
      spec.parameters.forEach(function (p) {
        if (!object(p) || PARAM_IDS.indexOf(p.id) < 0 || seen[p.id]) { problems.push('invalid or duplicate parameter'); return; }
        seen[p.id] = true;
        if (!boundedText(p.label, 80) || !inRange(p.default) || p.min !== 0 || p.max !== 100 || p.step !== 10) problems.push('invalid parameter contract for ' + p.id);
      });
      PARAM_IDS.forEach(function (id) { if (!seen[id]) problems.push('missing parameter ' + id); });
    }
    if (!Array.isArray(spec.beats) || spec.beats.length !== BEAT_IDS.length) {
      problems.push('beats must contain exactly the five known instructional beats');
    } else {
      var beats = {};
      spec.beats.forEach(function (b) {
        if (!object(b) || BEAT_IDS.indexOf(b.id) < 0 || beats[b.id]) { problems.push('unknown or duplicate beat'); return; }
        beats[b.id] = true;
        if (!boundedText(b.label, 80) || !boundedText(b.narration, 500)) problems.push('invalid beat content: ' + b.id);
      });
      BEAT_IDS.forEach(function (id) { if (!beats[id]) problems.push('missing beat ' + id); });
    }
    if (!object(spec.check) || !boundedText(spec.check.question, 250) ||
        !Array.isArray(spec.check.options) || spec.check.options.length < 2 ||
        spec.check.options.length > 4 || !spec.check.options.every(function (s) { return boundedText(s, 150); }) ||
        !Number.isInteger(spec.check.correctIndex) ||
        spec.check.correctIndex < 0 || spec.check.correctIndex >= spec.check.options.length ||
        !boundedText(spec.check.explanation, 400)) problems.push('invalid understanding check');
    return problems;
  }
  function assertSpec(spec) {
    var problems = validate(spec);
    if (problems.length) throw new Error('invalid interactive spec: ' + problems.join('; '));
    return spec;
  }
  function evaluate(values) {
    if (!object(values) || PARAM_IDS.some(function (id) { return !inRange(values[id]); })) throw new Error('invalid model parameters');
    // A qualitative illustration of one parcel's journey; not a quantitative
    // prediction of evaporation rate, cloud cover, or rainfall.
    var evaporation = values.solar;
    var condensation = Math.min(evaporation, values.cooling);
    var precipitation = Math.min(condensation, values.growth);
    return { evaporation: evaporation, condensation: condensation,
      precipitation: precipitation, collection: precipitation };
  }
  function createSession(spec) {
    spec = JSON.parse(JSON.stringify(assertSpec(spec))); // reject caller mutation after creation
    var values = {};
    spec.parameters.forEach(function (p) { values[p.id] = p.default; });
    var beat = 'overview';
    var answered = null;
    var events = [];
    var listeners = [];
    var destroyed = false;
    function active() { if (destroyed) throw new Error('interactive session destroyed'); }
    function snapshot() {
      return { parameters: Object.assign({}, values), activity: evaluate(values),
        beat: beat, answer: answered === null ? null : { index: answered,
          correct: answered === spec.check.correctIndex } };
    }
    function emit(type, source, detail) {
      var entry = { seq: events.length + 1, type: type, source: source,
        detail: detail, state: snapshot() };
      events.push(entry);
      listeners.slice().forEach(function (fn) { try { fn(entry); } catch (_) { /* subscribers are isolated */ } });
      return JSON.parse(JSON.stringify(entry));
    }
    function sourceOf(source) {
      if (source == null) return 'student';
      if (source !== 'student' && source !== 'tutor') throw new Error('source must be student or tutor');
      return source;
    }
    function setParameter(id, value, source) {
      active();
      if (PARAM_IDS.indexOf(id) < 0 || !inRange(value)) throw new Error('invalid parameter: ' + id);
      var actor = sourceOf(source);
      values[id] = value;
      return emit('parameter', actor, { id: id, value: value });
    }
    function playBeat(id, source) {
      active();
      if (BEAT_IDS.indexOf(id) < 0) throw new Error('unknown beat: ' + id);
      var actor = sourceOf(source);
      beat = id;
      return emit('beat', actor, { id: id });
    }
    function answer(index, source) {
      active();
      if (!Number.isInteger(index) || index < 0 || index >= spec.check.options.length) throw new Error('invalid answer');
      var actor = sourceOf(source);
      answered = index;
      return emit('answer', actor, { index: index, correct: index === spec.check.correctIndex });
    }
    function reset(source) {
      active();
      var actor = sourceOf(source);
      spec.parameters.forEach(function (p) { values[p.id] = p.default; });
      beat = 'overview'; answered = null;
      return emit('reset', actor, {});
    }
    return {
      getState: function () { active(); return snapshot(); },
      getHistory: function () { active(); return JSON.parse(JSON.stringify(events)); },
      setParameter: setParameter, playBeat: playBeat, answer: answer, reset: reset,
      on: function (fn) {
        active();
        if (typeof fn !== 'function') throw new Error('listener must be function');
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
      },
      destroy: function () { destroyed = true; listeners = []; }
    };
  }
  function svgFor(state) {
    var a = state.activity;
    // Every dynamic value here comes from a validated 0–100 integer.
    var opE = (a.evaporation / 100).toFixed(2);
    var opC = (a.condensation / 100).toFixed(2);
    var opP = (a.precipitation / 100).toFixed(2);
    function emphasis(id) { return state.beat === id ? ' style="filter:drop-shadow(0 0 6px #F59E0B)"' : ''; }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 380" role="img" aria-label="Conceptual water cycle showing solar energy, evaporation, condensation, precipitation and collection">' +
      '<rect width="720" height="380" rx="16" fill="#EAF5FC"/>' +
      '<circle cx="110" cy="76" r="39" fill="#F9C74F"' + emphasis('evaporation') + '/>' +
      '<path d="M0 310 L175 125 L310 310 Z" fill="#83B6A1"/>' +
      '<path d="M175 125 L146 164 L174 157 L203 165 Z" fill="#F7FAFA"/>' +
      '<path d="M0 305 Q120 284 240 304 T480 304 T720 305 L720 380 L0 380 Z" fill="#5CACE2"' + emphasis('collection') + '/>' +
      '<g fill="white" stroke="#ACCBD9" stroke-width="2"' + emphasis('condensation') + '><circle cx="449" cy="99" r="39"/><circle cx="503" cy="82" r="52"/><circle cx="553" cy="105" r="39"/><path d="M448 105 H555 V139 H448 Z" stroke="none"/></g>' +
      '<path class="tki-vapour-flow" d="M311 293 Q304 205 397 145" fill="none" stroke="#2C86B5" stroke-width="8" stroke-dasharray="12 12" opacity="' + opE + '"/>' +
      '<path d="M386 149 L404 140 L395 159" fill="none" stroke="#2C86B5" stroke-width="5" opacity="' + opE + '"/>' +
      '<path d="M435 133 L482 142" fill="none" stroke="#2C86B5" stroke-width="7" opacity="' + opC + '"/>' +
      '<g stroke="#238DD2" stroke-width="7" stroke-linecap="round" opacity="' + opP + '"' + emphasis('precipitation') + '><path d="M488 153 V208"/><path d="M531 153 V234"/><path d="M571 153 V204"/></g>' +
      '<path d="M260 306 Q343 322 420 308" stroke="#D3F2FA" stroke-width="5" fill="none"/>' +
      '<g fill="#21435B" font-family="system-ui,sans-serif" font-size="17" font-weight="600">' +
      '<text x="52" y="140">Solar energy</text><text x="286" y="193">Evaporation</text>' +
      '<text x="418" y="38">Condensation</text><text x="565" y="218">Precipitation</text>' +
      '<text x="324" y="359">Collection</text></g>' +
      '</svg>';
  }
  function mount(container, spec) {
    assertSpec(spec);
    if (!container || typeof container.appendChild !== 'function') throw new Error('mount needs a DOM container');
    var doc = container.ownerDocument || document;
    var session = createSession(spec);
    container.textContent = '';
    function el(tag, name, text) {
      var node = doc.createElement(tag);
      if (name) node.className = name;
      if (text != null) node.textContent = text;
      return node;
    }
    var root = el('section', 'tki');
    var title = el('h2', 'tki-title', spec.title);
    var summary = el('p', 'tki-disclaimer', spec.disclaimer);
    var stage = el('div', 'tki-stage');
    var narration = el('p', 'tki-narration');
    narration.setAttribute('aria-live', 'polite');
    root.appendChild(title); root.appendChild(stage); root.appendChild(narration);
    var beats = el('div', 'tki-beats');
    var beatButtons = {};
    spec.beats.forEach(function (b) {
      var button = el('button', 'tki-beat', b.label);
      button.type = 'button';
      button.addEventListener('click', function () { session.playBeat(b.id); });
      beats.appendChild(button); beatButtons[b.id] = button;
    });
    root.appendChild(beats);
    var sliders = el('div', 'tki-controls');
    var inputs = {};
    var output = {};
    spec.parameters.forEach(function (p) {
      var wrap = el('div', 'tki-control');
      var label = el('label', '', p.label);
      var slider = el('input', '');
      slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '10';
      var labelId = 'tki-' + p.id;
      slider.id = labelId; label.htmlFor = labelId;
      var reading = el('output', '', String(p.default) + '%');
      slider.addEventListener('input', function () { session.setParameter(p.id, Number(slider.value)); });
      wrap.appendChild(label); wrap.appendChild(slider); wrap.appendChild(reading);
      sliders.appendChild(wrap); inputs[p.id] = slider; output[p.id] = reading;
    });
    root.appendChild(sliders);
    var activity = el('p', 'tki-activity');
    activity.setAttribute('aria-live', 'polite'); root.appendChild(activity);
    var quiz = el('fieldset', 'tki-check');
    var legend = el('legend', '', spec.check.question);
    quiz.appendChild(legend);
    var feedback = el('p', 'tki-feedback');
    feedback.setAttribute('aria-live', 'polite');
    var answers = [];
    spec.check.options.forEach(function (option, index) {
      var button = el('button', 'tki-answer', option);
      button.type = 'button';
      button.addEventListener('click', function () { session.answer(index); });
      quiz.appendChild(button); answers.push(button);
    });
    quiz.appendChild(feedback); root.appendChild(quiz);
    var reset = el('button', 'tki-reset', 'Reset model');
    reset.type = 'button'; reset.addEventListener('click', function () { session.reset(); });
    root.appendChild(reset); root.appendChild(summary); container.appendChild(root);
    function paint() {
      var state = session.getState();
      stage.innerHTML = svgFor(state);
      var selected = spec.beats.filter(function (b) { return b.id === state.beat; })[0];
      narration.textContent = selected.narration;
      spec.parameters.forEach(function (p) {
        inputs[p.id].value = String(state.parameters[p.id]);
        output[p.id].textContent = String(state.parameters[p.id]) + '%';
      });
      activity.textContent = 'Illustrative activity only — evaporation: ' + state.activity.evaporation +
        '/100; condensation: ' + state.activity.condensation + '/100; precipitation: ' +
        state.activity.precipitation + '/100.';
      spec.beats.forEach(function (b) { beatButtons[b.id].setAttribute('aria-pressed', String(b.id === state.beat)); });
      answers.forEach(function (b, i) { b.setAttribute('aria-pressed', String(state.answer !== null && state.answer.index === i)); });
      feedback.textContent = state.answer === null ? '' :
        (state.answer.correct ? 'Correct. ' : 'Try again. ') + spec.check.explanation;
    }
    var unsubscribe = session.on(paint);
    paint();
    return {
      getState: session.getState, getHistory: session.getHistory,
      setParameter: session.setParameter, playBeat: session.playBeat,
      answer: session.answer, reset: session.reset, on: session.on,
      destroy: function () { unsubscribe(); session.destroy(); container.textContent = ''; }
    };
  }
  return { version: '0.1.0', validate: validate, evaluate: evaluate,
    createSession: createSession, svgFor: svgFor, mount: mount,
    parameterIds: PARAM_IDS.slice(), beatIds: BEAT_IDS.slice(),
    parameterLabels: Object.assign({}, PARAM_LABELS), beatLabels: Object.assign({}, BEAT_LABELS) };
});
