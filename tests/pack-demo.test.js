/* Tests for player/pack-demo.html - lesson pack demo page (issue #772).
 * Node-only, zero dependencies: the page is HTML glue, so its contract
 * is pinned by fs assertions in the style of the printable demo tests.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

describe('pack demo page', () => {
  const demo = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');

  test('page fetches all six gold materials', () => {
    assert.ok(demo.includes('../samples/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/decks/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/worksheets/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/notes/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/tickets/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/scripts/primary-science-water-cycle.json'));
    assert.ok(demo.includes('../samples/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/decks/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/worksheets/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/notes/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/tickets/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/scripts/primary-math-fractions-addition.json'));
    assert.ok(demo.includes('../samples/secondary-physics-waves.json'));
    assert.ok(demo.includes('../samples/decks/secondary-physics-waves.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-physics-waves.json'));
    assert.ok(demo.includes('../samples/notes/secondary-physics-waves.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-physics-waves.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-physics-waves.json'));
    assert.ok(demo.includes('Promise.all'));
  });

  test('page validates all six materials before any rendering', () => {
    assert.ok(demo.includes('AnimathValidate.validateSpec'));
    assert.ok(demo.includes('AnimathValidate.validateSlides'));
    assert.ok(demo.includes('AnimathValidate.validateWorksheet'));
    assert.ok(demo.includes('AnimathValidate.validateExitTicket'));
    assert.ok(demo.includes('AnimathValidate.validateNotes'));
    assert.ok(demo.includes('AnimathValidate.validateScript'));
    assert.ok(demo.indexOf('AnimathValidate.validateSpec') < demo.indexOf('AnimathPlayer.mount'));
    assert.ok(demo.indexOf('AnimathValidate.validateSlides') < demo.indexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(demo.indexOf('AnimathValidate.validateWorksheet') < demo.indexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(demo.indexOf('AnimathValidate.validateExitTicket') < demo.indexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(demo.indexOf('AnimathValidate.validateNotes') < demo.indexOf('AnimathPrintable.renderNotes'));
    assert.ok(demo.indexOf('AnimathValidate.validateScript') < demo.indexOf('AnimathPrintable.renderScript'));
    assert.ok(demo.includes('failed validation:'));
    assert.ok(demo.indexOf('AnimathValidate.validateSpec') < demo.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(demo.indexOf('AnimathValidate.validateSlides') < demo.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(demo.indexOf('AnimathValidate.validateWorksheet') < demo.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(demo.indexOf('AnimathValidate.validateExitTicket') < demo.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(demo.indexOf('AnimathValidate.validateNotes') < demo.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(demo.indexOf('AnimathValidate.validateScript') < demo.lastIndexOf('AnimathPrintable.renderScript'));
    const fractionsStart = demo.indexOf('fractionsAnimUrl');
    assert.ok(fractionsStart > -1);
    const fractionsBlock = demo.slice(fractionsStart);
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateSpec') < fractionsBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateSlides') < fractionsBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateWorksheet') < fractionsBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateExitTicket') < fractionsBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateNotes') < fractionsBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(fractionsBlock.indexOf('AnimathValidate.validateScript') < fractionsBlock.lastIndexOf('AnimathPrintable.renderScript'));
    const wavesStart = demo.indexOf('wavesAnimUrl');
    assert.ok(wavesStart > -1);
    const wavesBlock = demo.slice(wavesStart);
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateSpec') < wavesBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateSlides') < wavesBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateWorksheet') < wavesBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateExitTicket') < wavesBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateNotes') < wavesBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(wavesBlock.indexOf('AnimathValidate.validateScript') < wavesBlock.lastIndexOf('AnimathPrintable.renderScript'));
  });

  test('manifest header names the slug, level, subject and six material keys', () => {
    assert.ok(demo.includes('water-cycle-primary-science'));
    assert.ok(demo.includes('fractions-primary-math'));
    assert.ok(demo.includes('phys-waves-secondary-science'));
    assert.ok(demo.includes('primary'));
    assert.ok(demo.includes('secondary'));
    assert.ok(demo.includes('science'));
    assert.ok(demo.includes('math'));
    assert.ok(demo.includes('animation'));
    assert.ok(demo.includes('slides'));
    assert.ok(demo.includes('worksheet'));
    assert.ok(demo.includes('notes'));
    assert.ok(demo.includes('exitTicket'));
    assert.ok(demo.includes('script'));
  });

  test('page renders via the shipped player, presenter and printable surfaces', () => {
    assert.ok(demo.includes('AnimathPlayer.mount'));
    assert.ok(demo.includes('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(demo.includes('AnimathPrintable.renderWorksheet'));
    assert.ok(demo.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(demo.includes('AnimathPrintable.renderExitTicket'));
    assert.ok(demo.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes('AnimathPrintable.renderNotes'));
    assert.ok(demo.includes('AnimathPrintable.renderScript'));
    assert.ok(demo.includes('#toggle-teacher'));
    assert.ok(demo.includes('id="toggle-teacher"'));
    assert.ok(demo.includes('.pr-teacher'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
    assert.ok(demo.includes("document.querySelector('#complex-print .pr-stage') || document.querySelector('#complex-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage]'));
  });

  test('complex manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="complex-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="complex-manifest"'));
    assert.ok(manifest.includes('<code>h2-complex-jc-math</code>'));
    assert.ok(manifest.includes('level jc'));
    assert.ok(manifest.includes('subject math'));
    assert.ok(manifest.includes('<code>animation</code>'));
    assert.ok(manifest.includes('<code>slides</code>'));
    assert.ok(manifest.includes('<code>worksheet</code>'));
    assert.ok(manifest.includes('<code>exitTicket</code>'));
    assert.ok(manifest.includes('exit ticket'));
    assert.ok(manifest.includes('<code>notes</code>'));
    assert.ok(manifest.includes('student notes'));
    assert.ok(manifest.includes('<code>script</code>'));
    assert.ok(manifest.includes('teacher script'));
  });

  test('complex pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="complex-player"'));
    assert.ok(demo.includes('id="complex-presenter"'));
    assert.ok(demo.includes('id="complex-print"'));
    assert.ok(demo.includes('../samples/jc-h2-complex.json'));
    assert.ok(demo.includes('../samples/decks/jc-h2-complex.json'));
    assert.ok(demo.includes('../samples/worksheets/jc-h2-complex.json'));
    assert.ok(demo.includes('../samples/tickets/jc-h2-complex.json'));
    assert.ok(demo.includes('../samples/notes/jc-h2-complex.json'));
    assert.ok(demo.includes('../samples/scripts/jc-h2-complex.json'));
  });

  test('trigonometry manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="trig-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="trig-manifest"'));
    assert.ok(manifest.includes('<code>e-trigonometry-secondary-math</code>'));
    assert.ok(manifest.includes('level secondary'));
    assert.ok(manifest.includes('subject math'));
    assert.ok(manifest.includes('<code>animation</code>'));
    assert.ok(manifest.includes('<code>slides</code>'));
    assert.ok(manifest.includes('<code>worksheet</code>'));
    assert.ok(manifest.includes('<code>exitTicket</code>'));
    assert.ok(manifest.includes('exit ticket'));
    assert.ok(manifest.includes('<code>notes</code>'));
    assert.ok(manifest.includes('student notes'));
    assert.ok(manifest.includes('<code>script</code>'));
    assert.ok(manifest.includes('teacher script'));
  });

  test('trigonometry pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="trig-player"'));
    assert.ok(demo.includes('id="trig-presenter"'));
    assert.ok(demo.includes('id="trig-print"'));
    assert.ok(demo.includes('../samples/secondary-e-trigonometry.json'));
    assert.ok(demo.includes('../samples/decks/secondary-e-trigonometry.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-e-trigonometry.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-e-trigonometry.json'));
    assert.ok(demo.includes('../samples/notes/secondary-e-trigonometry.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-e-trigonometry.json'));
  });

  test('trigonometry block validates all six materials before rendering and renders both answer keys', () => {
    const trigStart = demo.indexOf('trigAnimUrl');
    assert.ok(trigStart > -1);
    const trigBlock = demo.slice(trigStart);
    assert.ok(trigBlock.indexOf('AnimathValidate.validateSpec') < trigBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(trigBlock.indexOf('AnimathValidate.validateSlides') < trigBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(trigBlock.indexOf('AnimathValidate.validateWorksheet') < trigBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(trigBlock.indexOf('AnimathValidate.validateExitTicket') < trigBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(trigBlock.indexOf('AnimathValidate.validateNotes') < trigBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(trigBlock.indexOf('AnimathValidate.validateScript') < trigBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(trigBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(trigBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#trig-print .pr-stage') || document.querySelector('#trig-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });


  test('thermal manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="thermal-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="thermal-manifest"'));
    assert.ok(manifest.includes('<code>h2-thermal-jc-science</code>'));
    assert.ok(manifest.includes('level jc'));
    assert.ok(manifest.includes('subject science'));
    assert.ok(manifest.includes('<code>animation</code>'));
    assert.ok(manifest.includes('<code>slides</code>'));
    assert.ok(manifest.includes('<code>worksheet</code>'));
    assert.ok(manifest.includes('<code>exitTicket</code>'));
    assert.ok(manifest.includes('exit ticket'));
    assert.ok(manifest.includes('<code>notes</code>'));
    assert.ok(manifest.includes('student notes'));
    assert.ok(manifest.includes('<code>script</code>'));
    assert.ok(manifest.includes('teacher script'));
  });

  test('thermal pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="thermal-player"'));
    assert.ok(demo.includes('id="thermal-presenter"'));
    assert.ok(demo.includes('id="thermal-print"'));
    assert.ok(demo.includes('../samples/jc-h2-thermal.json'));
    assert.ok(demo.includes('../samples/decks/jc-h2-thermal.json'));
    assert.ok(demo.includes('../samples/worksheets/jc-h2-thermal.json'));
    assert.ok(demo.includes('../samples/tickets/jc-h2-thermal.json'));
    assert.ok(demo.includes('../samples/notes/jc-h2-thermal.json'));
    assert.ok(demo.includes('../samples/scripts/jc-h2-thermal.json'));
  });

  test('thermal block validates all six materials before rendering and renders both answer keys', () => {
    const thermalStart = demo.indexOf('thermalAnimUrl');
    assert.ok(thermalStart > -1);
    const thermalBlock = demo.slice(thermalStart);
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateSpec') < thermalBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateSlides') < thermalBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateWorksheet') < thermalBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateExitTicket') < thermalBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateNotes') < thermalBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(thermalBlock.indexOf('AnimathValidate.validateScript') < thermalBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(thermalBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(thermalBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#thermal-print .pr-stage') || document.querySelector('#thermal-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('every local script src referenced exists on disk under player/', () => {
    const srcs = [];
    const re = /<script src="([^"]+)"/g;
    let m;
    while ((m = re.exec(demo)) !== null) srcs.push(m[1]);
    assert.ok(srcs.length > 0);
    for (const src of srcs) {
      if (src.startsWith('http://') || src.startsWith('https://')) continue;
      assert.ok(fs.existsSync(path.join(ROOT, 'player', src)), 'script exists: ' + src);
    }
    assert.ok(srcs.includes('validate.js'));
    assert.ok(srcs.includes('player.js'));
    assert.ok(srcs.includes('presenter.js'));
    assert.ok(srcs.includes('printable.js'));
  });
});
