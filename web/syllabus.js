/* animath syllabus data for the web picker. Mirrors SYLLABUS.md.
 * Tracks group topics for usability; each track carries its SPEC.md subject.
 */
window.ANIMATH_SYLLABUS = {
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
