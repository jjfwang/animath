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
    '  (e.g. show why 1/2 + 1/4 is NOT 2/6).';

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
    '   origin top-left. Colors are CSS hex. (latex: math rendered with KaTeX —',
    '   write plain LaTeX in its "tex" field, e.g. "a^2 + b^2 = c^2".)',
    '6. move supports text | rect | circle | line | arrow | latex | polygon.',
    '   Every move step needs a numeric dur_ms (milliseconds). to must carry',
    '   at least one field valid for the target kind: x/y for text/rect/latex,',
    '   cx/cy for circle, x1/y1/x2/y2 for line/arrow, points for polygon (an',
    '   array of [x,y] pairs, same length as the shape\'s points) — plus',
    '   w/h for rect and r for circle (size fields allowed, alone or with',
    '   position fields). hide/move/emphasize targets must be shown earlier in the SAME scene.',
    '7. Math notation: prefer the latex shape kind where unicode math breaks',
    '   down (fractions, stacked notation, algebra); text shapes stay UNICODE',
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
    '  No jargon above the level. Short sentences.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  // opts: {level, subject, topic, topicLabel, kind, focus, facet}
  function buildPrompts(opts) {
    var level = opts.level || 'primary';
    var system = fill(SYSTEM_TEMPLATE, {
      LEVEL_LABEL: LEVEL_LABELS[level] || level,
      TONE: LEVEL_TONE[level] || LEVEL_TONE.secondary,
      MISCONCEPTION_LINE: misconceptionLine(opts.topic, opts.facet)
    });
    var user = [
      'Level: ' + level + ' (' + (LEVEL_LABELS[level] || level) + ')',
      'Subject: ' + (opts.subject || 'math'),
      'Topic: ' + (opts.topicLabel || opts.topic || '') + ' (' + (opts.topic || '') + ')',
      'Kind: ' + (opts.kind || 'concept'),
      'Student\'s focus: ' + (opts.focus || '(none given)'),
      '',
      'Write the animation spec JSON now. ' + (KIND_GUIDANCE[opts.kind] || KIND_GUIDANCE.concept)
    ].join('\n');
    return { system: system, user: user };
  }

  return {
    buildPrompts: buildPrompts,
    misconceptionFor: misconceptionFor,
    LEVEL_LABELS: LEVEL_LABELS
  };
});
