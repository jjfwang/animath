/* Tests for player/player.js applyPos — rect size field translation (issue #134).
 * DOM-less: a stub node records setAttribute calls.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const player = require('../player/player.js');

function stubNode() {
  var calls = [];
  return {
    calls: calls,
    setAttribute: function (name, value) { calls.push([name, value]); }
  };
}

test('applyPos maps rect w/h to width/height attributes with interpolated values', () => {
  var node = stubNode();
  var shape = { id: 'r1', kind: 'rect', x: 10, y: 20, w: 100, h: 50 };
  var from = { x: 10, y: 20, w: 100, h: 50 };
  var pos = player.interpFields(from, { w: 200, h: 100 }, 0.5);
  player.applyPos(node, shape, pos);
  var byName = {};
  node.calls.forEach(function (c) { byName[c[0]] = c[1]; });
  assert.equal(byName.width, 150, 'width interpolated to 150 at p=0.5');
  assert.equal(byName.height, 75, 'height interpolated to 75 at p=0.5');
  assert.ok(!('w' in byName), 'no raw w attribute set');
  assert.ok(!('h' in byName), 'no raw h attribute set');
});
