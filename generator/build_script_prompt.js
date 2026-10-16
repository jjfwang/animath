/* animath teacher script prompt builder - turns a teaching topic into LLM
 * prompts for a teacher script (Materials Phase 3b, issue #764).
 * Companion to generator/build_worksheet_prompt.js (worksheets): same UMD
 * wrapper, same level labels and tone wording, same fill() helper, same
 * transition normalization, and the same misconception bank lookup reused
 * through build_prompt.js's exported misconceptionFor. Zero
 * dependencies, ASCII only. Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathScriptPrompt = api;
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
    'watchFor fields: name the classic wrong turn, say why students slip into ' +
    'it, and land the correct turn.';

  var WATER_CYCLE_SCRIPT_EXEMPLAR_OBJ = {
    title: 'The Water Cycle', level: 'primary', subject: 'science', topic: 'water-cycle',
    segments: [
      {
        minutes: 5, say: 'Ask the class where the water in a dried-up puddle went. Take two or three answers without correcting them yet.',
        cue: 's1', questions: ['Where did the puddle water go?'],
        watchFor: 'Water disappears for good once it evaporates. Note who says the water is gone for good; that is the misconception to confront in the next segment.'
      },
      {
        minutes: 10, say: 'Show evaporation and condensation: the sun heats the sea, water rises as invisible vapour, cools high up and gathers as a cloud of tiny drops.',
        cue: 'animation scene s2', questions: ['What is the vapour made of?', 'Why does the vapour turn back into drops high up?']
      },
      {
        minutes: 10, say: 'Show precipitation and collection: drops grow heavy, gravity pulls them down as rain, and the rain gathers in rivers and the sea. Stress that this is the same water, back again.',
        cue: 'student notes handout', questions: ['What makes the drops fall?', 'Where does the rain water gather?'],
        watchFor: 'Students who treat rain as brand-new water still hold the evaporation misconception; send them back to the vapour step.'
      },
      {
        minutes: 5, say: 'Recap the loop in order - evaporation, condensation, precipitation, collection - and have students say the loop back to a partner.',
        questions: ['Say the four stages back in order, starting from the sea.']
      }
    ]
  };
  var WATER_CYCLE_SCRIPT_EXEMPLAR = JSON.stringify(WATER_CYCLE_SCRIPT_EXEMPLAR_OBJ)
    .split('}}').join('} }');

  var SCRIPT_SYSTEM_TEMPLATE = [
    'You are animath\'s script author. You write teacher scripts',
    'for Singapore lessons as JSON documents following the animath',
    'teacher script spec (SPEC.md "Teacher script spec"). A script is',
    'the timed plan a teacher follows while teaching the topic.',
    '',
    'HARD RULES - violate any of these and the script is rejected:',
    '1. Return ONLY the script JSON. No markdown fences, no commentary.',
    '2. Script fields, exactly: title, level, subject, topic, segments.',
    '3. Each segment carries minutes (a positive number) and say (what the teacher says, in the teacher\'s voice), plus optional cue, questions and watchFor.',
    '4. The segment minutes sum to 5-120: plan a real lesson length, and make the minutes across all segments add up inside 5-120 minutes.',
    '5. The cue names a scene id or a material (for example an animation scene id, a slide, the student notes, or a worksheet) the teacher shows or hands out in that segment - omit cue only when nothing is shown.',
    '6. Questions are the exact questions the teacher asks in the segment, worded so they can be read aloud as written.',
    '7. watchFor is keyed to the misconception: it names the student response or wrong turn to listen for (the user message names the beat) and what it tells the teacher.',
    '8. Write for a {{LEVEL_LABEL}} class. Tone: {{TONE}}.',
    '   No jargon above the level in what students hear. Short sentences.',
    '',
    'SCRIPT DESIGN:',
    '- Open by surfacing what students already think, then teach the mechanism in order, then recap.',
    '- Say is spoken language, not slide text: short spoken sentences a teacher can deliver as written.',
    '- Time honestly: a segment that asks questions needs minutes for students to answer.',
    '',
    'QUALITY GATES - what separates a hand-authored script from a sloppy plan:',
    '- Every segment earns its minutes: say, questions and cues move the mechanism forward.',
    '- watchFor keyed to the misconception wherever the misconception can surface, so the teacher hears the wrong turn when it happens.',
    '- Cues name a real scene id or material, never a vague "show the diagram".',
    '- The minutes sum to 5-120 and the segments run in teaching order.',
    '',
    'WORKED EXAMPLE - hand-authored water-cycle script, trimmed',
    '(timed segments in order, cues naming scenes and materials,',
    'watchFor naming the evaporation misconception). Match this quality bar:',
    WATER_CYCLE_SCRIPT_EXEMPLAR
  ].join('\n');

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION SEGMENTS - the topic has been unpacked into an ordered',
    'list of state transitions (see the user message for the full data).',
    'Cover the transitions in the given order:',
    '1. The segments cover transitions in order: each transition is',
    '   taught in its own segment or in the segment order that follows',
    '   the transition order - never teach a later transition first.',
    '2. The driver must be part of what the teacher says and asks about',
    '   (e.g. the sun\'s heat, cooling, gravity), not only background.',
    '3. A transition carrying a misconception beat gets a watchFor in',
    '   its segment naming that wrong turn.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  var MIN_SCRIPT_TRANSITIONS = 2;
  var MAX_SCRIPT_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  function validateScriptTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildScriptPrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildScriptPrompts: opts.transitions[' + index + '].' +
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
      throw new Error('buildScriptPrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_SCRIPT_TRANSITIONS ||
        transitions.length > MAX_SCRIPT_TRANSITIONS) {
      throw new Error('buildScriptPrompts: opts.transitions must hold ' +
        MIN_SCRIPT_TRANSITIONS + '-' + MAX_SCRIPT_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validateScriptTransition(transitions[i], i));
    }
    return out;
  }

  var BEAT_FIELDS = ['wrongTurn', 'why', 'correctTurn'];

  function validateBeat(beat, index) {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
      throw new Error('buildScriptPrompts: opts.misconceptions[' + index + '] must be ' +
        'an object with non-empty wrongTurn, why, correctTurn');
    }
    var out = {};
    for (var i = 0; i < BEAT_FIELDS.length; i++) {
      var field = BEAT_FIELDS[i];
      var value = beat[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildScriptPrompts: opts.misconceptions[' + index + '].' +
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
      throw new Error('buildScriptPrompts: opts.misconceptions must be an array of ' +
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
      'Ordered state transitions - cover these transitions in the segments, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
      if (t.misconception) {
        var m = t.misconception;
        lines.push('   * This transition carries the topic misconception beat (key the watchFor to it):');
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
      'Script misconception - key the watchFor fields to this beat:'
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

  function buildScriptPrompts(opts) {
    opts = opts || {};
    if (!opts.subject) {
      throw new Error('buildScriptPrompts: subject is required');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    var beats = resolveBeats(opts);
    var workedExample = null;
    if (opts.workedExample !== undefined && opts.workedExample !== null) {
      if (typeof opts.workedExample !== 'string' || !opts.workedExample.trim()) {
        throw new Error('buildScriptPrompts: opts.workedExample must be a non-empty string when present');
      }
      workedExample = opts.workedExample;
    }
    var system = fill(SCRIPT_SYSTEM_TEMPLATE, {
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
      'Write the teacher script JSON now. Timed segments whose minutes ' +
        'sum to 5-120, cues naming scene ids or materials, questions to ' +
        'ask aloud, and watchFor keyed to the misconception.'
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    user += misconceptionUserBlock(beats);
    if (workedExample) {
      user += '\n\nWorked example for this topic - adapt its structure and quality, do not copy it verbatim:\n' + workedExample;
    }
    return { system: system, user: user };
  }

  return {
    buildScriptPrompts: buildScriptPrompts,
    SCRIPT_SYSTEM_TEMPLATE: SCRIPT_SYSTEM_TEMPLATE,
    WATER_CYCLE_SCRIPT_EXEMPLAR: WATER_CYCLE_SCRIPT_EXEMPLAR
  };
});
