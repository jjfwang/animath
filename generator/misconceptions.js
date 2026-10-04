/* animath misconception library — per-topic wrong-turn beats for the generator.
 * Slice 1 (issue #101): the 12 Primary Math topics. Each entry is grounded in
 * the matching sample's misconception scene (samples/primary-math-*.json).
 *
 * Slug naming note: the map is keyed on the short topic slugs that
 * buildPrompts receives (the issue's slugs), which match the samples' topic
 * fields exactly:
 *   decimals-place-value.json -> topic "decimals"  (key: decimals)
 *   fractions-addition.json   -> topic "fractions" (key: fractions)
 *   percentage-of-quantity.json -> topic "percentage" (key: percentage)
 *   ratio-sharing.json        -> topic "ratio"     (key: ratio)
 * Callers sometimes pass the longer file-style slug (e.g. "fractions-addition"
 * or "percentage-of-quantity"); misconceptionFor() in build_prompt.js also
 * tries the longest matching key prefix so those still resolve.
 *
 * Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AnimathMisconceptions = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Each entry: the wrong turn students take, why they slip, and the correct
  // turn the animation should show. Plain strings only (ASCII).
  var MISCONCEPTIONS = {
    'whole-numbers': {
      wrongTurn: 'Reading 5 0 6 7 as 567, skipping the zero.',
      why: 'Learners read the digits left to right and drop the 0, losing the hundreds place.',
      correctTurn: 'Zero holds its place: 5 0 6 7 is five thousand and sixty-seven, with the 0 keeping the hundreds empty.'
    },
    'fractions': {
      wrongTurn: 'Adding tops and bottoms: 1/2 + 1/4 = 2/6.',
      why: 'The bottom number names the piece size, so it cannot be added like the tops.',
      correctTurn: 'The bottom number stays 4 because the piece size never changed: 1/2 + 1/4 = 2/4 + 1/4 = 3/4.'
    },
    'decimals': {
      wrongTurn: 'Comparing decimals by digit count: 0.25 looks bigger than 0.4 because 25 > 4.',
      why: 'Longer digit strings feel larger, but place value decides, not digit count.',
      correctTurn: 'Match the place values first: 0.4 is 0.40, then tenths under tenths and hundredths under hundredths.'
    },
    'percentage': {
      wrongTurn: '25% of 60 is just 25.',
      why: 'The 25 is read as a raw count instead of 25 out of 100.',
      correctTurn: 'Percent means per hundred, and the whole here is 60: 25% of 60 is a quarter of 60, which is 15.'
    },
    'ratio': {
      wrongTurn: 'A ratio of 3:2 means 3/2 of the whole.',
      why: 'The ratio parts are mistaken for a fraction of the whole.',
      correctTurn: 'The whole is 5 parts, so 3 parts is 3 fifths of the whole.'
    },
    'rate-speed': {
      wrongTurn: '60 km/h means the bus has travelled 60 km.',
      why: 'A rate is read as a total instead of an amount per unit of time.',
      correctTurn: 'Speed is distance per hour: after half an hour at 60 km/h the bus has gone 30 km, not 60.'
    },
    'algebra-intro': {
      wrongTurn: 'Treating x as a label for things, so 3x + 2x cannot be combined.',
      why: 'Letters are first met as labels, so x feels like a name tag rather than a number.',
      correctTurn: 'x stands for a number: 3x + 2x is 5x, like 3 mystery boxes plus 2 mystery boxes.'
    },
    'geometry-angles': {
      wrongTurn: 'The angle with longer arms is bigger.',
      why: 'Longer arms look more impressive, and size is judged by the drawing rather than the turn.',
      correctTurn: 'An angle measures the turn between the arms: same turn, same angle, whatever the arm lengths.'
    },
    'area-perimeter': {
      wrongTurn: 'The area of the L-shape is the length times the width of its bounding box.',
      why: 'The eye completes the L into a rectangle and measures the imaginary corner.',
      correctTurn: 'The empty corner of the L was never filled, so it adds no area; count only what is there.'
    },
    'volume': {
      wrongTurn: 'The taller container holds more.',
      why: 'Height dominates the eye, so taller looks like more.',
      correctTurn: 'Count the unit cubes: six cubes is six cubes; shape never changes the amount.'
    },
    'data-graphs': {
      wrongTurn: 'A steeper line always means a bigger increase.',
      why: 'Steepness is judged by the drawing rather than the axis scale behind it.',
      correctTurn: 'Slope depends on the axis scale: two graphs can have the same rise but look different.'
    },
    'model-method': {
      wrongTurn: 'Drawing unit boxes in any lengths, guessing the sizes.',
      why: 'The bar is treated as a rough sketch rather than a scale model.',
      correctTurn: 'Every unit box must be exactly the same length: two units is exactly twice one unit.'
    }
  };

  return {
    MISCONCEPTIONS: MISCONCEPTIONS
  };
});
