/* animath prompt builder — turns a student's need into LLM prompts.
 * See PROMPTS.md for the template source. Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AnimathPrompt = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LEVEL_LABELS = {
    primary: 'Primary school (PSLE)',
    secondary: 'Secondary school (O/N-level)',
    jc: 'Junior college (H2)'
  };

  var LEVEL_TONE = {
    primary: 'warm, concrete, everyday examples (cakes, MRT trips)',
    secondary: 'direct, precise, exam-aware',
    jc: 'rigorous, defines terms, shows derivations'
  };

  var KIND_GUIDANCE = {
    concept: 'Teach the concept from first principles; assume the student has only prior-level knowledge.',
    problem: 'Pose a typical exam-style problem first, then solve it with full animated working.'
  };

  // Per-topic misconception library (generator/misconceptions.js). In Node we
  // require it; in the browser web/index.html loads it before this file so
  // globalThis.AnimathMisconceptions is set. Missing either way degrades to
  // the generic misconception line instead of failing.
  var MISCONCEPTIONS = (function () {
    if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
      try { return require('./misconceptions.js').MISCONCEPTIONS || {}; } catch (e) { return {}; }
    }
    var g = (typeof window !== 'undefined' ? window : globalThis);
    return (g.AnimathMisconceptions && g.AnimathMisconceptions.MISCONCEPTIONS) || {};
  })();

  var GENERIC_MISCONCEPTION_LINE =
    '- Address exactly one common misconception for the topic, visually\n' +
    '  (e.g. show the classic wrong turn playing out visually, not just a caption saying it is wrong).';

  // Pure lookup: exact short-slug match first, then the longest key that is a
  // dash-boundary prefix of the slug (e.g. "fractions-addition" -> "fractions").
  // Facet hint (issue #367): when the resolved entry carries `facets`, a
  // matching hint returns that facet's entry; a missing or unknown hint
  // returns the primary facet, preserving pre-facet behavior. Plain entries
  // are returned as-is. Returns the entry or null.
  function misconceptionFor(topicSlug, facetHint) {
    if (!topicSlug || typeof topicSlug !== 'string') return null;
    var entry = null;
    if (MISCONCEPTIONS[topicSlug]) entry = MISCONCEPTIONS[topicSlug];
    else {
      var best = null;
      var keys = Object.keys(MISCONCEPTIONS);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (topicSlug.indexOf(k + '-') === 0 && (best === null || k.length > best.length)) {
          best = k;
        }
      }
      if (best !== null) entry = MISCONCEPTIONS[best];
    }
    if (!entry) return null;
    if (!entry.facets) return entry;
    if (facetHint && entry.facets[facetHint]) return entry.facets[facetHint];
    var primary = (entry.primary && entry.facets[entry.primary]) ? entry.primary : Object.keys(entry.facets)[0];
    return entry.facets[primary];
  }

  function misconceptionLine(topicSlug, facetHint) {
    var m = misconceptionFor(topicSlug, facetHint);
    if (!m) return GENERIC_MISCONCEPTION_LINE;
    return '- Address exactly one common misconception for the topic, visually:\n' +
      '  Common wrong turn: ' + m.wrongTurn + '\n' +
      '  Why students slip: ' + m.why + '\n' +
      '  Show the correct turn: ' + m.correctTurn;
  }

  // Slice 4 (issue #691) — taste transfer: the hand-authored
  // samples/primary-science-water-cycle.json embedded as a trimmed few-shot
  // exemplar of good output (7.5KB source -> under 3KB here). TRIM RULE
  // (applied by hand when authoring this constant, not at runtime): keep
  // scene ids, captions verbatim, and per step the verb plus the shape
  // id/kind with ONE anchor coordinate set (cx/cy, x/y, x1/y1/x2/y2, or
  // points), the text content of text shapes, move/emphasize targets with
  // the key field of `to`, caption-step text, and every explain field
  // verbatim (they are the point). Drop narration, duration_ms, at_ms /
  // dur_ms timings, style fields (fill, stroke, strokeWidth, size, color,
  // width), duplicate sibling instances (arrow2, drop2, dropB/C, c1/c3,
  // rain1/3 collapse to the one representative), redundant coordinate
  // detail (rect w/h, circle r), and show-step shape ids that no later
  // step in the excerpt references as a move/emphasize target. Kept as a
  // JS object literal and compacted with JSON.stringify so the module
  // works unchanged in the browser (web/index.html loads this file via a
  // script tag) and in Node — no Node-only APIs at top level.
  var WATER_CYCLE_EXEMPLAR_OBJ = { scenes: [
    { id: 's1', caption: 'Evaporation: water rises as vapour', steps: [
      { do: 'show', shape: { kind: 'circle', cx: 810, cy: 100 },
        explain: 'The sun: its heat warms the sea and lifts the water.' },
      { do: 'show', shape: { kind: 'rect', x: 60, y: 400 },
        explain: 'The sea: the sun heats it and water rises as vapour.' },
      { do: 'show', shape: { kind: 'text', x: 90, y: 470, text: 'Sea' },
        explain: 'Label: Sea. Water leaves the sea as vapour.' },
      { do: 'show', shape: { kind: 'arrow', x1: 300, y1: 380, x2: 300, y2: 320 },
        explain: 'Evaporation: heat lifts the water up into the air.' },
      { do: 'show', shape: { id: 'drop1', kind: 'circle', cx: 300, cy: 330 },
        explain: 'A water drop: it rises as invisible vapour.' },
      { do: 'move', target: 'drop1', to: { cy: 190 } },
      { do: 'show', shape: { kind: 'text', x: 120, y: 120, text: 'Heat rises the water up' },
        explain: 'Note: heat rises the water up into the air.' },
      { do: 'caption', text: 'The water did not disappear - it became invisible vapour' }
    ] },
    { id: 's2', caption: 'Condensation: vapour becomes cloud', steps: [
      { do: 'show', shape: { kind: 'text', x: 120, y: 80, text: 'Cold air' },
        explain: 'Label: Cold air. High up, the air is cold.' },
      { do: 'show', shape: { id: 'dropA', kind: 'circle', cx: 380, cy: 150 },
        explain: 'A tiny drop: cooled vapour turning back into water.' },
      { do: 'move', target: 'dropA', to: { cx: 430, cy: 250 } },
      { do: 'show', shape: { id: 'c2', kind: 'circle', cx: 480, cy: 240 },
        explain: 'A cloud: tiny drops joined together.' },
      { do: 'emphasize', target: 'c2' },
      { do: 'caption', text: 'Tiny drops join together - a cloud is born' }
    ] },
    { id: 's3', caption: 'Precipitation: water falls as rain', steps: [
      { do: 'show', shape: { id: 'c2', kind: 'circle', cx: 480, cy: 160 },
        explain: 'A cloud: its drops are getting bigger and heavier.' },
      { do: 'show', shape: { id: 'rain2', kind: 'arrow', x1: 480, y1: 240, x2: 480, y2: 290 },
        explain: 'Rain: drops too heavy to float fall down.' },
      { do: 'move', target: 'rain2', to: { y1: 400 } },
      { do: 'show', shape: { kind: 'text', x: 620, y: 440, text: 'Rain' },
        explain: 'Label: Rain. Heavy drops falling from the cloud.' },
      { do: 'caption', text: 'Heavy drops fall - we call this precipitation' }
    ] },
    { id: 's4', caption: 'Watch out: water is not gone for good once it evaporates', steps: [
      { do: 'show', shape: { kind: 'polygon', points: [[150, 420], [280, 160], [410, 420]] },
        explain: 'The mountain: rain falls high up and runs downhill.' },
      { do: 'show', shape: { id: 'sea', kind: 'rect', x: 560, y: 400 },
        explain: 'The sea: rain returns here, and the cycle starts again.' },
      { do: 'show', shape: { kind: 'arrow', x1: 300, y1: 220, x2: 420, y2: 380 },
        explain: 'The river: it carries the water back to the sea.' },
      { do: 'show', shape: { id: 'flow', kind: 'circle', cx: 300, cy: 220 },
        explain: 'Flowing water: it runs down to the sea.' },
      { do: 'move', target: 'flow', to: { cx: 520, cy: 430 } },
      { do: 'emphasize', target: 'sea' },
      { do: 'caption', text: 'The cycle never ends - round and round it goes' }
    ] }
  ] };
  var WATER_CYCLE_EXEMPLAR = JSON.stringify(WATER_CYCLE_EXEMPLAR_OBJ)
    // Keep the built system prompt free of "}}" (tests/charts-prompt.test.js
    // and tests/explain-prompt.test.js assert no {{ }} placeholder survives
    // the fill): JSON whitespace is insignificant, so separate adjacent
    // closing braces with a space. The 3KB budget below counts this form.
    .split('}}').join('} }');

  var SYSTEM_TEMPLATE = [
    'You are animath\'s animation author. You write short animated explainers for',
    'Singapore students as JSON documents following the animath spec v0.1.',
    '',
    'HARD RULES — violate any of these and the spec is rejected:',
    '1. Return ONLY the JSON document. No markdown fences, no commentary.',
    '2. Top-level fields, exactly: animath ("0.1"), title, level, subject, topic,',
    '   kind, canvas ({width:960, height:540}), scenes (2 to 8).',
    '3. Each scene: id (unique), caption (<= 60 chars), narration (1-2 sentences,',
    '   spoken tone for the level), duration_ms (4000-12000), steps ordered by',
    '   at_ms ascending, every at_ms < duration_ms.',
    '4. Step verbs: show | hide | move | emphasize | caption.',
    '5. Shape kinds: text | rect | circle | line | arrow | polygon | latex. Every shape',
    '   needs a unique id within its scene. Coordinates are canvas pixels,',
    '   origin top-left. Colors are CSS hex. (latex: formal/symbolic notation rendered with KaTeX —',
    '   write plain LaTeX in its "tex" field, e.g. "a^2 + b^2 = c^2".)',
    '6. move supports text | rect | circle | line | arrow | latex | polygon.',
    '   Every move step needs a numeric dur_ms (milliseconds). to must carry',
    '   at least one field valid for the target kind: x/y for text/rect/latex,',
    '   cx/cy for circle, x1/y1/x2/y2 for line/arrow, points for polygon (an',
    '   array of [x,y] pairs, same length as the shape\'s points) — plus',
    '   w/h for rect and r for circle (size fields allowed, alone or with',
    '   position fields). hide/move/emphasize targets must be shown earlier in the SAME scene.',
    '7. Formal notation: prefer the latex shape kind where unicode symbols break',
    '   down (fractions, stacked notation, algebra, chemical formulae, annotated diagrams); text shapes stay UNICODE',
    '   ONLY — NEVER LaTeX backslash commands inside text, like \\frac, \\sqrt, \\times.',
    '8. Keep scenes visually uncluttered: max ~8 shapes visible at once. Prefer',
    '   building a diagram step by step over dumping it whole.',
    '',
    'Explain-tooltips: key chart/diagram shapes should carry an "explain" field:',
    'a plain-text "explain me this" sentence the player shows when the viewer',
    'hovers over, taps, or keyboard-focuses the shape. Write it for a student',
    'staring at that one part: name the part, state what it means in this scene,',
    'one short sentence, plain text (no markdown, no LaTeX). Decorative shapes',
    'and captions do not carry one.',
    '',
    'Chart shapes — author them in the canonical descriptor forms the validator',
    'accepts (the same forms generator/charts.js produces):',
    'pie slices as first-class "sector" descriptors ({cx, cy, r, startAngle,',
    'endAngle}), one per value, with value-proportional sweeps (angles in degrees:',
    '0 is east, positive is clockwise); bar charts as "rect" descriptors growing up',
    'from a visible zero baseline (the zero line stays in the plot); axes with',
    '"nice" tick values (1/2/2.5/5/10 steps) and a few labeled tick marks; number lines',
    'as a baseline with tick marks and centered text labels; area under a curve',
    'as a "polygon" whose points close back to the axis baseline; chart grids as thin',
    '"line" descriptors at the tick positions, drawn behind the data.',
    '',
    'PEDAGOGY:',
    '- kind "concept": motivate (why it matters) -> build the idea visually ->',
    '  one worked micro-example -> recap the takeaway.',
    '- kind "problem": state the problem -> plan (what we need) -> solve it',
    '  step by step, each step appearing as it is explained -> box the answer.',
    'MECHANISM-FIRST — every scene must show the mechanism, not just tell it:',
    '- Each scene needs at least one genuine state transition: a move step,',
    '  or a staged show/hide sequence that builds or transforms the diagram.',
    '- On-screen text plays a supporting role only (labels, captions) — never',
    '  the teaching mechanism itself.',
    '- move vs. staged show/hide: use move for transformation or motion of a',
    '  persistent shape; staged show/hide for step-by-step diagram',
    '  construction; emphasize for attention without state change.',
    '{{MISCONCEPTION_LINE}}',
    '- Narration reads aloud naturally to a {{LEVEL_LABEL}} student. Tone: {{TONE}}.',
    '  No jargon above the level. Short sentences.',
    '',
    'QUALITY GATES — what separates a hand-authored sample from a sloppy one:',
    '- Label placement is a first-class gate: no text shape may overlap any other shape.',
    '- Put every label in clear space and check its footprint against all other',
    '  shapes in the scene; when a label would collide, move it to clear space.',
    '- Every scene carries a caption (<= 60 chars). When the animation follows state',
    '  transitions, the caption names the phase being watched.',
    '- Key chart/diagram parts carry an "explain" field wherever the part invites',
    '  it (the explain instruction above stands: name the part, one short sentence).',
    '- Use "emphasize" on the mechanism beat of each scene — the step where the',
    '  mechanism lands gets the emphasis, not the setup.',
    '- A misconception wrong turn must play out VISUALLY in the scene where the',
    '  wrong turn happens (with transitions: the scene matching the misconceived',
    '  transition) — never as a caption merely saying it is wrong.',
    '',
    'WORKED EXAMPLE — hand-authored water-cycle sample, trimmed to the essentials',
    '(captions name the phases, labels sit in clear space, key parts carry explain,',
    '"emphasize" hits the mechanism beat, the wrong turn plays out visually in the',
    'scene where it happens). Match this quality bar:',
    WATER_CYCLE_EXEMPLAR
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  // Generate pipeline slice 2 (issue #687): the unpacked transitions are
  // wired into the authoring prompt so each transition becomes exactly one
  // scene. Same 2-8 bounds as generator/unpack.js.
  var MIN_PROMPT_TRANSITIONS = 2;
  var MAX_PROMPT_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION SCENES — the topic has been unpacked into an ordered list of',
    'state transitions (see the user message for the full data). Author EXACTLY',
    'one scene per transition, in the given order:',
    '1. Each scene\'s move step IS the state change: show the from_state visibly',
    '   transforming into the to_state with a move step — the transition is',
    '   the scene\'s mechanism, not something a caption describes.',
    '2. The transition\'s driver must be visible in the scene: show the driver',
    '   acting on the subject (e.g. heat rays warming the water, gravity',
    '   pulling droplets down), not just named in a caption.',
    '3. Each scene caption names the phase: the caption states the transition',
    '   name so the viewer knows which phase of the process they are watching.'
  ].join('\n');

  function validatePromptTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildPrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildPrompts: opts.transitions[' + index + '].' +
          field + ' must be a non-empty string');
      }
      out[field] = value.trim();
    }
    return out;
  }

  // Normalizes opts.transitions to a trimmed list, or null when absent or
  // empty (so prompts are byte-identical to the pre-slice-2 behavior).
  // Throws a descriptive Error on any other malformed input.
  function normalizeTransitions(transitions) {
    if (transitions === undefined || transitions === null) return null;
    if (!Array.isArray(transitions)) {
      throw new Error('buildPrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_PROMPT_TRANSITIONS ||
        transitions.length > MAX_PROMPT_TRANSITIONS) {
      throw new Error('buildPrompts: opts.transitions must hold ' +
        MIN_PROMPT_TRANSITIONS + '-' + MAX_PROMPT_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validatePromptTransition(transitions[i], i));
    }
    return out;
  }

  function transitionsUserBlock(transitions) {
    var lines = [
      '',
      '',
      'Ordered state transitions — author EXACTLY one scene per transition, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
    }
    return lines.join('\n');
  }

  // opts: {level, subject, topic, topicLabel, kind, focus, facet, transitions}
  function buildPrompts(opts) {
    if (!opts.subject) {
      throw new Error('buildPrompts: subject is required ' +
        '(see CONTRIBUTING.md add-a-subject checklist)');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    var system = fill(SYSTEM_TEMPLATE, {
      LEVEL_LABEL: LEVEL_LABELS[level] || level,
      TONE: LEVEL_TONE[level] || LEVEL_TONE.secondary,
      MISCONCEPTION_LINE: misconceptionLine(opts.topic, opts.facet)
    });
    if (transitions) system += TRANSITION_SYSTEM_BLOCK;
    var user = [
      'Level: ' + level + ' (' + (LEVEL_LABELS[level] || level) + ')',
      'Subject: ' + opts.subject,
      'Topic: ' + (opts.topicLabel || opts.topic || '') + ' (' + (opts.topic || '') + ')',
      'Kind: ' + (opts.kind || 'concept'),
      'Student\'s focus: ' + (opts.focus || '(none given)'),
      '',
      'Write the animation spec JSON now. ' + (KIND_GUIDANCE[opts.kind] || KIND_GUIDANCE.concept)
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    return { system: system, user: user };
  }

  return {
    buildPrompts: buildPrompts,
    misconceptionFor: misconceptionFor,
    LEVEL_LABELS: LEVEL_LABELS,
    SYSTEM_TEMPLATE: SYSTEM_TEMPLATE,
    WATER_CYCLE_EXEMPLAR: WATER_CYCLE_EXEMPLAR
  };
});
