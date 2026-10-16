/* animath worksheet prompt builder - turns a teaching topic into LLM
 * prompts for a practice worksheet (Materials Phase 2b, issue #756).
 * Companion to generator/build_slides_prompt.js (slide decks): same UMD
 * wrapper, same level labels and tone wording, same fill() helper, same
 * transition normalization, and the same misconception bank lookup reused
 * through build_prompt.js's exported misconceptionFor. Zero
 * dependencies, ASCII only. Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathWorksheetPrompt = api;
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

  // The misconception lookup is reused from build_prompt.js: in Node we
  // require it; in the browser the page loads build_prompt.js before this
  // file so globalThis.AnimathPrompt is set. Missing either way degrades
  // to a null lookup (the generic misconception line) instead of failing.
  var BUILD_PROMPT = (function () {
    if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
      try { return require('./build_prompt.js'); } catch (e) { return null; }
    } /* node:coverage ignore next */
    return (typeof window !== 'undefined' ? window : globalThis).AnimathPrompt || null;
  })();

  function bankBeat(topicSlug, facetHint) {
    if (!BUILD_PROMPT || typeof BUILD_PROMPT.misconceptionFor !== 'function') return null;
    var entry = BUILD_PROMPT.misconceptionFor(topicSlug, facetHint);
    if (!entry) return null;
    if (!entry.wrongTurn || !entry.why || !entry.correctTurn) return null;
    return { wrongTurn: entry.wrongTurn, why: entry.why, correctTurn: entry.correctTurn };
  }

  var GENERIC_MISCONCEPTION_LINE =
    'Address exactly one common misconception for the topic in the ' +
    'questions: name the classic wrong turn, say why students slip into ' +
    'it, and land the correct turn.';

  // Trimmed exemplar: the hand-authored gold worksheet
  // (samples/worksheets/primary-science-water-cycle.json) trimmed by
  // hand - fewer questions, shorter explanations - so it is itself a
  // complete worksheet passing validateWorksheet. Kept as a JS object
  // literal and compacted with JSON.stringify so the module works
  // unchanged in the browser and in Node.
  var WATER_CYCLE_WORKSHEET_EXEMPLAR_OBJ = {
    title: 'The Water Cycle', level: 'primary', subject: 'science', topic: 'water-cycle',
    questions: [
      {
        id: 'q1', prompt: 'What happens to the water in a puddle on a sunny day?', kind: 'multiple-choice',
        choices: [
          { text: 'It disappears for good' },
          { text: 'It turns into invisible water vapour', correct: true },
          { text: 'It turns into soil' }
        ],
        explanation: 'The sun heats the water and it turns into invisible water vapour - it does not disappear for good. The choice "It disappears for good" encodes the misconception that water disappears for good once it evaporates: the water is still there as vapour and returns as rain.',
        misconception: 'Water disappears for good once it evaporates.'
      },
      {
        id: 'q2', prompt: 'Name the stage where water vapour cools and forms a cloud.', kind: 'short-answer',
        answer: 'Condensation',
        explanation: 'High up the air is cold, so the vapour cools back into tiny liquid drops that gather as a cloud - that cooling stage is condensation.'
      }
    ]
  };
  var WATER_CYCLE_WORKSHEET_EXEMPLAR = JSON.stringify(WATER_CYCLE_WORKSHEET_EXEMPLAR_OBJ)
    // Keep the built system prompt free of "}}" (no {{ }} placeholder may
    // survive the fill): JSON whitespace is insignificant, so separate
    // adjacent closing braces with a space, as build_slides_prompt.js
    // does.
    .split('}}').join('} }');

  var WORKSHEET_SYSTEM_TEMPLATE = [
    'You are animath\'s worksheet author. You write practice worksheets',
    'for Singapore students as JSON documents following the animath',
    'worksheet spec (SPEC.md "Worksheet spec"). A worksheet is answered',
    'on paper or in class, and the teacher marks it with the answer key.',
    '',
    'HARD RULES - violate any of these and the worksheet is rejected:',
    '1. Return ONLY the worksheet JSON. No markdown fences, no commentary.',
    '2. Worksheet fields, exactly: title, level, subject, topic, questions.',
    '3. Question shape, exactly: id, prompt, kind, plus choices for a',
    '   multiple-choice question or answer for a short-answer question,',
    '   plus explanation on every question and misconception where the',
    '   question targets one.',
    '4. Question kinds, exactly: multiple-choice|short-answer.',
    '5. A multiple-choice question has at least 2 choices with exactly one',
    '   choice marked correct: true; every other choice omits correct or',
    '   sets it to false - exactly one correct choice, never zero, never two.',
    '6. A short-answer question requires a non-empty answer: the expected',
    '   answer the teacher marks against.',
    '7. Distractors are built from the named misconception: each wrong',
    '   multiple-choice option encodes the topic misconception (the user',
    '   message names the beat) or another named wrong turn - never a',
    '   random wrong answer.',
    '8. The answer key is a per-question explanation on every question:',
    '   each explanation states why the answer is correct and names the',
    '   misconception each wrong option encodes; set the question',
    '   misconception field wherever the question targets a misconception.',
    '9. Write for a {{LEVEL_LABEL}} student. Tone: {{TONE}}.',
    '   No jargon above the level. Short sentences.',
    '',
    'QUESTION DESIGN:',
    '- Mix multiple-choice and short-answer questions: multiple-choice for',
    '  quick checks with misconception distractors, short-answer where the',
    '  student must produce the term or the reasoning.',
    '- Order questions so they follow the topic: name the stages or steps',
    '  before asking students to explain them.',
    '- Every question stands alone: a student who missed the lesson can',
    '  still read what is being asked.',
    '',
    'QUALITY GATES - what separates a hand-authored worksheet from a sloppy one:',
    '- Distractors from the misconception, not random errors: a wrong',
    '  option a student picks tells the teacher which wrong turn they took.',
    '- The explanation is the answer key: it justifies the correct answer',
    '  and names the misconception behind each wrong option.',
    '- One idea per question: a question that tests two ideas marks neither.',
    '- The misconception field is set wherever a question targets the',
    '  topic misconception, so the teacher can group the misses.',
    '',
    'WORKED EXAMPLE - hand-authored water-cycle worksheet, trimmed',
    '(mixed question kinds, distractors encoding the misconception, the',
    'answer key naming it). Match this quality bar:',
    WATER_CYCLE_WORKSHEET_EXEMPLAR
  ].join('\n');

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION QUESTIONS - the topic has been unpacked into an ordered',
    'list of state transitions (see the user message for the full data).',
    'Cover the transitions in the given order:',
    '1. Author at least one question per transition, in order: the',
    '   question tests that transition - what the subject starts as, what',
    '   it becomes, and what drives the change.',
    '2. The driver must be part of what the question tests (e.g. the',
    '   sun\'s heat, cooling, gravity), not only background reading.',
    '3. A transition carrying a misconception beat gets a question whose',
    '   distractors or expected answer confront that wrong turn.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  // Transition normalization mirrors build_slides_prompt.js exactly:
  // 2-8 items, non-empty name/from_state/to_state/driver (trimmed), an
  // optional misconception beat rides through; absent/empty -> null,
  // malformed -> descriptive throw.
  var MIN_WORKSHEET_TRANSITIONS = 2;
  var MAX_WORKSHEET_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  function validateWorksheetTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildWorksheetPrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildWorksheetPrompts: opts.transitions[' + index + '].' +
          field + ' must be a non-empty string');
      }
      out[field] = value.trim();
    }
    if (t.misconception && typeof t.misconception === 'object' && !Array.isArray(t.misconception)) {
      out.misconception = {
        wrongTurn: t.misconception.wrongTurn,
        why: t.misconception.why,
        correctTurn: t.misconception.correctTurn
      };
    }
    return out;
  }

  function normalizeTransitions(transitions) {
    if (transitions === undefined || transitions === null) return null;
    if (!Array.isArray(transitions)) {
      throw new Error('buildWorksheetPrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_WORKSHEET_TRANSITIONS ||
        transitions.length > MAX_WORKSHEET_TRANSITIONS) {
      throw new Error('buildWorksheetPrompts: opts.transitions must hold ' +
        MIN_WORKSHEET_TRANSITIONS + '-' + MAX_WORKSHEET_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validateWorksheetTransition(transitions[i], i));
    }
    return out;
  }

  var BEAT_FIELDS = ['wrongTurn', 'why', 'correctTurn'];

  function validateBeat(beat, index) {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
      throw new Error('buildWorksheetPrompts: opts.misconceptions[' + index + '] must be ' +
        'an object with non-empty wrongTurn, why, correctTurn');
    }
    var out = {};
    for (var i = 0; i < BEAT_FIELDS.length; i++) {
      var field = BEAT_FIELDS[i];
      var value = beat[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildWorksheetPrompts: opts.misconceptions[' + index + '].' +
          field + ' must be a non-empty string');
      }
      out[field] = value.trim();
    }
    return out;
  }

  // Resolved misconception beats for the user block: the bank beat for
  // the topic first (reused from build_prompt.js), then any
  // caller-supplied opts.misconceptions beats appended. Empty array when
  // nothing resolves (generic line).
  function resolveBeats(opts) {
    var beats = [];
    var bank = bankBeat(opts.topic, opts.facet);
    if (bank) beats.push(bank);
    if (opts.misconceptions === undefined || opts.misconceptions === null) return beats;
    if (!Array.isArray(opts.misconceptions)) {
      throw new Error('buildWorksheetPrompts: opts.misconceptions must be an array of ' +
        '{wrongTurn, why, correctTurn}, got ' + typeof opts.misconceptions);
    }
    for (var i = 0; i < opts.misconceptions.length; i++) {
      beats.push(validateBeat(opts.misconceptions[i], i));
    }
    return beats;
  }

  function transitionsUserBlock(transitions) {
    var lines = [
      '',
      '',
      'Ordered state transitions - author at least one question per transition, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
      if (t.misconception) {
        var m = t.misconception;
        lines.push('   * This transition carries the topic misconception beat (build a question around it):');
        lines.push('     Wrong turn: ' + m.wrongTurn);
        lines.push('     Why students slip: ' + m.why);
        lines.push('     Show the correct turn: ' + m.correctTurn);
      }
    }
    return lines.join('\n');
  }

  function misconceptionUserBlock(beats) {
    var lines = [
      '',
      '',
      'Worksheet misconception - build the distractors and the answer key around this beat:'
    ];
    if (beats.length === 0) {
      lines.push(GENERIC_MISCONCEPTION_LINE);
      return lines.join('\n');
    }
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      lines.push('Wrong turn: ' + b.wrongTurn);
      lines.push('Why students slip: ' + b.why);
      lines.push('Correct turn: ' + b.correctTurn);
    }
    return lines.join('\n');
  }

  // opts: {level, subject, topic, topicLabel, focus, facet, transitions,
  // misconceptions, workedExample}
  function buildWorksheetPrompts(opts) {
    opts = opts || {};
    if (!opts.subject) {
      throw new Error('buildWorksheetPrompts: subject is required');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    var beats = resolveBeats(opts);
    var workedExample = null;
    if (opts.workedExample !== undefined && opts.workedExample !== null) {
      if (typeof opts.workedExample !== 'string' || !opts.workedExample.trim()) {
        throw new Error('buildWorksheetPrompts: opts.workedExample must be a non-empty string when present');
      }
      workedExample = opts.workedExample;
    }
    var system = fill(WORKSHEET_SYSTEM_TEMPLATE, {
      LEVEL_LABEL: LEVEL_LABELS[level] || level,
      TONE: LEVEL_TONE[level] || LEVEL_TONE.secondary
    });
    if (transitions) system += TRANSITION_SYSTEM_BLOCK;
    var user = [
      'Level: ' + level + ' (' + (LEVEL_LABELS[level] || level) + ')',
      'Subject: ' + opts.subject,
      'Topic: ' + (opts.topicLabel || opts.topic || '') + ' (' + (opts.topic || '') + ')',
      'Student\'s focus: ' + (opts.focus || '(none given)'),
      '',
      'Write the worksheet JSON now. Mix multiple-choice and short-answer ' +
        'questions, build the distractors from the misconception, and put ' +
        'an explanation on every question as the answer key.'
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    user += misconceptionUserBlock(beats);
    if (workedExample) {
      user += '\n\nWorked example for this topic - adapt its structure and quality, do not copy it verbatim:\n' + workedExample;
    }
    return { system: system, user: user };
  }

  return {
    buildWorksheetPrompts: buildWorksheetPrompts,
    WORKSHEET_SYSTEM_TEMPLATE: WORKSHEET_SYSTEM_TEMPLATE,
    WATER_CYCLE_WORKSHEET_EXEMPLAR: WATER_CYCLE_WORKSHEET_EXEMPLAR
  };
});
