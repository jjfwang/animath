/* animath topic unpack layer — slice 1 of the generate pipeline (issue #685).
 *
 * Turns a topic into the ordered sequence of state changes the animation
 * shows, one transition per step: {name, from_state, to_state, driver}.
 *
 * The module is model-agnostic: it builds the unpack prompt and parses the
 * JSON list; the caller supplies the actual LLM call (see unpackTopic).
 * Tests feed canned model responses — never the network. Works in browser
 * and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.AnimathUnpack = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LEVEL_LABELS = {
    primary: 'Primary school (PSLE)',
    secondary: 'Secondary school (O/N-level)',
    jc: 'Junior college (H2)'
  };

  var MIN_TRANSITIONS = 2;
  var MAX_TRANSITIONS = 8;

  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  // Slice 6 (issue #695): per-transition misconception beats. The bank
  // (generator/misconceptions.js) loads via the same guarded require /
  // browser-global pattern build_prompt.js uses (web/index.html loads
  // misconceptions.js before unpack.js); a missing bank degrades to no
  // attachment instead of failing. The lookup below mirrors
  // build_prompt.js's misconceptionFor (exact slug, then longest
  // dash-boundary prefix; faceted entries resolve the primary facet) so
  // the two stay aligned — copied, not imported, to avoid a browser-global
  // load-order tangle.
  var MISCONCEPTIONS = (function () {
    if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
      try { return require('./misconceptions.js').MISCONCEPTIONS || {}; } catch (e) { return {}; }
    }
    var g = (typeof window !== 'undefined' ? window : globalThis);
    return (g.AnimathMisconceptions && g.AnimathMisconceptions.MISCONCEPTIONS) || {};
  })();

  function misconceptionEntryFor(topicSlug) {
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
    // Faceted entries (issue #367): bare lookups resolve the primary facet.
    if (!entry.facets) return entry;
    var primary = (entry.primary && entry.facets[entry.primary]) ? entry.primary : Object.keys(entry.facets)[0];
    return entry.facets[primary];
  }

  // Attaches the bank's wrong-turn beat to the transition where it
  // happens: the resolved entry's `transition` field is matched
  // case-insensitively against the trimmed transition names. Returns a
  // NEW array with the matching transition carrying
  // misconception: {wrongTurn, why, correctTurn}; the input is never
  // mutated. No entry, no `transition` field, or no matching transition
  // name -> the input array is returned unchanged.
  function attachMisconceptions(transitions, topicSlug) {
    if (!Array.isArray(transitions)) return transitions;
    var entry = misconceptionEntryFor(topicSlug);
    if (!entry) return transitions;
    var target = (typeof entry.transition === 'string') ? entry.transition.trim().toLowerCase() : '';
    if (!target) return transitions;
    var hit = false;
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      if (t && typeof t.name === 'string' && t.name.trim().toLowerCase() === target) {
        hit = true;
        break;
      }
    }
    if (!hit) return transitions;
    var out = [];
    for (var j = 0; j < transitions.length; j++) {
      var u = transitions[j];
      if (u && typeof u.name === 'string' && u.name.trim().toLowerCase() === target) {
        var copy = {};
        for (var key in u) {
          if (Object.prototype.hasOwnProperty.call(u, key)) copy[key] = u[key];
        }
        copy.misconception = {
          wrongTurn: entry.wrongTurn,
          why: entry.why,
          correctTurn: entry.correctTurn
        };
        out.push(copy);
      } else {
        out.push(u);
      }
    }
    return out;
  }

  var UNPACK_SYSTEM_TEMPLATE = [
    'You are animath\'s topic unpacker. You break a teaching topic into the',
    'ordered sequence of state changes an animation would show, one transition',
    'per step.',
    '',
    'Return ONLY a JSON array. No markdown fences, no commentary, no surrounding prose.',
    '',
    'Each array item is an object with exactly these string fields:',
    '- "name": short label for the transition (e.g. "evaporation")',
    '- "from_state": the state before this transition',
    '- "to_state": the state after this transition',
    '- "driver": what causes the change (e.g. "the sun\'s heat", "gravity", "cooling")',
    '',
    'HARD RULES:',
    '1. The array holds 2 to 8 transitions, in the order the topic happens.',
    '2. Each transition is a genuine STATE CHANGE (mechanism-first): something',
    '   visibly transforms, moves, or changes form — not a caption, a fact, or',
    '   a label.',
    '3. States are concrete and visualizable at {{LEVEL_LABEL}} level. No jargon',
    '   above the level. One driver per transition.',
    '4. The "to_state" of one transition should lead naturally into the next',
    '   "from_state", so the chain reads as one continuous mechanism.',
    '',
    'Example (do not copy; adapt to the actual topic):',
    '[',
    '  {"name": "evaporation", "from_state": "liquid water", "to_state": "water vapour", "driver": "the sun\'s heat"},',
    '  {"name": "condensation", "from_state": "water vapour", "to_state": "liquid droplets", "driver": "cooling"},',
    '  {"name": "precipitation", "from_state": "droplets", "to_state": "falling water", "driver": "gravity"},',
    '  {"name": "collection", "from_state": "fallen water", "to_state": "gathered seas and rivers", "driver": "gravity"}',
    ']'
  ].join('\n');

  var UNPACK_USER_TEMPLATE = [
    'Topic: {{TOPIC}}',
    'Subject: {{SUBJECT}}',
    'Level: {{LEVEL_LABEL}}',
    '',
    'Break this topic into its ordered state transitions now. Return ONLY the JSON array.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  function stripFences(text) {
    var t = text.trim();
    var m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return m ? m[1].trim() : t;
  }

  // Brace-scan fallback: slice the first [ ... last ] and parse it, so
  // prose-wrapped model output still parses. Throws when the text does not
  // contain, or fails to parse as, a JSON array.
  function extractJsonArray(text) {
    var start = text.indexOf('[');
    var end = text.lastIndexOf(']');
    if (start < 0 || end <= start) {
      throw new Error('parseTransitions: response contained no JSON array');
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  function validateTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('parseTransitions: transition ' + (index + 1) +
        ' must be an object with name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('parseTransitions: transition ' + (index + 1) +
          ' "' + field + '" must be a non-empty string');
      }
      out[field] = value.trim();
    }
    return out;
  }

  // opts: {level, subject}
  function buildUnpackPrompts(topic, opts) {
    opts = opts || {};
    if (!topic || typeof topic !== 'string') {
      throw new Error('buildUnpackPrompts: topic must be a non-empty string');
    }
    if (!opts.subject) {
      throw new Error('buildUnpackPrompts: subject is required ' +
        '(see CONTRIBUTING.md add-a-subject checklist)');
    }
    var level = opts.level || 'primary';
    var levelLabel = LEVEL_LABELS[level] || level;
    var system = fill(UNPACK_SYSTEM_TEMPLATE, { LEVEL_LABEL: levelLabel });
    var user = fill(UNPACK_USER_TEMPLATE, {
      TOPIC: topic,
      SUBJECT: opts.subject,
      LEVEL_LABEL: levelLabel
    });
    return { system: system, user: user };
  }

  // Extracts and validates the ordered transition list from raw model text.
  // Throws a descriptive Error on malformed input.
  function parseTransitions(text) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('parseTransitions: expected non-empty model response text');
    }
    var cleaned = stripFences(text);
    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = extractJsonArray(cleaned);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('parseTransitions: response must be a JSON array of transitions');
    }
    if (parsed.length < MIN_TRANSITIONS || parsed.length > MAX_TRANSITIONS) {
      throw new Error('parseTransitions: expected ' + MIN_TRANSITIONS + '-' +
        MAX_TRANSITIONS + ' transitions, got ' + parsed.length);
    }
    var out = [];
    for (var i = 0; i < parsed.length; i++) {
      out.push(validateTransition(parsed[i], i));
    }
    return out;
  }

  // Model-agnostic entry point: builds the prompts, hands them to the
  // caller-supplied llmCall, and parses the result. llmCall receives
  // {system, user} and may return the raw text or a Promise of it.
  function unpackTopic(topic, opts, llmCall) {
    var prompts;
    try {
      prompts = buildUnpackPrompts(topic, opts);
    } catch (e) {
      return Promise.reject(e);
    }
    if (typeof llmCall !== 'function') {
      return Promise.reject(new Error('unpackTopic: llmCall must be a function ' +
        'that performs the LLM call and resolves with the raw response text'));
    }
    return Promise.resolve(prompts).then(llmCall).then(parseTransitions);
  }

  return {
    buildUnpackPrompts: buildUnpackPrompts,
    parseTransitions: parseTransitions,
    unpackTopic: unpackTopic,
    attachMisconceptions: attachMisconceptions,
    UNPACK_SYSTEM_TEMPLATE: UNPACK_SYSTEM_TEMPLATE,
    UNPACK_USER_TEMPLATE: UNPACK_USER_TEMPLATE
  };
});
