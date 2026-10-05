/* animath gallery filter API v0.1 — pure search + level/subject filtering
 * for the sample gallery (web/gallery.html).
 *
 * Node: require()able for tests (this module touches no DOM).
 */
(function (global) {
  'use strict';

  // Normalize a keyword to lowercase with surrounding whitespace trimmed.
  // Non-string values become '' so criteria may be partial.
  function norm(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  // The searchable text of a sample item: title, topic, and filename.
  // Guard against undefined fields with ''.
  function haystack(item) {
    return ((item.title || '') + ' ' + (item.topic || '') + ' ' + (item.filename || '')).toLowerCase();
  }

  // Filter gallery items by optional criteria:
  //   { keyword, level, subject } — all optional.
  // keyword: case-insensitive substring of title/topic/filename.
  // level/subject: exact equality when non-empty.
  // Returns matching items in original order; never mutates the input.
  function filterSamples(items, criteria) {
    criteria = criteria || {};
    var keyword = norm(criteria.keyword);
    var level = criteria.level || '';
    var subject = criteria.subject || '';
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (keyword !== '' && haystack(item).indexOf(keyword) === -1) continue;
      if (level !== '' && (item.level || '') !== level) continue;
      if (subject !== '' && (item.subject || '') !== subject) continue;
      out.push(item);
    }
    return out;
  }

  // Card meta line for a loaded animation spec:
  //   "level · subject · topic · N scenes · Ms"
  // Scene count comes from spec.scenes; runtime is the sum of scene
  // duration_ms, rounded to whole seconds. Pure and DOM-free so Node
  // tests can cover it. Guarded against missing fields: specs without
  // scenes contribute only level/subject/topic, non-numeric duration_ms
  // counts as 0.
  function formatMeta(spec) {
    spec = spec || {};
    var parts = [spec.level, spec.subject, spec.topic].filter(Boolean);
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    if (scenes.length) {
      parts.push(scenes.length + (scenes.length === 1 ? ' scene' : ' scenes'));
      var totalMs = 0;
      for (var i = 0; i < scenes.length; i++) {
        var d = Number(scenes[i] && scenes[i].duration_ms);
        if (d > 0) totalMs += d;
      }
      parts.push(Math.round(totalMs / 1000) + 's');
    }
    return parts.join(' · ');
  }

  var api = {
    filterSamples: filterSamples,
    formatMeta: formatMeta,
    version: '0.1'
  };
  global.AnimathGallery = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
