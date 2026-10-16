/* Printable worksheet + exit-ticket renderer - zero-dependency
 * student sheet and teacher answer-key renderer (issue #758), plus
 * printable student notes and teacher script renderer (issue #766).
 *
 * Renders a worksheet validated by AnimathValidate.validateWorksheet,
 * an exit ticket validated by AnimathValidate.validateExitTicket,
 * student notes validated by AnimathValidate.validateNotes, or a
 * teacher script validated by AnimathValidate.validateScript
 * (SPEC.md "Worksheet spec" / "Exit ticket spec" / "Student notes
 * spec" / "Teacher script spec") to HTML strings.
 *
 * Student/teacher separation is structural (the presenter speaker-notes
 * precedent): the student functions never read choices[].correct,
 * answer, explanation, feedback, or misconception, so teacher content
 * cannot leak into a student sheet. The teacher functions are separate
 * entry points that render the answer key.
 *
 * UMD, zero dependencies, no DOM at load: every function is a pure
 * spec -> HTML-string transform, node-testable without fakes.
 *
 * Usage from a demo page (thin bootstrap only):
 *   var html = AnimathPrintable.renderWorksheet(spec);
 */
(function (global) {
  'use strict';

  function getValidateWorksheet() {
    var g = global.AnimathValidate;
    if (g) return g.validateWorksheet || null;
    return typeof require !== 'undefined' ? require('./validate.js').validateWorksheet : null;
  }

  function getValidateExitTicket() {
    var g = global.AnimathValidate;
    if (g) return g.validateExitTicket || null;
    return typeof require !== 'undefined' ? require('./validate.js').validateExitTicket : null;
  }

  function getValidateNotes() {
    var g = global.AnimathValidate;
    if (g) return g.validateNotes || null;
    return typeof require !== 'undefined' ? require('./validate.js').validateNotes : null;
  }

  function getValidateScript() {
    var g = global.AnimathValidate;
    if (g) return g.validateScript || null;
    return typeof require !== 'undefined' ? require('./validate.js').validateScript : null;
  }

  function assertValidWorksheet(spec) {
    var fn = getValidateWorksheet();
    if (!fn) throw new Error('animath printable: player/validate.js is missing - include it before printable.js so specs can be validated');
    var errors = fn(spec);
    if (errors.length) throw new Error('invalid worksheet: ' + errors.join('; '));
  }

  function assertValidExitTicket(spec) {
    var fn = getValidateExitTicket();
    if (!fn) throw new Error('animath printable: player/validate.js is missing - include it before printable.js so specs can be validated');
    var errors = fn(spec);
    if (errors.length) throw new Error('invalid exit ticket: ' + errors.join('; '));
  }

  function assertValidNotes(spec) {
    var fn = getValidateNotes();
    if (!fn) throw new Error('animath printable: player/validate.js is missing - include it before printable.js so specs can be validated');
    var errors = fn(spec);
    if (errors.length) throw new Error('invalid notes: ' + errors.join('; '));
  }

  function assertValidScript(spec) {
    var fn = getValidateScript();
    if (!fn) throw new Error('animath printable: player/validate.js is missing - include it before printable.js so specs can be validated');
    var errors = fn(spec);
    if (errors.length) throw new Error('invalid script: ' + errors.join('; '));
  }

  // HTML-escape for text content and double-quoted attribute values,
  // the export-frames.js esc chain: & first, then <, >, ".
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sheetHeader(spec, kindClass, kindLabel) {
    var parts = [];
    parts.push('<section class="' + kindClass + '">');
    parts.push('<h1 class="pr-title">' + escapeHtml(spec.title) + '</h1>');
    parts.push('<p class="pr-meta">' + escapeHtml(spec.subject) + ' · ' +
      escapeHtml(spec.topic) + ' · ' + escapeHtml(spec.level) + '</p>');
    parts.push('<p class="pr-kind">' + kindLabel + '</p>');
    if (typeof spec.instructions === 'string' && spec.instructions.length > 0) {
      parts.push('<p class="pr-instructions">' + escapeHtml(spec.instructions) + '</p>');
    }
    return parts;
  }

  // Student sheet: prompts and choice texts only. This function must
  // never read choices[].correct, answer, explanation, feedback, or
  // misconception - see the header comment.
  function renderStudentSheet(spec, kindClass, kindLabel) {
    var parts = sheetHeader(spec, kindClass, kindLabel);
    parts.push('<ol class="pr-questions">');
    spec.questions.forEach(function (q) {
      parts.push('<li class="pr-question">');
      parts.push('<p class="pr-prompt">' + escapeHtml(q.prompt) + '</p>');
      if (q.kind === 'multiple-choice') {
        parts.push('<ul class="pr-choices">');
        q.choices.forEach(function (choice) {
          parts.push('<li class="pr-choice">' + escapeHtml(choice.text) + '</li>');
        });
        parts.push('</ul>');
      } else {
        parts.push('<div class="pr-answer-lines">' +
          '<span class="pr-answer-line"></span>' +
          '<span class="pr-answer-line"></span>' +
          '<span class="pr-answer-line"></span></div>');
      }
      parts.push('</li>');
    });
    parts.push('</ol>');
    parts.push('</section>');
    return parts.join('\n');
  }

  // Teacher answer key: the correct/expected answer per question, plus
  // the explanation, feedback, and misconception where present.
  function renderAnswerKey(spec, kindClass, kindLabel) {
    var parts = sheetHeader(spec, kindClass, kindLabel);
    parts.push('<ol class="pr-questions">');
    spec.questions.forEach(function (q) {
      parts.push('<li class="pr-question">');
      parts.push('<p class="pr-prompt">' + escapeHtml(q.prompt) + '</p>');
      if (q.kind === 'multiple-choice') {
        q.choices.forEach(function (choice) {
          if (choice.correct === true) {
            parts.push('<p class="pr-answer">Answer: ' + escapeHtml(choice.text) + '</p>');
          }
        });
      } else {
        parts.push('<p class="pr-answer">Answer: ' + escapeHtml(q.answer) + '</p>');
      }
      if (q.explanation) {
        parts.push('<p class="pr-explanation">' + escapeHtml(q.explanation) + '</p>');
      }
      if (q.feedback) {
        parts.push('<p class="pr-feedback">Feedback: ' + escapeHtml(q.feedback) + '</p>');
      }
      if (q.misconception) {
        parts.push('<p class="pr-misconception">Misconception: ' + escapeHtml(q.misconception) + '</p>');
      }
      parts.push('</li>');
    });
    parts.push('</ol>');
    parts.push('</section>');
    return parts.join('\n');
  }

  function renderWorksheet(spec) {
    assertValidWorksheet(spec);
    return renderStudentSheet(spec, 'pr-sheet pr-student pr-worksheet', 'Worksheet');
  }

  function renderWorksheetAnswerKey(spec) {
    assertValidWorksheet(spec);
    return renderAnswerKey(spec, 'pr-sheet pr-teacher pr-answer-key pr-worksheet', 'Worksheet answer key');
  }

  function renderExitTicket(spec) {
    assertValidExitTicket(spec);
    return renderStudentSheet(spec, 'pr-sheet pr-student pr-exit-ticket', 'Exit ticket');
  }

  function renderExitTicketAnswerKey(spec) {
    assertValidExitTicket(spec);
    return renderAnswerKey(spec, 'pr-sheet pr-teacher pr-answer-key pr-exit-ticket', 'Exit ticket answer key');
  }

  // Student notes: objectives, definitions, mechanism steps, a worked
  // example, and the trap (misconception plus why it is wrong).
  function renderNotes(spec) {
    assertValidNotes(spec);
    var parts = sheetHeader(spec, 'pr-sheet pr-notes', 'Student notes');
    parts.push('<h2 class="pr-notes-heading">Objectives</h2>');
    parts.push('<ul class="pr-objectives">');
    spec.objectives.forEach(function (objective) {
      parts.push('<li class="pr-objective">' + escapeHtml(objective) + '</li>');
    });
    parts.push('</ul>');
    parts.push('<h2 class="pr-notes-heading">Definitions</h2>');
    parts.push('<dl class="pr-definitions">');
    spec.definitions.forEach(function (definition) {
      parts.push('<dt class="pr-term">' + escapeHtml(definition.term) + '</dt>');
      parts.push('<dd class="pr-meaning">' + escapeHtml(definition.meaning) + '</dd>');
    });
    parts.push('</dl>');
    parts.push('<h2 class="pr-notes-heading">How it works</h2>');
    parts.push('<ol class="pr-mechanism-steps">');
    spec.mechanismSteps.forEach(function (step) {
      parts.push('<li class="pr-mechanism-step">' + escapeHtml(step) + '</li>');
    });
    parts.push('</ol>');
    parts.push('<h2 class="pr-notes-heading">Worked example</h2>');
    parts.push('<p class="pr-worked-example">' + escapeHtml(spec.workedExample) + '</p>');
    parts.push('<section class="pr-trap">');
    parts.push('<h2 class="pr-notes-heading">Watch out: the trap</h2>');
    parts.push('<p class="pr-trap-misconception">' + escapeHtml(spec.trap.misconception) + '</p>');
    parts.push('<p class="pr-trap-explanation">' + escapeHtml(spec.trap.explanation) + '</p>');
    parts.push('</section>');
    parts.push('</section>');
    return parts.join('\n');
  }

  // Teacher script: timed segments in order, with the total lesson
  // time summed from the segment minutes. Cue, questions, and watchFor
  // render only when present on a segment.
  function renderScript(spec) {
    assertValidScript(spec);
    var parts = sheetHeader(spec, 'pr-sheet pr-script', 'Teacher script');
    var totalMinutes = spec.segments.reduce(function (sum, segment) {
      return sum + segment.minutes;
    }, 0);
    parts.push('<p class="pr-total-minutes">Total: ' + totalMinutes + ' minutes</p>');
    parts.push('<ol class="pr-segments">');
    spec.segments.forEach(function (segment) {
      parts.push('<li class="pr-segment">');
      parts.push('<p class="pr-segment-minutes">' + escapeHtml(segment.minutes) + ' minutes</p>');
      parts.push('<p class="pr-say">' + escapeHtml(segment.say) + '</p>');
      if (segment.cue) {
        parts.push('<p class="pr-cue">Cue: ' + escapeHtml(segment.cue) + '</p>');
      }
      if (segment.questions) {
        parts.push('<ul class="pr-segment-questions">');
        segment.questions.forEach(function (question) {
          parts.push('<li class="pr-segment-question">' + escapeHtml(question) + '</li>');
        });
        parts.push('</ul>');
      }
      if (segment.watchFor) {
        parts.push('<p class="pr-watch-for">Watch for: ' + escapeHtml(segment.watchFor) + '</p>');
      }
      parts.push('</li>');
    });
    parts.push('</ol>');
    parts.push('</section>');
    return parts.join('\n');
  }

  var api = {
    renderWorksheet: renderWorksheet,
    renderWorksheetAnswerKey: renderWorksheetAnswerKey,
    renderExitTicket: renderExitTicket,
    renderExitTicketAnswerKey: renderExitTicketAnswerKey,
    renderNotes: renderNotes,
    renderScript: renderScript,
    escapeHtml: escapeHtml
  };
  global.AnimathPrintable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
