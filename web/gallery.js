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

  var api = {
    filterSamples: filterSamples,
    version: '0.1'
  };
  global.AnimathGallery = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
