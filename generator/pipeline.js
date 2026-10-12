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
      return { unpack: require('./unpack.js'), prompt: require('./build_prompt.js') };
    }
    var g = (typeof window !== 'undefined' ? window : globalThis);
    return { unpack: g.AnimathUnpack, prompt: g.AnimathPrompt };
  })();

  var DEFAULT_MAX_REPAIRS = 3;

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
    var onProgress = typeof deps.onProgress === 'function' ? deps.onProgress : function () {};
    var maxRepairs = (opts.maxRepairs != null) ? opts.maxRepairs : DEFAULT_MAX_REPAIRS;

    // A misbehaving progress listener must never break generation.
    function progress(stage, n, max) {
      try { onProgress(stage, n, max); } catch (e) { /* ignore */ }
    }

    // (a) unpack the topic into its state transitions. Any failure — a
    // throwing prompt builder, a failed chat call, an unusable parse —
    // degrades to null (no transitions), i.e. today's behavior.
    function unpackStage() {
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

    // One author/repair attempt: parse the raw text, run the validator.
    // Non-JSON counts as a failed attempt (the next repair turn asks for
    // JSON again), exactly like generateSpecWithRepair.
    function parseAndValidate(text) {
      var spec;
      try {
        spec = extractJson(text);
      } catch (e) {
        return Promise.resolve({
          spec: null,
          raw: text,
          problems: ['The response was not valid JSON. Return ONLY the corrected animation spec as JSON.']
        });
      }
      return Promise.resolve(deps.validate(spec)).then(function (problems) {
        return { spec: spec, raw: null, problems: problems };
      });
    }

    function buildRepairUser(prev) {
      var lines = ['Your previous response did not produce a valid animath spec. It had these problems:'];
      prev.problems.forEach(function (p) { lines.push('- ' + p); });
      lines.push('');
      if (prev.spec) {
        lines.push('The invalid spec you returned:');
        lines.push(JSON.stringify(prev.spec, null, 2));
      } else {
        lines.push('Your raw response (it was not valid JSON):');
        lines.push(String(prev.raw).slice(0, 2000));
      }
      lines.push('');
      lines.push('Return ONLY the corrected animation spec as a single JSON object. No prose, no code fences.');
      return lines.join('\n');
    }

    function rejectWithErrors(problems) {
      var err = new Error(
        'Animation spec still invalid after ' + maxRepairs + ' repair attempt(s): ' +
        problems.join(' | '));
      err.problems = problems;
      throw err;
    }

    // (b) author the spec, then repair against the validator. The repair
    // system prompt is the original author system prompt, as in
    // generateSpecWithRepair.
    function authorStage(prompts) {
      progress('author', 1, 1);
      return Promise.resolve(prompts).then(function (p) {
        return deps.callChat(p.system, p.user);
      }).then(function (text) {
        return parseAndValidate(text).then(function (result) {
          if (!result.problems.length) return result.spec;
          if (maxRepairs <= 0) return rejectWithErrors(result.problems);
          return repairRound(result, 0, prompts);
        });
      });
    }

    function repairRound(prev, repairsUsed, prompts) {
      progress('repair', repairsUsed + 1, maxRepairs);
      return deps.callChat(prompts.system, buildRepairUser(prev)).then(function (text) {
        return parseAndValidate(text).then(function (result) {
          if (!result.problems.length) return result.spec;
          if (repairsUsed + 1 < maxRepairs) return repairRound(result, repairsUsed + 1, prompts);
          return rejectWithErrors(result.problems);
        });
      });
    }

    return unpackStage().then(function (staged) {
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
      return authorStage(prompts);
    });
  }

  return { generateAnimation: generateAnimation };
});
