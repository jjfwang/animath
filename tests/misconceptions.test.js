/* animath misconception library tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards generator/misconceptions.js (issues #101, #103, #105, #107, #109) and the misconceptionFor /
 * injection wiring in generator/build_prompt.js: every library entry keeps its
 * three string fields, lookup resolves short slugs and longer file-style slugs,
 * unknown slugs fall back to the generic PEDAGOGY line, and buildPrompts
 * injects the entry text for seeded slugs.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { MISCONCEPTIONS } = require('../generator/misconceptions.js');
const Prompt = require('../generator/build_prompt.js');

const PRIMARY_MATH_SLUGS = [
  'whole-numbers', 'fractions', 'decimals', 'percentage', 'ratio', 'rate-speed',
  'algebra-intro', 'geometry-angles', 'area-perimeter', 'volume',
  'data-graphs', 'model-method'
];

const PRIMARY_SCIENCE_SLUGS = [
  'human-body-systems', 'plant-systems', 'life-cycles', 'water-cycle',
  'energy-forms', 'photosynthesis', 'forces-magnets', 'adaptations'
];

const SECONDARY_MATH_SLUGS = [
  'e-numbers', 'e-algebra', 'e-functions-graphs', 'e-geometry',
  'e-trigonometry', 'e-mensuration', 'e-statistics', 'e-probability',
  'a-quadratic-functions', 'a-binomial', 'a-trigonometry',
  'a-differentiation', 'a-integration', 'a-kinematics'
];

const SECONDARY_SCIENCE_SLUGS = [
  'bio-cells', 'bio-ecology', 'bio-nutrition', 'bio-reproduction',
  'bio-transport', 'chem-acids', 'chem-atomic', 'chem-bonding', 'chem-mole',
  'phys-electricity', 'phys-energy', 'phys-forces', 'phys-kinematics',
  'phys-waves'
];

const H2_SLUGS = [
  'h2-functions-graphs', 'h2-sequences', 'h2-vectors', 'h2-complex',
  'h2-differentiation', 'h2-integration', 'h2-probability', 'h2-statistics',
  'h2-mechanics', 'h2-em', 'h2-thermal', 'h2-quantum', 'h2-physical',
  'h2-inorganic', 'h2-organic', 'h2-cell-bio', 'h2-genetics', 'h2-energetics',
  'h2-ecology'
];

const SEEDED_SLUGS = PRIMARY_MATH_SLUGS.concat(PRIMARY_SCIENCE_SLUGS, SECONDARY_MATH_SLUGS, SECONDARY_SCIENCE_SLUGS, H2_SLUGS);

test('MISCONCEPTIONS holds exactly the 67 seeded topic slugs (12 Primary Math + 8 Primary Science + 14 Secondary Math + 14 Secondary Science + 19 H2)', () => {
  assert.deepStrictEqual(Object.keys(MISCONCEPTIONS).sort(), SEEDED_SLUGS.slice().sort());
});

test('every entry has non-empty wrongTurn, why and correctTurn strings', () => {
  for (const slug of SEEDED_SLUGS) {
    for (const e of entryVariants(slug)) {
      for (const f of ['wrongTurn', 'why', 'correctTurn']) {
        assert.strictEqual(typeof e[f], 'string',
          'entry ' + slug + ' field ' + f + ' must be a plain string');
        assert.ok(e[f].length > 0, 'entry ' + slug + ' field ' + f + ' must not be empty');
      }
    }
  }
});

// Faceted entries (issue #367): one variant per facet; plain entries: one variant.
function entryVariants(slug) {
  const e = MISCONCEPTIONS[slug];
  if (e.facets) return Object.keys(e.facets).map(k => e.facets[k]);
  return [e];
}

test('misconceptionFor resolves exact slugs', () => {
  const e = Prompt.misconceptionFor('fractions');
  assert.strictEqual(e, MISCONCEPTIONS['fractions']);
  assert.strictEqual(Prompt.misconceptionFor('model-method'), MISCONCEPTIONS['model-method']);
});

test('misconceptionFor resolves longer file-style slugs via longest prefix', () => {
  assert.strictEqual(Prompt.misconceptionFor('fractions-addition'), MISCONCEPTIONS['fractions']);
  assert.strictEqual(Prompt.misconceptionFor('percentage-of-quantity'), MISCONCEPTIONS['percentage']);
  assert.strictEqual(Prompt.misconceptionFor('decimals-place-value'), MISCONCEPTIONS['decimals']);
  assert.strictEqual(Prompt.misconceptionFor('ratio-sharing'), MISCONCEPTIONS['ratio']);
  assert.strictEqual(Prompt.misconceptionFor('photosynthesis-intro'), MISCONCEPTIONS['photosynthesis']);
  assert.strictEqual(Prompt.misconceptionFor('water-cycle'), MISCONCEPTIONS['water-cycle']);
});

test('misconceptionFor resolves the slice-3 secondary math slugs exactly', () => {
  for (const slug of SECONDARY_MATH_SLUGS) {
    assert.strictEqual(Prompt.misconceptionFor(slug), MISCONCEPTIONS[slug],
      'exact lookup for ' + slug + ' must resolve to its entry');
  }
});

test('misconceptionFor resolves the slice-4 secondary science slugs exactly', () => {
  for (const slug of SECONDARY_SCIENCE_SLUGS) {
    const e = MISCONCEPTIONS[slug];
    // faceted entries resolve the primary facet, preserving pre-facet behavior
    const expected = e.facets ? e.facets[e.primary] : e;
    assert.strictEqual(Prompt.misconceptionFor(slug), expected,
      'exact lookup for ' + slug + ' must resolve to its entry (primary facet)');
  }
});

test('misconceptionFor resolves the slice-5 H2 slugs exactly', () => {
  for (const slug of H2_SLUGS) {
    const e = MISCONCEPTIONS[slug];
    // faceted entries resolve the primary facet, preserving pre-facet behavior
    const expected = e.facets ? e.facets[e.primary] : e;
    assert.strictEqual(Prompt.misconceptionFor(slug), expected,
      'exact lookup for ' + slug + ' must resolve to its entry (primary facet)');
  }
});

test('misconceptionFor resolves slice-4 file-style slugs via longest prefix', () => {
  assert.strictEqual(Prompt.misconceptionFor('bio-ecology-pyramid'), MISCONCEPTIONS['bio-ecology']);
  assert.strictEqual(Prompt.misconceptionFor('chem-mole-mass-to-moles'), MISCONCEPTIONS['chem-mole']);
  assert.strictEqual(Prompt.misconceptionFor('phys-electricity-current-not-used-up'), MISCONCEPTIONS['phys-electricity']);
  assert.strictEqual(Prompt.misconceptionFor('phys-forces-pressure-tiptoes'), MISCONCEPTIONS['phys-forces']);
});

test('no seeded slug is shadowed by another key prefix', () => {
  // every file-style slug used above must land on the same entry a
  // longer file path prefix would hit, i.e. no key prefixes another key
  for (const slug of SEEDED_SLUGS) {
    const e = MISCONCEPTIONS[slug];
    const expected = e.facets ? e.facets[e.primary] : e;
    assert.strictEqual(Prompt.misconceptionFor(slug + '-x'), expected,
      'prefix extension of ' + slug + ' must still resolve to its entry');
  }
});

test('all entries stay plain ASCII like the earlier slices', () => {
  const ascii = /^[\x00-\x7F]*$/;
  for (const slug of SEEDED_SLUGS) {
    for (const e of entryVariants(slug)) {
      for (const f of ['wrongTurn', 'why', 'correctTurn']) {
        assert.ok(ascii.test(e[f]), 'entry ' + slug + ' field ' + f + ' must be ASCII');
      }
    }
  }
});

test('misconceptionFor returns null for unknown or missing slugs', () => {
  assert.strictEqual(Prompt.misconceptionFor('pythagoras'), null);
  assert.strictEqual(Prompt.misconceptionFor(''), null);
  assert.strictEqual(Prompt.misconceptionFor(undefined), null);
  assert.strictEqual(Prompt.misconceptionFor('fraction'), null); // no dash boundary -> no prefix hit
});

test('buildPrompts injects the seeded entry text for a seeded slug', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'fractions', kind: 'concept' });
  const e = MISCONCEPTIONS['fractions'];
  assert.ok(p.system.indexOf(e.wrongTurn) !== -1, 'system prompt must contain the wrongTurn text');
  assert.ok(p.system.indexOf(e.why) !== -1, 'system prompt must contain the why text');
  assert.ok(p.system.indexOf(e.correctTurn) !== -1, 'system prompt must contain the correctTurn text');
  assert.ok(p.system.indexOf('{{MISCONCEPTION_LINE}}') === -1, 'template placeholder must be filled');
});

test('buildPrompts keeps the generic line for an unknown slug', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'pythagoras', kind: 'concept' });
  assert.ok(p.system.indexOf('1/2 + 1/4 is NOT 2/6') !== -1,
    'system prompt must keep the generic misconception line for unknown slugs');
});

test('buildPrompts injects via the longer file-style slug too', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'percentage-of-quantity', kind: 'concept' });
  assert.ok(p.system.indexOf(MISCONCEPTIONS['percentage'].wrongTurn) !== -1,
    'system prompt must contain the percentage wrongTurn text via prefix resolution');
});

test('faceted entry: bare lookup returns the primary facet (pre-facet behavior)', () => {
  const entry = MISCONCEPTIONS['bio-nutrition'];
  assert.ok(entry.facets, 'bio-nutrition must be faceted');
  assert.strictEqual(Prompt.misconceptionFor('bio-nutrition'), entry.facets.digestion);
  assert.strictEqual(Prompt.misconceptionFor('bio-nutrition').wrongTurn,
    'Digestion finishes in the stomach.');
});

test('faceted entry: facet hint returns the named facet', () => {
  const photo = Prompt.misconceptionFor('bio-nutrition', 'photosynthesis');
  assert.strictEqual(photo, MISCONCEPTIONS['bio-nutrition'].facets.photosynthesis);
  assert.ok(photo.wrongTurn.indexOf('oxygen') !== -1,
    'photosynthesis facet must address the oxygen misconception, not digestion');
});

test('faceted entry: unknown or missing hint falls back to the primary facet', () => {
  const entry = MISCONCEPTIONS['bio-nutrition'];
  assert.strictEqual(Prompt.misconceptionFor('bio-nutrition', 'nope'), entry.facets.digestion);
  assert.strictEqual(Prompt.misconceptionFor('bio-nutrition', null), entry.facets.digestion);
  assert.strictEqual(Prompt.misconceptionFor('bio-nutrition', undefined), entry.facets.digestion);
});

test('faceted entry: prefix resolution honors the facet hint', () => {
  const photo = Prompt.misconceptionFor('bio-nutrition-extra', 'photosynthesis');
  assert.strictEqual(photo, MISCONCEPTIONS['bio-nutrition'].facets.photosynthesis);
});

test('faceted entry: facet hint on a plain entry is ignored', () => {
  assert.strictEqual(Prompt.misconceptionFor('fractions', 'photosynthesis'), MISCONCEPTIONS['fractions']);
});

test('buildPrompts injects the facet entry when a facet is passed', () => {
  const p = Prompt.buildPrompts({ level: 'secondary', subject: 'science', topic: 'bio-nutrition', facet: 'photosynthesis', kind: 'concept' });
  const photo = MISCONCEPTIONS['bio-nutrition'].facets.photosynthesis;
  assert.ok(p.system.indexOf(photo.wrongTurn) !== -1, 'system prompt must contain the photosynthesis wrongTurn');
  assert.ok(p.system.indexOf('Digestion finishes in the stomach') === -1,
    'system prompt must not contain the digestion wrongTurn when the photosynthesis facet is requested');
});

test('faceted entry: h2-sequences bare lookup keeps the formula-slip facet (pre-facet behavior)', () => {
  const entry = MISCONCEPTIONS['h2-sequences'];
  assert.strictEqual(entry.primary, 'formula-slip', 'h2-sequences primary facet must be formula-slip');
  assert.strictEqual(Prompt.misconceptionFor('h2-sequences'), entry.facets['formula-slip']);
  assert.strictEqual(Prompt.misconceptionFor('h2-sequences', null), entry.facets['formula-slip']);
});

test('faceted entry: h2-sequences convergence facet is grounded in the s4 slip beat', () => {
  const facet = MISCONCEPTIONS['h2-sequences'].facets.convergence;
  assert.ok(facet.wrongTurn.indexOf('r = -1') !== -1,
    'convergence wrongTurn must name the r = -1 slip');
  assert.ok(facet.why.indexOf('bounce between two values forever') !== -1,
    'convergence why must carry the s4 narration wording');
  assert.ok(facet.correctTurn.indexOf('|r| < 1') !== -1,
    'convergence correctTurn must carry the convergence condition');
});

test('faceted entry: h2-sequences facet hint returns the convergence facet, unknown hint falls back to primary', () => {
  const entry = MISCONCEPTIONS['h2-sequences'];
  assert.strictEqual(Prompt.misconceptionFor('h2-sequences', 'convergence'), entry.facets.convergence);
  assert.strictEqual(Prompt.misconceptionFor('h2-sequences', 'nope'), entry.facets['formula-slip']);
});

test('buildPrompts injects the convergence facet when a facet is passed', () => {
  const p = Prompt.buildPrompts({ level: 'jc', subject: 'math', topic: 'h2-sequences', facet: 'convergence', kind: 'concept' });
  assert.ok(p.system.indexOf('settles down eventually') !== -1,
    'system prompt must carry the convergence wrongTurn when the convergence facet is requested');
  assert.ok(p.system.indexOf('u_1 + n*d') === -1,
    'system prompt must not contain the formula-slip wrongTurn when the convergence facet is requested');
});

test('buildPrompts keeps the primary facet when no facet is passed', () => {
  const p = Prompt.buildPrompts({ level: 'secondary', subject: 'science', topic: 'bio-nutrition', kind: 'concept' });
  assert.ok(p.system.indexOf('Digestion finishes in the stomach') !== -1,
    'system prompt must keep the digestion wrongTurn for bare bio-nutrition lookups');
});

test('faceted entry: h2-organic bare lookup keeps the arrow-direction facet (pre-facet behavior)', () => {
  const entry = MISCONCEPTIONS['h2-organic'];
  assert.strictEqual(entry.primary, 'arrow-direction', 'h2-organic primary facet must be arrow-direction');
  assert.strictEqual(Prompt.misconceptionFor('h2-organic'), entry.facets['arrow-direction']);
  assert.strictEqual(Prompt.misconceptionFor('h2-organic', null), entry.facets['arrow-direction']);
});

test('faceted entry: h2-organic atom-motion facet is grounded in the s7 beat', () => {
  const facet = MISCONCEPTIONS['h2-organic'].facets['atom-motion'];
  assert.ok(facet.wrongTurn.indexOf('atom sliding along it') !== -1,
    'atom-motion wrongTurn must name the atom-sliding slip');
  assert.ok(facet.why.indexOf('never moves atoms') !== -1,
    'atom-motion why must carry the s7 narration wording');
  assert.ok(facet.correctTurn.indexOf('one pair of electrons') !== -1,
    'atom-motion correctTurn must carry the electron-pair tracking fix');
});

test('faceted entry: h2-organic facet hint returns atom-motion, unknown hint falls back to primary', () => {
  const entry = MISCONCEPTIONS['h2-organic'];
  assert.strictEqual(Prompt.misconceptionFor('h2-organic', 'atom-motion'), entry.facets['atom-motion']);
  assert.strictEqual(Prompt.misconceptionFor('h2-organic', 'nope'), entry.facets['arrow-direction']);
});

test('buildPrompts injects the atom-motion facet when a facet is passed', () => {
  const p = Prompt.buildPrompts({ level: 'jc', subject: 'science', topic: 'h2-organic', facet: 'atom-motion', kind: 'concept' });
  assert.ok(p.system.indexOf('atom sliding along it') !== -1,
    'system prompt must carry the atom-motion wrongTurn when the atom-motion facet is requested');
  assert.ok(p.system.indexOf('electron-poor atom toward the electron-rich') === -1,
    'system prompt must not contain the arrow-direction wrongTurn when the atom-motion facet is requested');
});
