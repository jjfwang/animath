/* Printable worksheet + exit-ticket renderer - zero-dependency
 * student sheet and teacher answer-key renderer (issue #758).
 *
 * Renders a worksheet validated by AnimathValidate.validateWorksheet
 * or an exit ticket validated by AnimathValidate.validateExitTicket
 * (SPEC.md "Worksheet spec" / "Exit ticket spec") to HTML strings.
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

  var api = {
    renderWorksheet: renderWorksheet,
    renderWorksheetAnswerKey: renderWorksheetAnswerKey,
    renderExitTicket: renderExitTicket,
    renderExitTicketAnswerKey: renderExitTicketAnswerKey,
    escapeHtml: escapeHtml
  };
  global.AnimathPrintable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
