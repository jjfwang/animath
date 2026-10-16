/* animath syllabus data for the generator (issue #770). Embedded copy of
 * the taxonomy in SYLLABUS.md / web/syllabus.js: the published package
 * ships generator/ but not web/syllabus.js, so the data is embedded here
 * rather than loaded from disk at runtime. tests/syllabus.test.js locks
 * all three sources 1:1 (slug, level, track, subject, in order).
 *
 * resolveSyllabusTopic(id, data?) resolves a syllabus id to its topic:
 * a bare slug (water-cycle) or the composite level/track/slug form
 * (primary/p-sci/water-cycle). It returns
 * {topic, topicLabel, level, subject, track} and throws synchronously
 * on unknown, malformed, or ambiguous ids, naming the raw id verbatim.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.AnimathSyllabus = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SYLLABUS = {
    levels: [
      {
        id: 'primary', label: 'Primary (PSLE)', tracks: [
          {
            id: 'p-math', label: 'Mathematics', subject: 'math', topics: [
            { slug: 'whole-numbers', label: 'Whole numbers' },
            { slug: 'fractions', label: 'Fractions' },
            { slug: 'decimals', label: 'Decimals' },
            { slug: 'percentage', label: 'Percentage' },
            { slug: 'ratio', label: 'Ratio' },
            { slug: 'rate-speed', label: 'Rate & speed' },
            { slug: 'algebra-intro', label: 'Algebra (intro)' },
            { slug: 'geometry-angles', label: 'Angles & shapes' },
            { slug: 'area-perimeter', label: 'Area & perimeter' },
            { slug: 'volume', label: 'Volume' },
            { slug: 'data-graphs', label: 'Data & graphs' },
            { slug: 'model-method', label: 'Bar model word problems' }
            ]
          },
          {
            id: 'p-sci', label: 'Science', subject: 'science', topics: [
            { slug: 'human-body-systems', label: 'Human body systems' },
            { slug: 'plant-systems', label: 'Plant parts & functions' },
            { slug: 'life-cycles', label: 'Life cycles' },
            { slug: 'water-cycle', label: 'Water cycle' },
            { slug: 'energy-forms', label: 'Forms of energy' },
            { slug: 'photosynthesis', label: 'Photosynthesis (intro)' },
            { slug: 'forces-magnets', label: 'Forces & magnets' },
            { slug: 'adaptations', label: 'Adaptations' }
            ]
          },
          {
            id: 'p-geog', label: 'Geography', subject: 'geography', topics: [
            { slug: 'erosion', label: 'Erosion' },
            { slug: 'plate-tectonics', label: 'Plate tectonics' },
            { slug: 'weather-climate', label: 'Weather & climate' }
            ]
          }
        ]
      },
      {
        id: 'secondary', label: 'Secondary (O/N-level)', tracks: [
          {
            id: 'e-math', label: 'E-Math', subject: 'math', topics: [
            { slug: 'e-numbers', label: 'Numbers' },
            { slug: 'e-algebra', label: 'Algebra' },
            { slug: 'e-functions-graphs', label: 'Functions & graphs' },
            { slug: 'e-geometry', label: 'Geometry' },
            { slug: 'e-trigonometry', label: 'Trigonometry' },
            { slug: 'e-mensuration', label: 'Mensuration' },
            { slug: 'e-statistics', label: 'Statistics' },
            { slug: 'e-probability', label: 'Probability' }
            ]
          },
          {
            id: 'a-math', label: 'A-Math', subject: 'math', topics: [
            { slug: 'a-quadratic-functions', label: 'Quadratic functions' },
            { slug: 'a-binomial', label: 'Binomial theorem' },
            { slug: 'a-trigonometry', label: 'Further trigonometry' },
            { slug: 'a-differentiation', label: 'Differentiation' },
            { slug: 'a-integration', label: 'Integration' },
            { slug: 'a-kinematics', label: 'Kinematics' }
            ]
          },
          {
            id: 'physics', label: 'Physics', subject: 'science', topics: [
            { slug: 'phys-kinematics', label: 'Kinematics' },
            { slug: 'phys-forces', label: 'Forces' },
            { slug: 'phys-energy', label: 'Energy, work & power' },
            { slug: 'phys-electricity', label: 'Electricity' },
            { slug: 'phys-waves', label: 'Waves' }
            ]
          },
          {
            id: 'chemistry', label: 'Chemistry', subject: 'science', topics: [
            { slug: 'chem-atomic', label: 'Atomic structure' },
            { slug: 'chem-bonding', label: 'Chemical bonding' },
            { slug: 'chem-acids', label: 'Acids, bases & salts' },
            { slug: 'chem-mole', label: 'Mole concept' }
            ]
          },
          {
            id: 'biology', label: 'Biology', subject: 'science', topics: [
            { slug: 'bio-cells', label: 'Cells' },
            { slug: 'bio-transport', label: 'Transport' },
            { slug: 'bio-nutrition', label: 'Nutrition' },
            { slug: 'bio-reproduction', label: 'Reproduction' },
            { slug: 'bio-ecology', label: 'Ecology' }
            ]
          }
        ]
      },
      {
        id: 'jc', label: 'Junior College (H2)', tracks: [
          {
            id: 'h2-math', label: 'H2 Mathematics', subject: 'math', topics: [
            { slug: 'h2-functions-graphs', label: 'Functions & graphs' },
            { slug: 'h2-sequences', label: 'Sequences & series' },
            { slug: 'h2-vectors', label: 'Vectors' },
            { slug: 'h2-complex', label: 'Complex numbers' },
            { slug: 'h2-differentiation', label: 'Differentiation' },
            { slug: 'h2-integration', label: 'Integration' },
            { slug: 'h2-probability', label: 'Probability' },
            { slug: 'h2-statistics', label: 'Statistics' }
            ]
          },
          {
            id: 'h2-physics', label: 'H2 Physics', subject: 'science', topics: [
            { slug: 'h2-mechanics', label: 'Mechanics' },
            { slug: 'h2-em', label: 'Electromagnetism' },
            { slug: 'h2-thermal', label: 'Thermal physics' },
            { slug: 'h2-quantum', label: 'Quantum physics' }
            ]
          },
          {
            id: 'h2-chemistry', label: 'H2 Chemistry', subject: 'science', topics: [
            { slug: 'h2-physical', label: 'Physical chemistry' },
            { slug: 'h2-inorganic', label: 'Inorganic chemistry' },
            { slug: 'h2-organic', label: 'Organic chemistry' }
            ]
          },
          {
            id: 'h2-biology', label: 'H2 Biology', subject: 'science', topics: [
            { slug: 'h2-cell-bio', label: 'Cell biology' },
            { slug: 'h2-genetics', label: 'Genetics' },
            { slug: 'h2-energetics', label: 'Energetics' },
            { slug: 'h2-ecology', label: 'Ecology' }
            ]
          }
        ]
      }
    ]
  };

  function malformedError(id) {
    return new Error('resolveSyllabusTopic: malformed syllabus id "' + String(id) + '"');
  }
  function unknownError(id) {
    return new Error('resolveSyllabusTopic: unknown syllabus id "' + String(id) + '"');
  }

  // Resolve a syllabus id against data (default SYLLABUS). Bare slug:
  // searched across every level/track; composite level/track/slug: each
  // segment must match in nesting. No case-folding beyond trimming id.
  function resolveSyllabusTopic(id, data) {
    var source = data === undefined ? SYLLABUS : data;
    if (typeof id !== 'string') throw malformedError(id);
    var trimmed = id.trim();
    if (trimmed.length === 0) throw malformedError(id);
    var parts = trimmed.split('/');
    var i, j, k;
    if (parts.length === 1) {
      if (parts[0].trim().length === 0) throw malformedError(id);
      var matches = [];
      for (i = 0; i < source.levels.length; i++) {
        for (j = 0; j < source.levels[i].tracks.length; j++) {
          var track = source.levels[i].tracks[j];
          for (k = 0; k < track.topics.length; k++) {
            if (track.topics[k].slug === parts[0]) {
              matches.push({
                topic: track.topics[k].slug,
                topicLabel: track.topics[k].label,
                level: source.levels[i].id,
                subject: track.subject,
                track: track.id
              });
            }
          }
        }
      }
      if (matches.length === 0) throw unknownError(id);
      if (matches.length > 1) {
        throw new Error('resolveSyllabusTopic: ambiguous syllabus id "' + String(id) +
          '" (matches multiple topics; use the composite level/track/topic-slug form)');
      }
      return matches[0];
    }
    if (parts.length === 3) {
      for (i = 0; i < parts.length; i++) {
        if (parts[i].trim().length === 0) throw malformedError(id);
      }
      for (i = 0; i < source.levels.length; i++) {
        if (source.levels[i].id !== parts[0]) continue;
        for (j = 0; j < source.levels[i].tracks.length; j++) {
          var tr = source.levels[i].tracks[j];
          if (tr.id !== parts[1]) continue;
          for (k = 0; k < tr.topics.length; k++) {
            if (tr.topics[k].slug === parts[2]) {
              return {
                topic: tr.topics[k].slug,
                topicLabel: tr.topics[k].label,
                level: source.levels[i].id,
                subject: tr.subject,
                track: tr.id
              };
            }
          }
        }
      }
      throw unknownError(id);
    }
    throw malformedError(id);
  }

  return { SYLLABUS: SYLLABUS, resolveSyllabusTopic: resolveSyllabusTopic };
});
