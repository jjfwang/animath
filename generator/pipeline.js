/* animath generate pipeline — slice 5 of the generate pipeline (issue #693).
 *
 * Prompt in, animation out: runs the unpack -> author -> repair stages
 * automatically inside the engine (owner direction 2026-10-12: no
 * confirm/edit-phases UI step). The pipeline is model-agnostic — all LLM
 * traffic goes through the caller-supplied deps.callChat(system, user), all
 * validation through deps.validate(spec); this module makes no network
 * calls of its own, so it is fully mockable in tests and works in browser
 * and Node.
 *
 * Repair semantics mirror llm_client.js generateSpecWithRepair (default 3
 * repair passes; invalid JSON counts as a failed attempt; the final failure
 * rejects with an Error carrying err.problems), reimplemented against
 * deps.callChat because generateSpecWithRepair does its own fetching.
 *
 * generateSlides (issue #747) is the slide-deck sibling: the same unpack
 * stage and repair discipline, but the author prompts come from
 * build_slides_prompt.js and validation runs through validateSlides
 * (deps.validateSlides, else deps.validate, else the built-in
 * player/validate.js validateSlides).
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.AnimathPipeline = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Sibling generator modules — the build_prompt.js pattern: Node require()
  // with an early return, then a straight-line browser-global fallback
  // (web/index.html loads unpack.js and build_prompt.js before this file).
  // A missing unpack.js script tag degrades inside unpackStage to the
  // no-transitions path (today's behavior); a missing build_prompt.js
  // rejects at the buildPrompts call. Neither case fails silently.
  var SIBLINGS = (function () {
    if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
      return {
        unpack: require('./unpack.js'),
        prompt: require('./build_prompt.js'),
        slidesPrompt: require('./build_slides_prompt.js'),
        validate: require('../player/validate.js')
      };
    }
    var g = (typeof window !== 'undefined' ? window : globalThis);
    return {
      unpack: g.AnimathUnpack,
      prompt: g.AnimathPrompt,
      slidesPrompt: g.AnimathSlidesPrompt,
      validate: g.AnimathValidate
    };
  })();

  var DEFAULT_MAX_REPAIRS = 3;

  // Per-kind wording for the shared author/repair loop. The animation
  // strings are byte-identical to the original pipeline wording (existing
  // tests assert them); the slide variants say "slide deck".
  var ANIMATION_KIND = {
    notJsonProblem: 'The response was not valid JSON. Return ONLY the corrected animation spec as JSON.',
    repairHeader: 'Your previous response did not produce a valid animath spec. It had these problems:',
    invalidLabel: 'The invalid spec you returned:',
    returnLine: 'Return ONLY the corrected animation spec as a single JSON object. No prose, no code fences.',
    rejectLabel: 'Animation spec'
  };
  var SLIDES_KIND = {
    notJsonProblem: 'The response was not valid JSON. Return ONLY the corrected slide deck as JSON.',
    repairHeader: 'Your previous response did not produce a valid slide deck. It had these problems:',
    invalidLabel: 'The invalid slide deck you returned:',
    returnLine: 'Return ONLY the corrected slide deck as a single JSON object. No prose, no code fences.',
    rejectLabel: 'Slide deck'
  };

  function stripFences(text) {
    var t = text.trim();
    var m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return m ? m[1].trim() : t;
  }

  // Same JSON extraction as llm_client.js: plain parse, then a brace-scan
  // fallback so prose-wrapped model output still parses.
  function extractJson(text) {
    var t = stripFences(text);
    try { return JSON.parse(t); } catch (e) { /* try brace scan */ }
    var start = t.indexOf('{');
    var end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch (e2) { /* fall through */ }
    }
    throw new Error('pipeline: response was not valid JSON');
  }

  // A misbehaving progress listener must never break generation.
  function makeProgress(deps) {
    var onProgress = typeof deps.onProgress === 'function' ? deps.onProgress : function () {};
    return function progress(stage, n, max) {
      try { onProgress(stage, n, max); } catch (e) { /* ignore */ }
    };
  }

  // (a) unpack the topic into its state transitions. Any failure — a
  // throwing prompt builder, a failed chat call, an unusable parse —
  // degrades to null (no transitions), i.e. today's behavior. Shared by
  // generateAnimation and generateSlides.
  function unpackStage(deps, progress, opts) {
    progress('unpack', 1, 1);
    var prompts;
    try {
      prompts = SIBLINGS.unpack.buildUnpackPrompts(opts.topic, {
        level: opts.level,
        subject: opts.subject
      });
    } catch (e) {
      return Promise.resolve(null);
    }
    return Promise.resolve(prompts).then(function (p) {
      return deps.callChat(p.system, p.user);
    }).then(function (text) {
      try { return SIBLINGS.unpack.parseUnpackResponse(text); }
      catch (e) { return null; }
    }, function () { return null; });
  }

  // (b) author the document, then repair against the validator. One
  // author/repair attempt: parse the raw text, run the validator.
  // Non-JSON counts as a failed attempt (the next repair turn asks for
  // JSON again), exactly like generateSpecWithRepair. The repair system
  // prompt is the original author system prompt, as in
  // generateSpecWithRepair. Shared by both kinds; `kind` carries the
  // wording, `validateFn` the validator.
  function authorAndRepair(deps, progress, maxRepairs, prompts, validateFn, kind) {
    function parseAndValidate(text) {
      var spec;
      try {
        spec = extractJson(text);
      } catch (e) {
        return Promise.resolve({
          spec: null,
          raw: text,
          problems: [kind.notJsonProblem]
        });
      }
      return Promise.resolve(validateFn(spec)).then(function (problems) {
        return { spec: spec, raw: null, problems: problems };
      });
    }

    function buildRepairUser(prev) {
      var lines = [kind.repairHeader];
      prev.problems.forEach(function (p) { lines.push('- ' + p); });
      lines.push('');
      if (prev.spec) {
        lines.push(kind.invalidLabel);
        lines.push(JSON.stringify(prev.spec, null, 2));
      } else {
        lines.push('Your raw response (it was not valid JSON):');
        lines.push(String(prev.raw).slice(0, 2000));
      }
      lines.push('');
      lines.push(kind.returnLine);
      return lines.join('\n');
    }

    function rejectWithErrors(problems) {
      var err = new Error(
        kind.rejectLabel + ' still invalid after ' + maxRepairs + ' repair attempt(s): ' +
        problems.join(' | '));
      err.problems = problems;
      throw err;
    }

    function repairRound(prev, repairsUsed) {
      progress('repair', repairsUsed + 1, maxRepairs);
      return deps.callChat(prompts.system, buildRepairUser(prev)).then(function (text) {
        return parseAndValidate(text).then(function (result) {
          if (!result.problems.length) return result.spec;
          if (repairsUsed + 1 < maxRepairs) return repairRound(result, repairsUsed + 1);
          return rejectWithErrors(result.problems);
        });
      });
    }

    progress('author', 1, 1);
    return Promise.resolve(prompts).then(function (p) {
      return deps.callChat(p.system, p.user);
    }).then(function (text) {
      return parseAndValidate(text).then(function (result) {
        if (!result.problems.length) return result.spec;
        if (maxRepairs <= 0) return rejectWithErrors(result.problems);
        return repairRound(result, 0);
      });
    });
  }

  // The slide validator for generateSlides: deps.validateSlides when
  // supplied, else deps.validate, else the built-in player/validate.js
  // validateSlides (Node require / browser global via SIBLINGS). Null
  // when none is available, so generateSlides can reject with a clear
  // deps error naming validateSlides.
  function resolveSlidesValidator(deps) {
    if (typeof deps.validateSlides === 'function') return deps.validateSlides;
    if (typeof deps.validate === 'function') return deps.validate;
    if (SIBLINGS.validate && typeof SIBLINGS.validate.validateSlides === 'function') {
      return SIBLINGS.validate.validateSlides;
    } /* node:coverage ignore next */
    return null;
  }

  // opts:
  //   {topic, topicLabel, level, subject, kind, focus, facet, maxRepairs}
  //   (the buildPrompts option set; topic/subject required; maxRepairs
  //   defaults to 3, 0 disables repair).
  // deps:
  //   {callChat(system, user) -> Promise<string>  (caller-supplied LLM call),
  //    validate(spec) -> string[] | Promise<string[]>,
  //    onProgress?(stage, n, max)}  stages: 'unpack', 'author', 'repair'.
  //
  // Resolves with the first spec that validates clean; rejects with an Error
  // carrying err.problems when every attempt failed. A throwing or
  // unparseable unpack step degrades gracefully to buildPrompts WITHOUT
  // transitions (today's behavior) — the pipeline is never worse than the
  // old path. (A missing unpack.js script tag in the browser degrades the
  // same way: the TypeError is caught by the unpack stage.)
  function generateAnimation(opts, deps) {
    opts = opts || {};
    deps = deps || {};
    if (typeof deps.callChat !== 'function') {
      return Promise.reject(new Error('generateAnimation: deps.callChat(system, user) ' +
        'must be a function returning a Promise of the raw response text'));
    }
    if (typeof deps.validate !== 'function') {
      return Promise.reject(new Error('generateAnimation: deps.validate(spec) ' +
        'must be a function returning the problem list'));
    }
    var progress = makeProgress(deps);
    var maxRepairs = (opts.maxRepairs != null) ? opts.maxRepairs : DEFAULT_MAX_REPAIRS;

    return unpackStage(deps, progress, opts).then(function (staged) {
      // Slice 6 (issue #695): attach the bank's wrong-turn beat to the
      // transition where it happens before authoring, so buildPrompts can
      // name the misconceived scene. The degraded null path (no
      // transitions) is untouched — attachMisconceptions never sees it.
      // Staging (owner direction 2026-10-12): the unpacked shape
      // (sequence/cycle/system) decides the scene layout.
      var transitions = staged ? staged.transitions : null;
      var shape = staged ? staged.shape : undefined;
      if (transitions) {
        transitions = SIBLINGS.unpack.attachMisconceptions(transitions, opts.topic);
      }
      var prompts = SIBLINGS.prompt.buildPrompts({
        level: opts.level,
        subject: opts.subject,
        topic: opts.topic,
        topicLabel: opts.topicLabel,
        kind: opts.kind,
        focus: opts.focus,
        facet: opts.facet,
        transitions: transitions,
        shape: shape
      });
      return authorAndRepair(deps, progress, maxRepairs, prompts, deps.validate, ANIMATION_KIND);
    });
  }

  // opts:
  //   {topic, topicLabel, level, subject, workedExample, maxRepairs}
  //   (the buildSlidePrompts option set; topic/subject required;
  //   maxRepairs defaults to 3, 0 disables repair).
  // deps:
  //   {callChat(system, user) -> Promise<string>  (caller-supplied LLM call),
  //    validateSlides?(deck) -> string[] | Promise<string[]>,
  //    validate?(deck) -> string[] | Promise<string[]>  (fallback validator),
  //    onProgress?(stage, n, max)}  stages: 'unpack', 'author', 'repair'.
  //
  // Resolves with the first slide deck that validates clean against
  // validateSlides; rejects with an Error carrying err.problems when
  // every attempt failed. The unpack step degrades exactly like
  // generateAnimation: a failed unpack authors WITHOUT transitions.
  function generateSlides(opts, deps) {
    opts = opts || {};
    deps = deps || {};
    if (typeof deps.callChat !== 'function') {
      return Promise.reject(new Error('generateSlides: deps.callChat(system, user) ' +
        'must be a function returning a Promise of the raw response text'));
    }
    var validateFn = resolveSlidesValidator(deps);
    /* node:coverage ignore next 5 */
    if (!validateFn) {
      return Promise.reject(new Error('generateSlides: deps.validateSlides(spec) ' +
        'must be a function returning the problem list (or supply deps.validate, ' +
        'or load player/validate.js so validateSlides is available)'));
    }
    var progress = makeProgress(deps);
    var maxRepairs = (opts.maxRepairs != null) ? opts.maxRepairs : DEFAULT_MAX_REPAIRS;

    return unpackStage(deps, progress, opts).then(function (staged) {
      var transitions = staged ? staged.transitions : null;
      if (transitions) {
        transitions = SIBLINGS.unpack.attachMisconceptions(transitions, opts.topic);
      }
      var prompts = SIBLINGS.slidesPrompt.buildSlidePrompts({
        topic: opts.topic,
        topicLabel: opts.topicLabel,
        level: opts.level,
        subject: opts.subject,
        transitions: transitions,
        workedExample: opts.workedExample
      });
      return authorAndRepair(deps, progress, maxRepairs, prompts, validateFn, SLIDES_KIND);
    });
  }

  return { generateAnimation: generateAnimation, generateSlides: generateSlides };
});
