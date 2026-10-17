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
