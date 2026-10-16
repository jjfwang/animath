/* animath exit-ticket prompt builder - turns a teaching topic into LLM
 * prompts for a short end-of-lesson exit ticket (Materials Phase 2b,
 * issue #756). Companion to generator/build_slides_prompt.js (slide
 * decks): same UMD wrapper, same level labels and tone wording, same
 * fill() helper, same transition normalization, and the same
 * misconception bank lookup reused through build_prompt.js's exported
 * misconceptionFor. Zero dependencies, ASCII only. Works in browser
 * and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathExitTicketPrompt = api;
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
    'it, and land the correct turn in the feedback.';

  // Trimmed exemplar: the hand-authored gold exit ticket
  // (samples/tickets/primary-science-water-cycle.json) trimmed by hand -
  // shorter feedback - so it is itself a complete exit ticket passing
  // validateExitTicket (3-5 questions). Kept as a JS object literal and
  // compacted with JSON.stringify so the module works unchanged in the
  // browser and in Node.
  var WATER_CYCLE_TICKET_EXEMPLAR_OBJ = {
    title: 'The Water Cycle Exit Ticket', level: 'primary', subject: 'science', topic: 'water-cycle',
    questions: [
      {
        id: 'q1', prompt: 'A puddle dries up on a sunny day. Where did the water go?', kind: 'multiple-choice',
        choices: [
          { text: 'It disappeared for good' },
          { text: 'It became invisible water vapour', correct: true },
          { text: 'It soaked away forever' }
        ],
        feedback: 'If you picked "disappeared for good", that is the evaporation trap: the water is still there as invisible vapour and will return as rain. Water disappears for good once it evaporates is the wrong turn - it never leaves the cycle.',
        misconception: 'Water disappears for good once it evaporates.'
      },
      {
        id: 'q2', prompt: 'Name the stage where water vapour cools into tiny drops and forms a cloud.', kind: 'short-answer',
        answer: 'Condensation',
        feedback: 'Condensation is the cooling stage: vapour back into liquid drops. If you named evaporation, the cooling half of the loop needs reteaching.'
      },
      {
        id: 'q3', prompt: 'In one sentence, explain why rain shows evaporated water is not gone for good.', kind: 'short-answer',
        answer: 'Evaporated water becomes vapour, cools into clouds and falls back as rain, so it was never gone.',
        feedback: 'A strong answer names vapour and the return as rain. An answer with no vapour means the evaporation step needs reteaching.'
      }
    ]
  };
  var WATER_CYCLE_TICKET_EXEMPLAR = JSON.stringify(WATER_CYCLE_TICKET_EXEMPLAR_OBJ)
    // Keep the built system prompt free of "}}" (no {{ }} placeholder may
    // survive the fill): JSON whitespace is insignificant, so separate
    // adjacent closing braces with a space, as build_slides_prompt.js
    // does.
    .split('}}').join('} }');

  var EXIT_TICKET_SYSTEM_TEMPLATE = [
    'You are animath\'s exit-ticket author. You write short end-of-lesson',
    'exit tickets for Singapore students as JSON documents following the',
    'animath exit ticket spec (SPEC.md "Exit ticket spec"). An exit',
    'ticket is answered in the last minutes of a lesson: its answers tell',
    'the teacher what to reteach next lesson.',
    '',
    'HARD RULES - violate any of these and the exit ticket is rejected:',
    '1. Return ONLY the exit-ticket JSON. No markdown fences, no commentary.',
    '2. Exit ticket fields, exactly: title, level, subject, topic, questions.',
    '3. Exactly 3-5 questions - no more, no fewer.',
    '4. Question shape, exactly: id, prompt, kind, plus choices for a',
    '   multiple-choice question or answer for a short-answer question,',
    '   plus feedback on every question and misconception where the',
    '   question targets one.',
    '5. Question kinds, exactly: multiple-choice|short-answer.',
    '6. A multiple-choice question has at least 2 choices with exactly one',
    '   choice marked correct: true; every other choice omits correct or',
    '   sets it to false - exactly one correct choice, never zero, never two.',
    '7. A short-answer question requires a non-empty answer: the expected',
    '   answer the teacher checks against.',
    '8. Put a per-answer feedback field on every question: the feedback',
    '   tells the student what their answer shows and is keyed to the',
    '   misconception - set the question misconception field wherever the',
    '   question targets a misconception, and write the feedback so it',
    '   names that wrong turn and the correct turn.',
    '9. Quick formative tone: short, end-of-lesson questions a student',
    '   can answer in a minute each, whose answers tell the teacher what',
    '   to reteach next lesson. No long multi-part questions.',
    '10. Write for a {{LEVEL_LABEL}} student. Tone: {{TONE}}.',
    '    No jargon above the level. Short sentences.',
    '',
    'QUESTION DESIGN:',
    '- Cover the lesson objective and nothing else: each question checks',
    '  one thing the lesson set out to teach.',
    '- At least one question must confront the topic misconception head',
    '  on, so a wrong answer reveals the wrong turn, not carelessness.',
    '- Mix multiple-choice and short-answer where it helps: a short-answer',
    '  question shows reasoning a choice cannot.',
    '',
    'QUALITY GATES - what separates a hand-authored exit ticket from a sloppy one:',
    '- Feedback on every question, keyed to the misconception: the',
    '  feedback says what the answer shows and what the correct turn is.',
    '- Formative, not summative: the ticket sorts what landed from what',
    '  to reteach - it never tries to grade the whole topic.',
    '- One idea per question, answerable in about a minute.',
    '- The misconception field is set wherever a question targets the',
    '  topic misconception, so the teacher can count the misses at a glance.',
    '',
    'WORKED EXAMPLE - hand-authored water-cycle exit ticket, trimmed',
    '(3 questions, feedback on every question keyed to the evaporation',
    'misconception). Match this quality bar:',
    WATER_CYCLE_TICKET_EXEMPLAR
  ].join('\n');

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION QUESTIONS - the topic has been unpacked into an ordered',
    'list of state transitions (see the user message for the full data).',
    'Sample the transitions in the given order:',
    '1. Key the questions to the transitions in order: each question',
    '   checks one transition - what the subject starts as, what it',
    '   becomes, and what drives the change.',
    '2. With 3-5 questions and more transitions, prefer the transitions',
    '   carrying a misconception beat and the lesson objective.',
    '3. A transition carrying a misconception beat gets a question whose',
    '   feedback confronts that wrong turn.'
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
  var MIN_TICKET_TRANSITIONS = 2;
  var MAX_TICKET_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  function validateTicketTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildExitTicketPrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildExitTicketPrompts: opts.transitions[' + index + '].' +
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
      throw new Error('buildExitTicketPrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_TICKET_TRANSITIONS ||
        transitions.length > MAX_TICKET_TRANSITIONS) {
      throw new Error('buildExitTicketPrompts: opts.transitions must hold ' +
        MIN_TICKET_TRANSITIONS + '-' + MAX_TICKET_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validateTicketTransition(transitions[i], i));
    }
    return out;
  }

  var BEAT_FIELDS = ['wrongTurn', 'why', 'correctTurn'];

  function validateBeat(beat, index) {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
      throw new Error('buildExitTicketPrompts: opts.misconceptions[' + index + '] must be ' +
        'an object with non-empty wrongTurn, why, correctTurn');
    }
    var out = {};
    for (var i = 0; i < BEAT_FIELDS.length; i++) {
      var field = BEAT_FIELDS[i];
      var value = beat[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildExitTicketPrompts: opts.misconceptions[' + index + '].' +
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
      throw new Error('buildExitTicketPrompts: opts.misconceptions must be an array of ' +
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
      'Ordered state transitions - key the questions to these transitions, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
      if (t.misconception) {
        var m = t.misconception;
        lines.push('   * This transition carries the topic misconception beat (key a question and its feedback to it):');
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
      'Exit-ticket misconception - key the feedback on every targeted question to this beat:'
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
  function buildExitTicketPrompts(opts) {
    opts = opts || {};
    if (!opts.subject) {
      throw new Error('buildExitTicketPrompts: subject is required');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    var beats = resolveBeats(opts);
    var workedExample = null;
    if (opts.workedExample !== undefined && opts.workedExample !== null) {
      if (typeof opts.workedExample !== 'string' || !opts.workedExample.trim()) {
        throw new Error('buildExitTicketPrompts: opts.workedExample must be a non-empty string when present');
      }
      workedExample = opts.workedExample;
    }
    var system = fill(EXIT_TICKET_SYSTEM_TEMPLATE, {
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
      'Write the exit-ticket JSON now. Exactly 3-5 short questions, ' +
        'feedback on every question keyed to the misconception, in a ' +
        'quick formative tone that shows what to reteach.'
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    user += misconceptionUserBlock(beats);
    if (workedExample) {
      user += '\n\nWorked example for this topic - adapt its structure and quality, do not copy it verbatim:\n' + workedExample;
    }
    return { system: system, user: user };
  }

  return {
    buildExitTicketPrompts: buildExitTicketPrompts,
    EXIT_TICKET_SYSTEM_TEMPLATE: EXIT_TICKET_SYSTEM_TEMPLATE,
    WATER_CYCLE_TICKET_EXEMPLAR: WATER_CYCLE_TICKET_EXEMPLAR
  };
});
