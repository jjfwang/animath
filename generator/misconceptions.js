/* animath misconception library — per-topic wrong-turn beats for the generator.
 * Slice 1 (issue #101): the 12 Primary Math topics. Each entry is grounded in
 * the matching sample's misconception scene (samples/primary-math-*.json).
 * Slice 2 (issue #103): the 8 Primary Science topics (human-body-systems,
 * plant-systems, life-cycles, water-cycle, energy-forms, photosynthesis,
 * forces-magnets, adaptations), grounded in the matching misconception scenes
 * in samples/primary-science-*.json.
 * Slice 3 (issue #105): the 14 Secondary Math topics, grounded in the
 * matching misconception scenes in samples/secondary-e-*.json and
 * samples/secondary-a-*.json.
 *
 * Slug naming note: the map is keyed on the short topic slugs that
 * buildPrompts receives (the issue's slugs), which match the samples' topic
 * fields exactly:
 *   decimals-place-value.json -> topic "decimals"  (key: decimals)
 *   fractions-addition.json   -> topic "fractions" (key: fractions)
 *   percentage-of-quantity.json -> topic "percentage" (key: percentage)
 *   ratio-sharing.json        -> topic "ratio"     (key: ratio)
 *   photosynthesis-intro.json -> topic "photosynthesis" (key: photosynthesis)
 * Callers sometimes pass the longer file-style slug (e.g. "fractions-addition"
 * or "percentage-of-quantity"); misconceptionFor() in build_prompt.js also
 * tries the longest matching key prefix so those still resolve.
 *
 * Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
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
    },
    'human-body-systems': {
      wrongTurn: 'The heart uses up the blood it pumps, so the body must keep making fresh blood.',
      why: 'A pump feels like it burns fuel, so the blood seems to disappear as it travels.',
      correctTurn: 'Blood is never used up: it keeps going round in a loop, coming back to the heart to be pushed around again.'
    },
    'plant-systems': {
      wrongTurn: 'Plants take food from the soil through their roots, like we eat food.',
      why: 'We eat through our mouths, so the roots look like a mouth for the plant.',
      correctTurn: 'Roots drink water and minerals; the leaves make the food with sunlight. The plant does not eat food like we do.'
    },
    'life-cycles': {
      wrongTurn: 'The flower is the end of the life of the plant.',
      why: 'The flower is the biggest, showiest and last part to appear, so it looks like the finish.',
      correctTurn: 'The flower is not the end: inside the flower new seeds are forming, and the cycle starts again.'
    },
    'water-cycle': {
      wrongTurn: 'Water disappears for good once it evaporates.',
      why: 'The water turns invisible as vapour, so it looks like it has gone away.',
      correctTurn: 'It is still there as invisible vapour; cooled into clouds it falls back as rain and returns to the sea.'
    },
    'energy-forms': {
      wrongTurn: 'Energy is used up, like fuel disappearing from a tank.',
      why: 'A lamp or a toy runs out, so the energy feels consumed.',
      correctTurn: 'Energy is never used up: it changes form and moves somewhere else.'
    },
    'photosynthesis': {
      wrongTurn: 'Only animals breathe; plants do not.',
      why: 'Plants have no nose and no moving chest, so breathing is never seen.',
      correctTurn: 'Plants take in and give out gases too: they respire all the time, day and night, just like us.'
    },
    'forces-magnets': {
      wrongTurn: 'A magnet attracts every kind of metal.',
      why: 'Magnets grab some metals so strongly that they feel like they grab all of them.',
      correctTurn: 'Magnets ignore most things: they only pull iron and a few metals.'
    },
    'adaptations': {
      wrongTurn: 'An animal can decide to grow a new feature when it needs one.',
      why: 'The feature fits the animal so well that it looks chosen on purpose.',
      correctTurn: 'These features did not appear overnight: they developed over many, many generations, not by choice.'
    },
    'e-numbers': {
      wrongTurn: 'Adding powers: 2^3 + 2^4 = 2^7.',
      why: 'The same-base index rule is for multiplying, but it gets misapplied to addition.',
      correctTurn: 'The index rule is for multiplying, never adding: 8 + 16 = 24, not 128.'
    },
    'e-algebra': {
      wrongTurn: '(a + b)^2 = a^2 + b^2.',
      why: 'The power looks like it lands on each term of the sum.',
      correctTurn: 'The full expansion has three terms: check a = 2, b = 3, and 25 is not 13.'
    },
    'e-functions-graphs': {
      wrongTurn: 'The line with the bigger intercept is steeper.',
      why: 'The intercept is the visible height, so it feels like the climb.',
      correctTurn: 'Steepness is the gradient, not the intercept: compare m, never c.'
    },
    'e-geometry': {
      wrongTurn: 'Two shapes with the same area are congruent.',
      why: 'Equal measure feels like equal shape.',
      correctTurn: 'Equal area says nothing about shape: congruence needs every matching side and angle.'
    },
    'e-trigonometry': {
      wrongTurn: 'tan = adjacent / opposite.',
      why: 'Opposite and adjacent swap places under pressure.',
      correctTurn: 'Always read TOA: tan is opposite over adjacent.'
    },
    'e-mensuration': {
      wrongTurn: 'Doubling the radius doubles the area of a circle.',
      why: 'Doubling a length doubles lengths, so area feels like it doubles too.',
      correctTurn: 'Area scales with the square of the radius: double the radius and the area quadruples.'
    },
    'e-statistics': {
      wrongTurn: 'The mean always describes the typical score.',
      why: 'One extreme score drags the mean away from the bulk of the data.',
      correctTurn: 'The mean follows the outlier, the median resists it: report both when an outlier is present.'
    },
    'e-probability': {
      wrongTurn: 'After three heads, tails is due.',
      why: 'A streak feels like it must balance out.',
      correctTurn: 'The coin has no memory: the next toss is still 1/2.'
    },
    'a-quadratic-functions': {
      wrongTurn: 'A negative discriminant means the equation has no solution.',
      why: 'No real roots is read as no solutions at all.',
      correctTurn: 'No real roots is not no solution: the equation still has two complex roots.'
    },
    'a-binomial': {
      wrongTurn: '(a + b)^2 = a^2 + b^2.',
      why: 'The power is distributed over the sum and the middle term is dropped.',
      correctTurn: 'The missing middle term 2ab is the whole trap: (1 + 2)^2 is 9, not 5.'
    },
    'a-trigonometry': {
      wrongTurn: 'cos(A + B) = cos A + cos B.',
      why: 'Cosine looks like it splits across the sum.',
      correctTurn: 'Use cos A cos B - sin A sin B: cos 60 is 0.5 but cos 30 + cos 30 is about 1.73.'
    },
    'a-differentiation': {
      wrongTurn: 'dy/dx = 0 means a maximum or minimum.',
      why: 'Zero gradient is always tied to turning points.',
      correctTurn: 'Stationary is not always max or min: check the sign change. y = x^3 at x = 0 is stationary and still climbing.'
    },
    'a-integration': {
      wrongTurn: 'The integral of 2x is x^2.',
      why: 'The constant term is forgotten.',
      correctTurn: 'Never drop the +C: differentiating x^2 + 5 and x^2 + 7 both give 2x.'
    },
    'a-kinematics': {
      wrongTurn: 'A straight s-t graph means constant acceleration.',
      why: 'Straight-line growth reads as speeding up.',
      correctTurn: 'The gradient of s-t is velocity: a straight s-t graph has constant velocity and zero acceleration.'
    }
  };

  return {
    MISCONCEPTIONS: MISCONCEPTIONS
  };
});
