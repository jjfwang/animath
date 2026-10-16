/* animath slide prompt builder - turns a teaching topic into LLM prompts
 * for a slide deck (Materials Phase 1b, issue #745). Companion to
 * generator/build_prompt.js (animation specs): same UMD wrapper, same
 * level labels and tone wording, same fill() helper, same transition
 * normalization, and the same misconception bank lookup reused through
 * build_prompt.js's exported misconceptionFor. Zero dependencies,
 * ASCII only. Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathSlidesPrompt = api;
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
    'Address exactly one common misconception for the topic on the practice ' +
    'and exit-ticket slides: name the classic wrong turn, say why students ' +
    'slip into it, and land the correct turn.';

  // Trimmed exemplar: the hand-authored gold deck
  // (samples/decks/primary-science-water-cycle.json) trimmed by hand -
  // shortened notes and bullets, all 11 slides and their order kept - so
  // it is itself a complete deck passing validateSlides. Kept as a JS
  // object literal and compacted with JSON.stringify so the module works
  // unchanged in the browser and in Node.
  var WATER_CYCLE_DECK_EXEMPLAR_OBJ = {
    title: 'The Water Cycle', level: 'primary', subject: 'science', topic: 'water-cycle',
    slides: [
      { kind: 'title', heading: 'The Water Cycle', bullets: ['How water travels round and round'], notes: 'Say: today we follow one drop of water on a journey that never ends.' },
      { kind: 'objective', heading: 'What we will learn', bullets: ['Name the four stages in order'], notes: 'Say: keep this goal in mind - the exit ticket asks exactly this.' },
      { kind: 'hook', heading: 'Where did the puddle go?', bullets: ['A puddle was here this morning, now it is gone'], notes: 'Ask for guesses and say: hold that idea, it is our first stage.' },
      { kind: 'concept', heading: 'Water changes state', bullets: ['Liquid becomes vapour, vapour becomes liquid'], notes: 'Say: the water changes form, but it never vanishes.' },
      { kind: 'mechanism', heading: 'Evaporation', bullets: ['The sun heats the sea', 'Water rises as vapour'], notes: 'Say: heat lifts the water up, invisible like steam.', visual: 's1' },
      { kind: 'mechanism', heading: 'Condensation', bullets: ['Vapour cools high up', 'Tiny drops form a cloud'], notes: 'Say: cooling turns vapour back into tiny drops.', visual: 's2' },
      { kind: 'mechanism', heading: 'Precipitation', bullets: ['Drops grow heavy', 'They fall as rain'], notes: 'Say: gravity pulls the heavy drops down as rain.', visual: 's3' },
      { kind: 'mechanism', heading: 'Collection', bullets: ['Rain runs into rivers', 'Rivers return it to the sea'], notes: 'Say: the water gathers again, ready to start over.', visual: 's4' },
      { kind: 'example', heading: 'Worked example: trace one drop', bullets: ['Sea to cloud to rain to sea'], notes: 'Walk the drop round the loop and name each stage aloud.' },
      { kind: 'practice', heading: 'Your turn', bullets: ['Order the four stages', 'Water does not disappear once it evaporates - explain why'], notes: 'Ask pairs to argue it out, then press the trap: where does rain come from?' },
      { kind: 'exit-ticket', heading: 'Exit ticket', bullets: ['Explain why evaporated water is not gone for good'], notes: 'Collect answers and scan for the word vapour before they leave.' }
    ]
  };
  var WATER_CYCLE_DECK_EXEMPLAR = JSON.stringify(WATER_CYCLE_DECK_EXEMPLAR_OBJ)
    // Keep the built system prompt free of "}}" (no {{ }} placeholder may
    // survive the fill): JSON whitespace is insignificant, so separate
    // adjacent closing braces with a space, as build_prompt.js does. The
    // 3KB budget counts this form.
    .split('}}').join('} }');

  var SLIDE_SYSTEM_TEMPLATE = [
    'You are animath\'s slide-deck author. You write short teaching slide',
    'decks for Singapore students as JSON documents following the animath',
    'slide spec (SPEC.md "Slide spec"). A deck is taught live by a teacher:',
    'the slides carry the ideas, the speaker notes carry the talking.',
    '',
    'HARD RULES - violate any of these and the deck is rejected:',
    '1. Return ONLY the deck JSON. No markdown fences, no commentary.',
    '2. Deck fields, exactly: title, level, subject, topic, slides.',
    '3. Slide kinds, exactly: title|objective|hook|concept|mechanism|example|practice|exit-ticket.',
    '4. Put title first and exit-ticket last; put the objective before concept/mechanism slides.',
    '5. Each slide: kind, heading (short), bullets (1-3 short lines), notes',
    '   (speaker notes), and optionally visual (an animation scene id string',
    '   such as "s1", or a descriptor with a sceneId or a shape kind).',
    '6. one idea per slide: one heading, one point. If a slide needs two',
    '   headings, split it into two slides.',
    '7. Speaker notes: the notes say what the teacher should SAY aloud, in a',
    '   conversational voice - they never repeat the slide heading or bullets.',
    '8. Address the topic misconception on the practice and exit-ticket',
    '   slides (the user message names the beat): name the wrong turn there,',
    '   where students must act on it, never only on the concept slide.',
    '9. Write for a {{LEVEL_LABEL}} student. Tone: {{TONE}}.',
    '   No jargon above the level. Short sentences.',
    '',
    'DECK STRUCTURE - author the slides in this order:',
    '- title: the topic, framed as a journey or a question.',
    '- objective: what students will be able to do by the end (before any',
    '  concept or mechanism slide).',
    '- hook: an everyday puzzle or surprise that opens the topic.',
    '- concept: the big idea, stated plainly, before the detail.',
    '- mechanism: the step-by-step how-it-works slides (see the transition',
    '  rules when transitions are supplied).',
    '- example: one worked example, talked through end to end.',
    '- practice: students do it themselves, with the misconception trap set.',
    '- exit-ticket: one short check that proves the objective landed.',
    '',
    'MECHANISM SLIDES:',
    '- A mechanism slide shows a state change, not just a label: say what the',
    '  subject starts as, what it becomes, and what drives the change.',
    '- When the topic has been unpacked into transitions, each mechanism',
    '  slide is keyed to exactly one transition (see the transition block',
    '  appended when transitions are supplied).',
    '- A mechanism slide may carry a visual naming the animation scene that',
    '  shows its state change.',
    '',
    'QUALITY GATES - what separates a hand-authored deck from a sloppy one:',
    '- one idea per slide: a slide that teaches two ideas teaches neither.',
    '- Notes, not bullets: the speaker notes are a spoken script, never the',
    '  bullets read back aloud.',
    '- The misconception is placed on the practice and exit-ticket slides,',
    '  where students act on it - not buried on the concept slide.',
    '- Mechanism slides show the state change, not just name it: from-state,',
    '  to-state and driver all appear on the slide.',
    '- Every slide has a heading or bullets - heading-or-bullets on every',
    '  slide, and no slide is heading, bullets and notes saying one thing.',
    '',
    'WORKED EXAMPLE - hand-authored water-cycle deck, trimmed',
    '(all 11 slides in order, notes scripted not repeated, the misconception',
    'worked on the practice and exit-ticket slides). Match this quality bar:',
    WATER_CYCLE_DECK_EXEMPLAR
  ].join('\n');

  var TRANSITION_SYSTEM_BLOCK = [
    '',
    '',
    'TRANSITION MECHANISM SLIDES - the topic has been unpacked into an',
    'ordered list of state transitions (see the user message for the full',
    'data). Author exactly one mechanism slide per transition, in the',
    'given order:',
    '1. Each mechanism slide IS its transition: the heading names the',
    '   transition, and the bullets state the from_state becoming the',
    '   to_state, driven by the driver.',
    '2. The driver must appear on the slide as the cause of the change',
    '   (e.g. the sun\'s heat, cooling, gravity), not just in the notes.',
    '3. Give each mechanism slide a visual naming the animation scene for',
    '   its transition, in order ("s1" for the first, "s2" for the next).'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, function (m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  function validateShape(shape) {
    if (shape === undefined || shape === null) return 'sequence';
    if (['sequence', 'cycle', 'system'].indexOf(shape) < 0) {
      throw new Error('buildSlidePrompts: opts.shape must be one of ' +
        'sequence, cycle, system - got ' + JSON.stringify(shape));
    }
    return shape;
  }

  // Transition normalization mirrors build_prompt.js exactly: 2-8 items,
  // non-empty name/from_state/to_state/driver (trimmed), an optional
  // misconception beat rides through; absent/empty -> null, malformed ->
  // descriptive throw.
  var MIN_SLIDE_TRANSITIONS = 2;
  var MAX_SLIDE_TRANSITIONS = 8;
  var TRANSITION_FIELDS = ['name', 'from_state', 'to_state', 'driver'];

  function validateSlideTransition(t, index) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('buildSlidePrompts: opts.transitions[' + index + '] must be ' +
        'an object with non-empty name, from_state, to_state, driver');
    }
    var out = {};
    for (var i = 0; i < TRANSITION_FIELDS.length; i++) {
      var field = TRANSITION_FIELDS[i];
      var value = t[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildSlidePrompts: opts.transitions[' + index + '].' +
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
      throw new Error('buildSlidePrompts: opts.transitions must be an array of ' +
        '{name, from_state, to_state, driver}, got ' + typeof transitions);
    }
    if (transitions.length === 0) return null;
    if (transitions.length < MIN_SLIDE_TRANSITIONS ||
        transitions.length > MAX_SLIDE_TRANSITIONS) {
      throw new Error('buildSlidePrompts: opts.transitions must hold ' +
        MIN_SLIDE_TRANSITIONS + '-' + MAX_SLIDE_TRANSITIONS +
        ' transitions, got ' + transitions.length);
    }
    var out = [];
    for (var i = 0; i < transitions.length; i++) {
      out.push(validateSlideTransition(transitions[i], i));
    }
    return out;
  }

  var BEAT_FIELDS = ['wrongTurn', 'why', 'correctTurn'];

  function validateBeat(beat, index) {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
      throw new Error('buildSlidePrompts: opts.misconceptions[' + index + '] must be ' +
        'an object with non-empty wrongTurn, why, correctTurn');
    }
    var out = {};
    for (var i = 0; i < BEAT_FIELDS.length; i++) {
      var field = BEAT_FIELDS[i];
      var value = beat[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('buildSlidePrompts: opts.misconceptions[' + index + '].' +
          field + ' must be a non-empty string');
      }
      out[field] = value.trim();
    }
    return out;
  }

  // Resolved misconception beats for the user block: the bank beat for the
  // topic first (reused from build_prompt.js), then any caller-supplied
  // opts.misconceptions beats appended - a supplied beat extends the bank
  // lookup for topics the bank covers loosely, and stands alone when the
  // bank has no entry. Empty array when nothing resolves (generic line).
  function resolveBeats(opts) {
    var beats = [];
    var bank = bankBeat(opts.topic, opts.facet);
    if (bank) beats.push(bank);
    if (opts.misconceptions === undefined || opts.misconceptions === null) return beats;
    if (!Array.isArray(opts.misconceptions)) {
      throw new Error('buildSlidePrompts: opts.misconceptions must be an array of ' +
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
      'Ordered state transitions - author exactly one mechanism slide per transition, in this order:'
    ];
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      lines.push((i + 1) + '. ' + t.name + ': "' + t.from_state + '" -> "' +
        t.to_state + '" (driver: ' + t.driver + ')');
      if (t.misconception) {
        var m = t.misconception;
        lines.push('   * This transition carries the topic misconception beat (worked on the practice and exit-ticket slides):');
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
      'Practice and exit-ticket misconception - address this beat on BOTH the practice slide and the exit-ticket slide:'
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
  // shape, misconceptions, workedExample}
  function buildSlidePrompts(opts) {
    opts = opts || {};
    if (!opts.subject) {
      throw new Error('buildSlidePrompts: subject is required');
    }
    var level = opts.level || 'primary';
    var transitions = normalizeTransitions(opts.transitions);
    validateShape(opts.shape);
    var beats = resolveBeats(opts);
    var workedExample = null;
    if (opts.workedExample !== undefined && opts.workedExample !== null) {
      if (typeof opts.workedExample !== 'string' || !opts.workedExample.trim()) {
        throw new Error('buildSlidePrompts: opts.workedExample must be a non-empty string when present');
      }
      workedExample = opts.workedExample;
    }
    var system = fill(SLIDE_SYSTEM_TEMPLATE, {
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
      'Write the slide deck JSON now. Follow the deck structure in order: ' +
        'title, objective, hook, concept, mechanism, example, practice, exit-ticket.'
    ].join('\n');
    if (transitions) user += transitionsUserBlock(transitions);
    user += misconceptionUserBlock(beats);
    if (workedExample) {
      user += '\n\nWorked example for this topic - adapt its structure and quality, do not copy it verbatim:\n' + workedExample;
    }
    return { system: system, user: user };
  }

  return {
    buildSlidePrompts: buildSlidePrompts,
    SLIDE_SYSTEM_TEMPLATE: SLIDE_SYSTEM_TEMPLATE,
    WATER_CYCLE_DECK_EXEMPLAR: WATER_CYCLE_DECK_EXEMPLAR
  };
});
