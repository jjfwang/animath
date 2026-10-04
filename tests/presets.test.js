/* animath model-preset tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the PRESETS data added to generator/llm_client.js (R-3): every
 * preset keeps its string fields, there are at least three presets, the
 * default is openai, and the web UI's hardcoded defaults still match the
 * openai preset (guards drift between UI defaults and PRESETS).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LLM = require('../generator/llm_client.js');
const PRESETS = LLM.PRESETS;
const DEFAULT_PRESET = LLM.DEFAULT_PRESET;

test('exports PRESETS and DEFAULT_PRESET', () => {
  assert.ok(PRESETS && typeof PRESETS === 'object', 'PRESETS must be an object');
  assert.ok(!Array.isArray(PRESETS), 'PRESETS must be a map, not an array');
  assert.strictEqual(DEFAULT_PRESET, 'openai');
  assert.ok(PRESETS[DEFAULT_PRESET], 'DEFAULT_PRESET must exist in PRESETS');
});

test('at least three presets with string label/baseUrl/model/keyHint', () => {
  const keys = Object.keys(PRESETS);
  assert.ok(keys.length >= 3, 'expected >= 3 presets, got ' + keys.length);
  for (const k of keys) {
    const p = PRESETS[k];
    for (const f of ['label', 'baseUrl', 'model', 'keyHint']) {
      assert.strictEqual(typeof p[f], 'string',
        'preset ' + k + ' field ' + f + ' must be a plain string');
    }
    assert.ok(p.label.length > 0, 'preset ' + k + ' label must not be empty');
    assert.ok(p.model.length > 0, 'preset ' + k + ' model must not be empty');
    assert.ok(p.keyHint.length > 0, 'preset ' + k + ' keyHint must not be empty');
    // baseUrl may be empty only when the user must supply it (anthropic-proxy)
  }
});

test('openai preset matches the documented defaults', () => {
  assert.strictEqual(PRESETS.openai.baseUrl, 'https://api.openai.com/v1');
  assert.strictEqual(PRESETS.openai.model, 'gpt-4o-mini');
});

test('ollama preset needs no key, anthropic-proxy documents the proxy', () => {
  assert.match(PRESETS.ollama.keyHint, /no key/i);
  assert.strictEqual(PRESETS['anthropic-proxy'].baseUrl, '',
    'anthropic-proxy ships with an empty baseUrl for the user to supply');
  assert.match(PRESETS['anthropic-proxy'].keyHint, /OpenAI-compatible/i);
});

function htmlInputValue(html, id) {
  const m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>', ''));
  assert.ok(m, 'index.html must contain input#' + id);
  const vm = m[0].match(/value="([^"]*)"/);
  assert.ok(vm, 'input#' + id + ' must carry a value attribute');
  return vm[1];
}

test('web UI hardcoded defaults equal the openai preset', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  assert.strictEqual(htmlInputValue(html, 'baseurl'), PRESETS.openai.baseUrl,
    'index.html base URL default drifted from PRESETS.openai');
  assert.strictEqual(htmlInputValue(html, 'model'), PRESETS.openai.model,
    'index.html model default drifted from PRESETS.openai');
});

test('web UI has a preset select populated by the app', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  assert.match(html, /<select[^>]*id="preset"[^>]*>/);
  assert.match(html, /AnimathLLM\.PRESETS/);
});
