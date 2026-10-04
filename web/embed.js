/* animath embed API v0.1 — one-call player embedding for host pages.
 *
 * Usage (browser, no API key needed to play a sample):
 *   AnimathEmbed.mount(document.getElementById('stage'), 'primary-math-fractions-addition')
 *     .then(function (player) { player.play(); });
 *
 * A string slug fetches the sample JSON under opts.baseUrl (default
 * '../samples/', matching web/gallery.html); a spec object mounts directly.
 * Node: require()able for tests (fetch/AnimathPlayer are stubbed there;
 * mount() itself touches no DOM until AnimathPlayer.mount runs).
 */
(function (global) {
  'use strict';

  var DEFAULT_BASE_URL = '../samples/';
  var SAMPLE_SUFFIX = '.json';

  // Fill in the optional options. autoplay defaults to false.
  function applyDefaults(opts) {
    opts = opts || {};
    var baseUrl = opts.baseUrl !== undefined ? opts.baseUrl : DEFAULT_BASE_URL;
    if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';
    return {
      baseUrl: baseUrl,
      autoplay: opts.autoplay === true
    };
  }

  // Map a sample slug to its JSON URL. A missing or empty slug is a
  // programming error, so it throws with a clear message instead of
  // producing a broken URL.
  function resolveSampleUrl(slug, baseUrl) {
    if (typeof slug !== 'string' || slug.trim() === '') {
      throw new Error('AnimathEmbed: slug must be a non-empty string');
    }
    baseUrl = baseUrl === undefined ? DEFAULT_BASE_URL : baseUrl;
    if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';
    return baseUrl + slug + SAMPLE_SUFFIX;
  }

  function mountController(container, spec, options) {
    var player = global.AnimathPlayer.mount(container, spec);
    if (options.autoplay) player.play();
    return player;
  }

  // Mount an animation: either a spec object, or a sample slug fetched
  // over HTTP. Always returns a Promise resolving to the player controller.
  function mount(container, specOrSlug, opts) {
    var options = applyDefaults(opts);
    if (typeof specOrSlug === 'string') {
      var url = resolveSampleUrl(specOrSlug, options.baseUrl);
      return global.fetch(url).then(function (response) {
        if (!response.ok) {
          throw new Error('AnimathEmbed: sample not found at ' + url);
        }
        return response.json();
      }).then(function (spec) {
        return mountController(container, spec, options);
      });
    }
    return Promise.resolve(mountController(container, specOrSlug, options));
  }

  var api = {
    mount: mount,
    applyDefaults: applyDefaults,
    resolveSampleUrl: resolveSampleUrl,
    version: '0.1'
  };
  global.AnimathEmbed = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
