/* animath student notes prompt builder - turns a teaching topic into LLM
 * prompts for student notes (Materials Phase 3b, issue #764).
 * Companion to generator/build_worksheet_prompt.js (worksheets): same UMD
 * wrapper, same level labels and tone wording, same fill() helper, same
 * transition normalization, and the same misconception bank lookup reused
 * through build_prompt.js's exported misconceptionFor. Zero
 * dependencies, ASCII only. Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathNotesPrompt = api;
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
    'trap: name the classic wrong turn, say why students slip into ' +
    'it, and land the correct turn.';

  var WATER_CYCLE_NOTES_EXEMPLAR_OBJ = {
    title: 'The Water Cycle', level: 'primary', subject: 'science', topic: 'water-cycle',
    objectives: ['Name the four stages of the water cycle in order', 'Explain why evaporated water is not gone for good'],
    definitions: [
      { term: 'Evaporation', meaning: 'Liquid water turning into invisible water vapour when heated.' },
      { term: 'Condensation', meaning: 'Water vapour cooling back into tiny liquid drops.' },
      { term: 'Precipitation', meaning: 'Water falling back to the ground as rain.' },
      { term: 'Collection', meaning: 'Fallen water gathering in rivers, lakes and the sea.' }
    ],
    mechanismSteps: [
      'Evaporation: the sun heats liquid water and it rises as invisible water vapour.',
      'Condensation: high up, the vapour cools into tiny liquid drops that form a cloud.',
      'Precipitation: the drops grow too heavy to float and gravity pulls them down as rain.',
      'Collection: the fallen water gathers in rivers and the sea, ready to evaporate again.'
    ],
    workedExample: 'A puddle on a sunny day: the sun heats it, the water rises as vapour, cools into a cloud, and later falls back as rain on the same ground.',
    trap: {
      misconception: 'Water disappears for good once it evaporates.',
      explanation: 'The water only looks gone because vapour is invisible. It is still there in the air, cools into clouds, and falls back as rain - it never leaves the cycle.'
    }
  };
  var WATER_CYCLE_NOTES_EXEMPLAR = JSON.stringify(WATER_CYCLE_NOTES_EXEMPLAR_OBJ)
    .split('}}').join('} }');

  var NOTES_SYSTEM_TEMPLATE = [
    'You are animath\'s notes author. You write student notes',
    'for Singapore students as JSON documents following the animath',
    'student notes spec (SPEC.md "Student notes spec"). The notes are',
    'a one-page study sheet a student reads before or after a lesson.',
    '',
    'HARD RULES - violate any of these and the notes are rejected:',
    '1. Return ONLY the notes JSON. No markdown fences, no commentary.',
    '2. Notes fields, exactly: title, level, subject, topic, objectives, definitions, mechanismSteps, workedExample, trap.',
    '3. Definitions are {term, meaning} objects built from the key vocabulary of the topic: every key term a student must know gets one definition with a plain meaning.',
    '4. The trap is a {misconception, explanation} object: the misconception names the beat (the classic wrong turn for the topic) and the explanation says why it is wrong and what to do instead.',
    '5. Student-facing one-page tone: write directly to the student, short enough to fit one page. No teacher-only language - no marking notes, no lesson plans, no instructions to a teacher.',
    '6. Objectives are short student-facing goals: what the student will be able to do after reading the notes.',
    '7. Write for a {{LEVEL_LABEL}} student. Tone: {{TONE}}.',
    '   No jargon above the level. Short sentences.',
    '',
    'NOTES DESIGN:',
    '- Definitions first, in the order the terms appear in the mechanism.',
    '- mechanismSteps tell the mechanism as a story in order: each step names what changes, what it becomes, and what drives the change.',
    '- The workedExample walks through one concrete case from start to finish, using the definitions.',
    '- The trap closes the notes: name the misconception plainly, then correct it.',
    '',
    'QUALITY GATES - what separates hand-authored notes from a sloppy summary:',
    '- Definitions from the key vocabulary, not random terms: a student can revise every stage from the definitions alone.',
    '- One idea per mechanism step, in mechanism order.',
    '- The trap names the beat and why it is wrong, not just that it is wrong.',
    '- Student-facing throughout: if a sentence only helps a teacher, cut it.',
    '',
    'WORKED EXAMPLE - hand-authored water-cycle notes, trimmed',
    '(definitions covering the cycle vocabulary, one mechanism step per',
    'stage, the trap naming the evaporation misconception). Match this quality bar:',
    WATER_CYCLE_NOTES_EXEMPLAR
  ].join('\n');

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION STEPS - the topic has been unpacked into an ordered',
    'list of state transitions (see the user message for the full data).',
    'Cover the transitions in the given order:',
    '1. Write exactly one mechanismStep per transition, in order: the',
    '   step states what the subject starts as, what it becomes, and',
    '   what drives the change.',
    '2. The driver must appear in its step (e.g. the sun\'s heat,',
    '   cooling, gravity), not only in the definitions.',
    '3. A transition carrying a misconception beat is where the trap',
    '   belongs: the trap names that beat and why it is wrong.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  var MIN_NOTES_TRANSITIONS = 2;
  var MAX_NOTES_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  function validateNotesTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildNotesPrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildNotesPrompts: opts.transitions[' + index + '].' +
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
      throw new Error('buildNotesPrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_NOTES_TRANSITIONS ||
        transitions.length > MAX_NOTES_TRANSITIONS) {
      throw new Error('buildNotesPrompts: opts.transitions must hold ' +
        MIN_NOTES_TRANSITIONS + '-' + MAX_NOTES_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validateNotesTransition(transitions[i], i));
    }
    return out;
  }

  var BEAT_FIELDS = ['wrongTurn', 'why', 'correctTurn'];

  function validateBeat(beat, index) {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
      throw new Error('buildNotesPrompts: opts.misconceptions[' + index + '] must be ' +
        'an object with non-empty wrongTurn, why, correctTurn');
    }
    var out = {};
    for (var i = 0; i < BEAT_FIELDS.length; i++) {
      var field = BEAT_FIELDS[i];
      var value = beat[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildNotesPrompts: opts.misconceptions[' + index + '].' +
          field + ' must be a non-empty string');
      }
      out[field] = value.trim();
    }
    return out;
  }

  function resolveBeats(opts) {
    var beats = [];
    var bank = bankBeat(opts.topic, opts.facet);
    if (bank) beats.push(bank);
    if (opts.misconceptions === undefined || opts.misconceptions === null) return beats;
    if (!Array.isArray(opts.misconceptions)) {
      throw new Error('buildNotesPrompts: opts.misconceptions must be an array of ' +
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
      'Ordered state transitions - write exactly one mechanism step per transition, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
      if (t.misconception) {
        var m = t.misconception;
        lines.push('   * This transition carries the topic misconception beat (build the trap around it):');
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
      'Notes misconception - build the trap around this beat:'
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

  function buildNotesPrompts(opts) {
    opts = opts || {};
    if (!opts.subject) {
      throw new Error('buildNotesPrompts: subject is required');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    var beats = resolveBeats(opts);
    var workedExample = null;
    if (opts.workedExample !== undefined && opts.workedExample !== null) {
      if (typeof opts.workedExample !== 'string' || !opts.workedExample.trim()) {
        throw new Error('buildNotesPrompts: opts.workedExample must be a non-empty string when present');
      }
      workedExample = opts.workedExample;
    }
    var system = fill(NOTES_SYSTEM_TEMPLATE, {
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
      'Write the student notes JSON now. Definitions from the key ' +
        'vocabulary, mechanism steps in order, a worked example, and ' +
        'the trap naming the misconception and why it is wrong.'
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    user += misconceptionUserBlock(beats);
    if (workedExample) {
      user += '\n\nWorked example for this topic - adapt its structure and quality, do not copy it verbatim:\n' + workedExample;
    }
    return { system: system, user: user };
  }

  return {
    buildNotesPrompts: buildNotesPrompts,
    NOTES_SYSTEM_TEMPLATE: NOTES_SYSTEM_TEMPLATE,
    WATER_CYCLE_NOTES_EXEMPLAR: WATER_CYCLE_NOTES_EXEMPLAR
  };
});
