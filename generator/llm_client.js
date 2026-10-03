/* animath LLM client — OpenAI-compatible chat completions.
 * The API key is supplied by the caller (browser localStorage in web/) and is
 * sent only to the configured baseUrl. Works in browser and Node 18+.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AnimathLLM = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function stripFences(text) {
    var t = text.trim();
    var m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return m ? m[1].trim() : t;
  }

  function extractJson(text) {
    var t = stripFences(text);
    try { return JSON.parse(t); } catch (e) { /* try brace scan */ }
    var start = t.indexOf('{');
    var end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch (e2) { /* fall through */ }
    }
    throw new Error('LLM response was not valid JSON');
  }

  function postChat(baseUrl, apiKey, model, system, user, useJsonMode) {
    var body = {
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7
    };
    if (useJsonMode) body.response_format = { type: 'json_object' };
    return fetch(baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error('LLM HTTP ' + res.status + ': ' + String(txt).slice(0, 300));
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('LLM returned no content');
      return content;
    });
  }

  // opts: {baseUrl, apiKey, model, system, user} -> Promise<spec object>
  // One chat-completions round trip with the 400->plain retry (shared by
  // generateSpec and generateSpecWithRepair). Resolves with the raw text.
  function attemptOnce(opts) {
    return postChat(opts.baseUrl, opts.apiKey, opts.model, opts.system, opts.user, true)
      .catch(function (e) {
        // Some OpenAI-compatible endpoints reject response_format; retry plain.
        if (e && e.status === 400) {
          return postChat(opts.baseUrl, opts.apiKey, opts.model, opts.system, opts.user, false);
        }
        throw e;
      });
  }

  function generateSpec(opts) {
    if (!opts.apiKey) return Promise.reject(new Error('API key is required'));
    return attemptOnce(opts).then(extractJson);
  }

  // opts: same as generateSpec, plus optional maxRepairs (default 2).
  // validate: function (spec) -> array of error strings (injected so the
  // client stays testable in Node without the browser global).
  // onProgress: optional function (attemptNumber, maxRepairs) called before
  // each repair turn, e.g. to update a status line.
  // Resolves with the first spec that validates clean; after the final failed
  // attempt rejects with an Error whose message carries the last error list.
  function generateSpecWithRepair(opts, validate, onProgress) {
    if (!opts.apiKey) return Promise.reject(new Error('API key is required'));
    if (typeof validate !== 'function') {
      return Promise.reject(new Error('a validator function is required'));
    }
    var maxRepairs = (opts.maxRepairs != null) ? opts.maxRepairs : 2;

    // Parse one LLM response and run the validator. A response that is not
    // valid JSON counts as a failed attempt (not an early blow-up): the next
    // repair turn asks for JSON again.
    function parseAndValidate(text) {
      var spec;
      try {
        spec = extractJson(text);
      } catch (e) {
        return Promise.resolve({
          spec: null, raw: text,
          problems: ['The response was not valid JSON. Return ONLY the corrected animation spec as JSON.']
        });
      }
      return Promise.resolve(validate(spec)).then(function (problems) {
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

    function repairRound(prev, repairsUsed) {
      if (typeof onProgress === 'function') onProgress(repairsUsed + 1, maxRepairs);
      return attemptOnce({
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
        model: opts.model,
        system: opts.system,
        user: buildRepairUser(prev)
      }).then(function (text) {
        return parseAndValidate(text).then(function (result) {
          if (!result.problems.length) return result.spec;
          if (repairsUsed + 1 < maxRepairs) return repairRound(result, repairsUsed + 1);
          return rejectWithErrors(result.problems);
        });
      });
    }

    return attemptOnce(opts).then(function (text) {
      return parseAndValidate(text).then(function (result) {
        if (!result.problems.length) return result.spec;
        if (maxRepairs <= 0) return rejectWithErrors(result.problems);
        return repairRound(result, 0);
      });
    });
  }

  return { generateSpec: generateSpec, generateSpecWithRepair: generateSpecWithRepair, extractJson: extractJson };
});
