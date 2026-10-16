/* Tests for player/printable.js - printable worksheet + exit-ticket
 * renderer (issue #758). Node-only, zero dependencies: every render
 * function is a pure spec -> HTML-string transform.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const printable = require('../player/printable.js');
const validate = require('../player/validate.js');

const ROOT = path.join(__dirname, '..');
const worksheet = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/worksheets/primary-science-water-cycle.json'), 'utf8'));
const ticket = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/tickets/primary-science-water-cycle.json'), 'utf8'));
const notes = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/notes/primary-science-water-cycle.json'), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/scripts/primary-science-water-cycle.json'), 'utf8'));

function teacherOnlyStrings(spec) {
  const out = [];
  for (const q of spec.questions) {
    if (q.explanation) out.push(q.explanation);
    if (q.feedback) out.push(q.feedback);
    if (q.misconception) out.push(q.misconception);
    if (q.kind === 'short-answer') out.push(q.answer);
  }
  return out;
}

describe('gold samples', () => {
  test('both gold samples validate with zero errors', () => {
    assert.deepEqual(validate.validateWorksheet(worksheet), []);
    assert.deepEqual(validate.validateExitTicket(ticket), []);
  });

  test('all four renders are non-empty and carry title and topic', () => {
    const renders = [
      [printable.renderWorksheet(worksheet), worksheet],
      [printable.renderWorksheetAnswerKey(worksheet), worksheet],
      [printable.renderExitTicket(ticket), ticket],
      [printable.renderExitTicketAnswerKey(ticket), ticket],
    ];
    for (const [html, spec] of renders) {
      assert.ok(html.length > 0);
      assert.ok(html.includes(spec.title), 'title present');
      assert.ok(html.includes(spec.topic), 'topic present');
      assert.ok(html.includes(spec.subject), 'subject present');
    }
    assert.ok(printable.renderWorksheet(worksheet).includes('pr-student'));
    assert.ok(printable.renderWorksheetAnswerKey(worksheet).includes('pr-teacher'));
    assert.ok(printable.renderWorksheetAnswerKey(worksheet).includes('pr-answer-key'));
    assert.ok(printable.renderExitTicket(ticket).includes('pr-student'));
    assert.ok(printable.renderExitTicketAnswerKey(ticket).includes('pr-teacher'));
  });

  test('student renders contain every prompt and every choice text', () => {
    for (const [html, spec] of [
      [printable.renderWorksheet(worksheet), worksheet],
      [printable.renderExitTicket(ticket), ticket],
    ]) {
      for (const q of spec.questions) {
        assert.ok(html.includes(q.prompt), 'prompt present: ' + q.id);
        if (q.kind === 'multiple-choice') {
          for (const c of q.choices) assert.ok(html.includes(c.text), 'choice present: ' + c.text);
        }
      }
    }
  });

  test('student renders never leak teacher content or correct markers', () => {
    for (const [html, spec] of [
      [printable.renderWorksheet(worksheet), worksheet],
      [printable.renderExitTicket(ticket), ticket],
    ]) {
      for (const s of teacherOnlyStrings(spec)) {
        assert.ok(!html.includes(s), 'leaked teacher string: ' + s.slice(0, 40));
      }
      assert.ok(!html.includes('correct'), 'no correct marker');
      assert.ok(!html.includes('data-correct'), 'no data-correct marker');
      assert.ok(!html.includes('Misconception:'), 'no misconception label');
    }
  });

  test('teacher renders contain every answer, explanation, misconception and feedback', () => {
    const wsKey = printable.renderWorksheetAnswerKey(worksheet);
    for (const q of worksheet.questions) {
      if (q.kind === 'multiple-choice') {
        const right = q.choices.find((c) => c.correct === true);
        assert.ok(wsKey.includes(right.text), 'correct text present: ' + q.id);
      } else {
        assert.ok(wsKey.includes(q.answer), 'answer present: ' + q.id);
      }
      if (q.explanation) assert.ok(wsKey.includes(q.explanation), 'explanation present: ' + q.id);
      if (q.misconception) assert.ok(wsKey.includes('Misconception: ' + q.misconception), 'misconception present: ' + q.id);
    }
    const tkKey = printable.renderExitTicketAnswerKey(ticket);
    for (const q of ticket.questions) {
      if (q.kind === 'multiple-choice') {
        const right = q.choices.find((c) => c.correct === true);
        assert.ok(tkKey.includes(right.text), 'correct text present: ' + q.id);
      } else {
        assert.ok(tkKey.includes(q.answer), 'answer present: ' + q.id);
      }
      if (q.feedback) assert.ok(tkKey.includes(q.feedback), 'feedback present: ' + q.id);
      if (q.misconception) assert.ok(tkKey.includes('Misconception: ' + q.misconception), 'misconception present: ' + q.id);
    }
  });
});

describe('escapeHtml and hostile specs', () => {
  test('escapeHtml escapes &, <, > and " with & first', () => {
    assert.equal(printable.escapeHtml('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
    assert.equal(printable.escapeHtml('&lt;'), '&amp;lt;');
    assert.equal(printable.escapeHtml('plain'), 'plain');
  });

  test('hostile spec renders escaped with no raw script tag', () => {
    const hostile = {
      title: 'Evil <script>alert("x")</script> & Co',
      level: 'primary', subject: 'science & "tech"', topic: 'water-cycle',
      questions: [
        {
          id: 'q1', kind: 'multiple-choice',
          prompt: 'Pick <b>one</b> & "go"',
          choices: [
            { text: '<script>bad()</script>', correct: true },
            { text: 'Safe & sound' },
          ],
          explanation: 'Because <script>alert(1)</script> & "reasons"',
          misconception: 'Bad <idea> & co',
        },
      ],
    };
    const student = printable.renderWorksheet(hostile);
    const key = printable.renderWorksheetAnswerKey(hostile);
    for (const html of [student, key]) {
      assert.ok(!html.includes('<script'), 'no raw script tag');
      assert.ok(html.includes('&lt;script&gt;'), 'script escaped');
      assert.ok(html.includes('&amp;'), 'ampersand escaped');
      assert.ok(html.includes('&quot;'), 'quote escaped');
    }
    assert.ok(key.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'explanation escaped');
  });
});

describe('optional branches with synthetic minimal specs', () => {
  const minimalWorksheet = {
    title: 'Minimal', level: 'primary', subject: 'math', topic: 'fractions',
    questions: [
      { id: 'q1', kind: 'short-answer', prompt: 'What is half of 4?', answer: '2' },
    ],
  };

  test('worksheet without instructions or optional question fields renders', () => {
    const student = printable.renderWorksheet(minimalWorksheet);
    assert.ok(!student.includes('pr-instructions'));
    assert.ok(student.includes('pr-answer-lines'));
    const key = printable.renderWorksheetAnswerKey(minimalWorksheet);
    assert.ok(key.includes('Answer: 2'));
    assert.ok(!key.includes('pr-explanation'));
    assert.ok(!key.includes('pr-misconception'));
  });

  test('worksheet with instructions and a bare multiple-choice question renders', () => {
    const spec = {
      title: 'With Instructions', level: 'secondary', subject: 'math', topic: 'algebra',
      instructions: 'Answer every question.',
      questions: [
        {
          id: 'q1', kind: 'multiple-choice', prompt: 'What is 1 + 1?',
          choices: [{ text: '2', correct: true }, { text: '3' }],
        },
      ],
    };
    const student = printable.renderWorksheet(spec);
    assert.ok(student.includes('Answer every question.'));
    assert.ok(student.includes('pr-choices'));
    const key = printable.renderWorksheetAnswerKey(spec);
    assert.ok(key.includes('Answer: 2'));
    assert.ok(!key.includes('pr-feedback'));
  });

  test('empty-string instructions are not rendered', () => {
    const spec = Object.assign({}, minimalWorksheet, { instructions: '' });
    assert.ok(!printable.renderWorksheet(spec).includes('pr-instructions'));
  });

  test('exit ticket with questions lacking feedback and misconception renders', () => {
    const spec = {
      title: 'Bare Ticket', level: 'jc', subject: 'geography', topic: 'rivers',
      questions: [
        { id: 'q1', kind: 'short-answer', prompt: 'Name a river.', answer: 'The Nile' },
        {
          id: 'q2', kind: 'multiple-choice', prompt: 'Pick a sea.',
          choices: [{ text: 'The North Sea', correct: true }, { text: 'The Sahara' }],
        },
        { id: 'q3', kind: 'short-answer', prompt: 'Name a lake.', answer: 'Lake Victoria', feedback: 'Good recall.' },
      ],
    };
    const student = printable.renderExitTicket(spec);
    assert.ok(student.includes('Name a river.'));
    assert.ok(!student.includes('The Nile'));
    const key = printable.renderExitTicketAnswerKey(spec);
    assert.ok(key.includes('Answer: The Nile'));
    assert.ok(key.includes('Feedback: Good recall.'));
    assert.ok(!key.includes('Misconception:'));
  });
});

describe('validation and validator resolution', () => {
  test('invalid specs throw with the invalid worksheet / exit ticket prefix', () => {
    assert.throws(() => printable.renderWorksheet({}), /invalid worksheet:/);
    assert.throws(() => printable.renderWorksheetAnswerKey(null), /invalid worksheet:/);
    assert.throws(() => printable.renderExitTicket({}), /invalid exit ticket:/);
    assert.throws(() => printable.renderExitTicketAnswerKey(minimalTicketBad()), /invalid exit ticket:/);
  });

  function minimalTicketBad() {
    return { title: 'T', level: 'primary', subject: 'math', topic: 'x', questions: [] };
  }

  test('validator resolves through the AnimathValidate global when present', () => {
    globalThis.AnimathValidate = validate;
    try {
      assert.ok(printable.renderWorksheet(worksheet).includes(worksheet.title));
      assert.ok(printable.renderExitTicket(ticket).includes(ticket.title));
    } finally {
      delete globalThis.AnimathValidate;
    }
  });

  test('a global validator without the functions throws the missing-validator error', () => {
    globalThis.AnimathValidate = {};
    try {
      assert.throws(() => printable.renderWorksheet(worksheet), /animath printable: player\/validate\.js is missing/);
      assert.throws(() => printable.renderExitTicket(ticket), /animath printable: player\/validate\.js is missing/);
    } finally {
      delete globalThis.AnimathValidate;
    }
  });
});

describe('notes and script gold samples', () => {
  test('both gold samples validate with zero errors', () => {
    assert.deepEqual(validate.validateNotes(notes), []);
    assert.deepEqual(validate.validateScript(script), []);
  });

  test('notes and script renders are non-empty and carry title, topic and subject', () => {
    for (const [html, spec] of [
      [printable.renderNotes(notes), notes],
      [printable.renderScript(script), script],
    ]) {
      assert.ok(html.length > 0);
      assert.ok(html.includes(spec.title), 'title present');
      assert.ok(html.includes(spec.topic), 'topic present');
      assert.ok(html.includes(spec.subject), 'subject present');
    }
    const notesHtml = printable.renderNotes(notes);
    assert.ok(notesHtml.includes('pr-sheet pr-notes'));
    assert.ok(notesHtml.includes('Student notes'));
    assert.ok(notesHtml.includes('pr-objectives'));
    assert.ok(notesHtml.includes('pr-definitions'));
    assert.ok(notesHtml.includes('pr-mechanism-steps'));
    assert.ok(notesHtml.includes('pr-worked-example'));
    assert.ok(notesHtml.includes('pr-trap'));
    const scriptHtml = printable.renderScript(script);
    assert.ok(scriptHtml.includes('pr-sheet pr-script'));
    assert.ok(scriptHtml.includes('Teacher script'));
    assert.ok(scriptHtml.includes('pr-segments'));
  });

  test('notes render contains every objective, definition, step, worked example and trap', () => {
    const html = printable.renderNotes(notes);
    for (const o of notes.objectives) assert.ok(html.includes(o), 'objective present');
    for (const d of notes.definitions) {
      assert.ok(html.includes(d.term), 'term present: ' + d.term);
      assert.ok(html.includes(d.meaning), 'meaning present: ' + d.term);
    }
    for (const s of notes.mechanismSteps) assert.ok(html.includes(s), 'step present');
    assert.ok(html.includes(notes.workedExample), 'worked example present');
    assert.ok(html.includes(notes.trap.misconception), 'trap misconception present');
    assert.ok(html.includes(notes.trap.explanation), 'trap explanation present');
  });

  test('script render contains every segment and the summed total of 30 minutes', () => {
    const html = printable.renderScript(script);
    assert.ok(html.includes('Total: 30 minutes'), 'total line pinned');
    for (const seg of script.segments) {
      assert.ok(html.includes(seg.say), 'say present');
      assert.ok(html.includes(seg.minutes + ' minutes'), 'minutes present');
      if (seg.cue) assert.ok(html.includes('Cue: ' + seg.cue), 'cue present');
      if (seg.questions) for (const q of seg.questions) assert.ok(html.includes(q), 'question present');
      if (seg.watchFor) assert.ok(html.includes('Watch for: ' + seg.watchFor), 'watchFor present');
    }
  });
});

describe('notes and script hostile and optional branches', () => {
  test('hostile notes spec renders escaped with no raw script tag', () => {
    const hostile = {
      title: 'Evil <script>alert("x")</script> & Co',
      level: 'primary', subject: 'science & "tech"', topic: 'water-cycle',
      objectives: ['Learn <b>this</b> & "that"'],
      definitions: [{ term: '<script>term()</script>', meaning: 'Means <i>stuff</i> & things' }],
      mechanismSteps: ['Step <script>one</script> & done'],
      workedExample: 'Example <script>alert(2)</script> & "quoted"',
      trap: { misconception: 'Bad <idea> & co', explanation: 'Wrong because <script>alert(3)</script>' },
    };
    const html = printable.renderNotes(hostile);
    assert.ok(!html.includes('<script'), 'no raw script tag');
    assert.ok(html.includes('&lt;script&gt;'), 'script escaped');
    assert.ok(html.includes('&amp;'), 'ampersand escaped');
    assert.ok(html.includes('&quot;'), 'quote escaped');
    assert.ok(html.includes('&lt;script&gt;alert(3)&lt;/script&gt;'), 'trap explanation escaped');
  });

  test('hostile script spec renders escaped with no raw script tag', () => {
    const hostile = {
      title: 'Evil <script>alert("x")</script> & Co',
      level: 'primary', subject: 'science', topic: 'water-cycle',
      segments: [
        {
          minutes: 10, say: 'Say <script>alert(1)</script> & "go"',
          cue: '<b>cue</b> & co', questions: ['Ask <i>this</i>?'],
          watchFor: 'Watch <script>bad()</script> & co',
        },
      ],
    };
    const html = printable.renderScript(hostile);
    assert.ok(!html.includes('<script'), 'no raw script tag');
    assert.ok(html.includes('&lt;script&gt;'), 'script escaped');
    assert.ok(html.includes('&amp;'), 'ampersand escaped');
    assert.ok(html.includes('&quot;'), 'quote escaped');
    assert.ok(html.includes('Total: 10 minutes'), 'total present');
  });

  test('notes with and without instructions renders', () => {
    const base = {
      title: 'Plain Notes', level: 'primary', subject: 'math', topic: 'fractions',
      objectives: ['Add fractions'], definitions: [{ term: 'Half', meaning: 'One of two equal parts' }],
      mechanismSteps: ['Find a common denominator'], workedExample: '1/2 + 1/2 = 1',
      trap: { misconception: 'Add the denominators', explanation: 'Denominators name the part size' },
    };
    const plain = printable.renderNotes(base);
    assert.ok(!plain.includes('pr-instructions'));
    const withInstr = printable.renderNotes(Object.assign({}, base, { instructions: 'Read before the lesson.' }));
    assert.ok(withInstr.includes('Read before the lesson.'));
    assert.ok(withInstr.includes('pr-instructions'));
  });

  test('script bare segment renders without cue, questions or watchFor', () => {
    const spec = {
      title: 'Bare Script', level: 'secondary', subject: 'math', topic: 'algebra',
      segments: [{ minutes: 10, say: 'Just talk.' }],
    };
    const html = printable.renderScript(spec);
    assert.ok(html.includes('Just talk.'));
    assert.ok(html.includes('Total: 10 minutes'));
    assert.ok(!html.includes('pr-cue'));
    assert.ok(!html.includes('pr-segment-questions'));
    assert.ok(!html.includes('pr-watch-for'));
  });

  test('script full segment renders cue, questions and watchFor', () => {
    const spec = {
      title: 'Full Script', level: 'secondary', subject: 'math', topic: 'algebra',
      segments: [{ minutes: 15, say: 'Explain it.', cue: 'board', questions: ['Why?'], watchFor: 'Sign errors' }],
    };
    const html = printable.renderScript(spec);
    assert.ok(html.includes('Cue: board'));
    assert.ok(html.includes('pr-segment-questions'));
    assert.ok(html.includes('Why?'));
    assert.ok(html.includes('Watch for: Sign errors'));
  });
});

describe('notes and script validation and validator resolution', () => {
  test('invalid specs throw with the invalid notes / script prefix', () => {
    assert.throws(() => printable.renderNotes({}), /invalid notes:/);
    assert.throws(() => printable.renderNotes(null), /invalid notes:/);
    assert.throws(() => printable.renderScript({}), /invalid script:/);
    assert.throws(() => printable.renderScript(null), /invalid script:/);
  });

  test('validator resolves through the AnimathValidate global when present', () => {
    globalThis.AnimathValidate = validate;
    try {
      assert.ok(printable.renderNotes(notes).includes(notes.title));
      assert.ok(printable.renderScript(script).includes(script.title));
    } finally {
      delete globalThis.AnimathValidate;
    }
  });

  test('a global validator without the functions throws the missing-validator error', () => {
    globalThis.AnimathValidate = {};
    try {
      assert.throws(() => printable.renderNotes(notes), /animath printable: player\/validate\.js is missing/);
      assert.throws(() => printable.renderScript(script), /animath printable: player\/validate\.js is missing/);
    } finally {
      delete globalThis.AnimathValidate;
    }
  });
});

describe('printable demo page', () => {
  const demo = fs.readFileSync(path.join(ROOT, 'player', 'printable-demo.html'), 'utf8');

  test('demo fetches and validates notes and script before rendering them', () => {
    assert.ok(demo.includes('samples/notes/primary-science-water-cycle.json'));
    assert.ok(demo.includes('samples/scripts/primary-science-water-cycle.json'));
    assert.ok(demo.includes('AnimathValidate.validateNotes'));
    assert.ok(demo.includes('AnimathValidate.validateScript'));
    assert.ok(demo.includes('AnimathPrintable.renderNotes'));
    assert.ok(demo.includes('AnimathPrintable.renderScript'));
    assert.ok(demo.indexOf('AnimathValidate.validateNotes') < demo.indexOf('AnimathPrintable.renderNotes'));
    assert.ok(demo.indexOf('AnimathValidate.validateScript') < demo.indexOf('AnimathPrintable.renderScript'));
  });
});

describe('printable.css print rules', () => {
  const css = fs.readFileSync(path.join(ROOT, 'player', 'printable.css'), 'utf8');

  test('print media hides screen-only controls', () => {
    assert.ok(css.includes('@media print'));
    assert.ok(/\.pr-screen-only\s*\{\s*display:\s*none/.test(css));
  });

  test('teacher sections start on a new printed page', () => {
    assert.ok(/\.pr-teacher\s*\{\s*break-before:\s*page/.test(css));
  });

  test('notes and script classes are styled', () => {
    for (const cls of ['pr-objectives', 'pr-definitions', 'pr-term', 'pr-meaning', 'pr-mechanism-steps', 'pr-worked-example', 'pr-trap', 'pr-total-minutes', 'pr-segments', 'pr-segment', 'pr-cue', 'pr-watch-for']) {
      assert.ok(css.includes('.' + cls), 'css covers .' + cls);
    }
  });
});
