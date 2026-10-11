/* animath tooling — provenance for the chart geometry baked into
 * samples/primary-math-data-graphs.json (issue #610).
 *
 * The chart toolkit generator/charts.js ships with its first adopted
 * consumers in this sample. The JSON values below were verified to equal
 * the toolkit's outputs for the literal inputs shown; this script prints
 * those outputs as descriptor fragments so the provenance is auditable
 * without reading the minified sample.
 *
 * Requirements: Node, zero dependencies. Run from the repo root:
 *
 *     node generator/tooling/build-data-graphs-charts.js
 *
 * The test tests/charts-adoption.test.js asserts the same equality
 * independently of this script (it requires generator/charts.js directly).
 */
'use strict';

const { pieSectors, barLayout, axisTicks } = require('../charts.js');

// ---- s1: favourite-fruit pie -------------------------------------------
// Inputs: 12 pupils voted — apples 6, bananas 3, grapes 3. Pie centred at
// (300,330) with radius 150; startAngle 0 = east (SPEC.md, 0 = east,
// positive clockwise); fills one per wedge.
// Emitted shapes: wApples, wBananas, wGrapes (kind 'sector').
console.log('s1 pie: pieSectors(300,330,150,[6,3,3],{startAngle:0,fills:[' +
  "'#e8604c','#8fd694','#7fb3e8']})");
const sectors = pieSectors(300, 330, 150, [6, 3, 3], {
  startAngle: 0,
  fills: ['#e8604c', '#8fd694', '#7fb3e8']
});
const sectorIds = ['wApples', 'wBananas', 'wGrapes'];
sectors.forEach((sec, i) => {
  console.log('  ' + sectorIds[i] + ': ' + JSON.stringify({
    cx: sec.cx, cy: sec.cy, r: sec.r,
    startAngle: sec.startAngle, endAngle: sec.endAngle, fill: sec.fill
  }));
});

// ---- s3: favourite-sport bars -------------------------------------------
// Inputs: plot rect x=135, y=280, w=360, h=130 (baseline y = 280+130 =
// 410); values soccer 13, badminton 8, swimming 3; gap = 5/12 verbatim
// (yields 70px bars on 120px slots: 120*(1-5/12) = 70); fills one per bar.
// The chart geometry lives in the move-step `to` targets (the static
// rects are the h=0 initial state).
console.log('s3 bars: barLayout(135,280,360,130,[13,8,3],{gap:5/12,' +
  "fills:['#7fb3e8','#8fd694','#e8b47f']})");
const bars = barLayout(135, 280, 360, 130, [13, 8, 3], {
  gap: 5 / 12,
  fills: ['#7fb3e8', '#8fd694', '#e8b47f']
});
const barIds = ['soccer', 'minton', 'swim'];
bars.forEach((bar, i) => {
  console.log('  ' + barIds[i] + ' move-to: ' + JSON.stringify({
    x: bar.x, y: bar.y, w: bar.w, h: bar.h
  }));
});

// ---- s4: shop-B sales axis ticks ----------------------------------------
// Inputs: range 0..200, count 3. axisTicks yields [0,100,200]; the sample
// tick labels t0B/t100B/t200B carry these as text ('0','100','200').
// (Axis A ticks [0,25,50] stay hand-authored: axisTicks(0,50,n) cannot
// reproduce them without a visual change — issue #610 scope exclusion.)
console.log('s4 axis-B ticks: axisTicks(0,200,3)');
console.log('  ' + JSON.stringify(axisTicks(0, 200, 3)));
