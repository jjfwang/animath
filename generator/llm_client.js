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
  function generateSpec(opts) {
    if (!opts.apiKey) return Promise.reject(new Error('API key is required'));
    return postChat(opts.baseUrl, opts.apiKey, opts.model, opts.system, opts.user, true)
      .catch(function (e) {
        // Some OpenAI-compatible endpoints reject response_format; retry plain.
        if (e && e.status === 400) {
          return postChat(opts.baseUrl, opts.apiKey, opts.model, opts.system, opts.user, false);
        }
        throw e;
      })
      .then(extractJson);
  }

  return { generateSpec: generateSpec, extractJson: extractJson };
});
