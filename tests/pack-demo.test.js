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
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
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
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
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
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('photosynthesis manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="photosynthesis-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="photosynthesis-manifest"'));
    assert.ok(manifest.includes('<code>bio-nutrition-secondary-science</code>'));
    assert.ok(manifest.includes('level secondary'));
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

  test('photosynthesis pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="photosynthesis-player"'));
    assert.ok(demo.includes('id="photosynthesis-presenter"'));
    assert.ok(demo.includes('id="photosynthesis-print"'));
    assert.ok(demo.includes('../samples/secondary-science-photosynthesis.json'));
    assert.ok(demo.includes('../samples/decks/secondary-science-photosynthesis.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-science-photosynthesis.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-science-photosynthesis.json'));
    assert.ok(demo.includes('../samples/notes/secondary-science-photosynthesis.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-science-photosynthesis.json'));
  });

  test('photosynthesis block validates all six materials before rendering and renders both answer keys', () => {
    const photosynthesisStart = demo.indexOf('photosynthesisAnimUrl');
    assert.ok(photosynthesisStart > -1);
    const photosynthesisBlock = demo.slice(photosynthesisStart);
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateSpec') < photosynthesisBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateSlides') < photosynthesisBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateWorksheet') < photosynthesisBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateExitTicket') < photosynthesisBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateNotes') < photosynthesisBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(photosynthesisBlock.indexOf('AnimathValidate.validateScript') < photosynthesisBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(photosynthesisBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(photosynthesisBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#photosynthesis-print .pr-stage') || document.querySelector('#photosynthesis-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('erosion manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="erosion-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="erosion-manifest"'));
    assert.ok(manifest.includes('<code>erosion-primary-geography</code>'));
    assert.ok(manifest.includes('level primary'));
    assert.ok(manifest.includes('subject geography'));
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

  test('erosion pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="erosion-player"'));
    assert.ok(demo.includes('id="erosion-presenter"'));
    assert.ok(demo.includes('id="erosion-print"'));
    assert.ok(demo.includes('../samples/primary-geog-erosion.json'));
    assert.ok(demo.includes('../samples/decks/primary-geog-erosion.json'));
    assert.ok(demo.includes('../samples/worksheets/primary-geog-erosion.json'));
    assert.ok(demo.includes('../samples/tickets/primary-geog-erosion.json'));
    assert.ok(demo.includes('../samples/notes/primary-geog-erosion.json'));
    assert.ok(demo.includes('../samples/scripts/primary-geog-erosion.json'));
  });

  test('erosion block validates all six materials before rendering and renders both answer keys', () => {
    const erosionStart = demo.indexOf('erosionAnimUrl');
    assert.ok(erosionStart > -1);
    const erosionBlock = demo.slice(erosionStart);
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateSpec') < erosionBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateSlides') < erosionBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateWorksheet') < erosionBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateExitTicket') < erosionBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateNotes') < erosionBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(erosionBlock.indexOf('AnimathValidate.validateScript') < erosionBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(erosionBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(erosionBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#erosion-print .pr-stage') || document.querySelector('#erosion-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('chem-mole manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="chem-mole-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="chem-mole-manifest"'));
    assert.ok(manifest.includes('<code>chem-mole-secondary-science</code>'));
    assert.ok(manifest.includes('level secondary'));
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

  test('chem-mole pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="chem-mole-player"'));
    assert.ok(demo.includes('id="chem-mole-presenter"'));
    assert.ok(demo.includes('id="chem-mole-print"'));
    assert.ok(demo.includes('../samples/secondary-science-chem-mole.json'));
    assert.ok(demo.includes('../samples/decks/secondary-science-chem-mole.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-science-chem-mole.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-science-chem-mole.json'));
    assert.ok(demo.includes('../samples/notes/secondary-science-chem-mole.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-science-chem-mole.json'));
  });

  test('chem-mole block validates all six materials before rendering and renders both answer keys', () => {
    const chemMoleStart = demo.indexOf('chemMoleAnimUrl');
    assert.ok(chemMoleStart > -1);
    const chemMoleBlock = demo.slice(chemMoleStart);
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateSpec') < chemMoleBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateSlides') < chemMoleBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateWorksheet') < chemMoleBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateExitTicket') < chemMoleBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateNotes') < chemMoleBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(chemMoleBlock.indexOf('AnimathValidate.validateScript') < chemMoleBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(chemMoleBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(chemMoleBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#chem-mole-print .pr-stage') || document.querySelector('#chem-mole-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });


  test('differentiation manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="differentiation-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="differentiation-manifest"'));
    assert.ok(manifest.includes('<code>a-differentiation-secondary-math</code>'));
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

  test('differentiation pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="differentiation-player"'));
    assert.ok(demo.includes('id="differentiation-presenter"'));
    assert.ok(demo.includes('id="differentiation-print"'));
    assert.ok(demo.includes('../samples/secondary-a-differentiation.json'));
    assert.ok(demo.includes('../samples/decks/secondary-a-differentiation.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-a-differentiation.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-a-differentiation.json'));
    assert.ok(demo.includes('../samples/notes/secondary-a-differentiation.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-a-differentiation.json'));
  });

  test('differentiation block validates all six materials before rendering and renders both answer keys', () => {
    const differentiationStart = demo.indexOf('differentiationAnimUrl');
    assert.ok(differentiationStart > -1);
    const differentiationBlock = demo.slice(differentiationStart);
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateSpec') < differentiationBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateSlides') < differentiationBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateWorksheet') < differentiationBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateExitTicket') < differentiationBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateNotes') < differentiationBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(differentiationBlock.indexOf('AnimathValidate.validateScript') < differentiationBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(differentiationBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(differentiationBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#differentiation-print .pr-stage') || document.querySelector('#differentiation-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('integration manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="integration-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="integration-manifest"'));
    assert.ok(manifest.includes('<code>a-integration-secondary-math</code>'));
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

  test('integration pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="integration-player"'));
    assert.ok(demo.includes('id="integration-presenter"'));
    assert.ok(demo.includes('id="integration-print"'));
    assert.ok(demo.includes('../samples/secondary-a-integration.json'));
    assert.ok(demo.includes('../samples/decks/secondary-a-integration.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-a-integration.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-a-integration.json'));
    assert.ok(demo.includes('../samples/notes/secondary-a-integration.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-a-integration.json'));
  });

  test('integration block validates all six materials before rendering and renders both answer keys', () => {
    const integrationStart = demo.indexOf('integrationAnimUrl');
    assert.ok(integrationStart > -1);
    const integrationBlock = demo.slice(integrationStart);
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateSpec') < integrationBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateSlides') < integrationBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateWorksheet') < integrationBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateExitTicket') < integrationBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateNotes') < integrationBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(integrationBlock.indexOf('AnimathValidate.validateScript') < integrationBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(integrationBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(integrationBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.ok(demo.includes("document.querySelector('#integration-print .pr-stage') || document.querySelector('#integration-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('binomial manifest header names the slug, level, subject and six material keys', () => {
    const start = demo.indexOf('id="binomial-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="binomial-manifest"'));
    assert.ok(manifest.includes('<code>a-binomial-secondary-math</code>'));
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

  test('binomial pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="binomial-player"'));
    assert.ok(demo.includes('id="binomial-presenter"'));
    assert.ok(demo.includes('id="binomial-print"'));
    assert.ok(demo.includes('../samples/secondary-a-binomial.json'));
    assert.ok(demo.includes('../samples/decks/secondary-a-binomial.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-a-binomial.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-a-binomial.json'));
    assert.ok(demo.includes('../samples/notes/secondary-a-binomial.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-a-binomial.json'));
  });

  test('binomial block validates all six materials before rendering and renders both answer keys', () => {
    const binomialStart = demo.indexOf('binomialAnimUrl');
    assert.ok(binomialStart > -1);
    const binomialBlock = demo.slice(binomialStart, demo.indexOf('kinematicsAnimUrl'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateSpec') < binomialBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateSlides') < binomialBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateWorksheet') < binomialBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateExitTicket') < binomialBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateNotes') < binomialBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(binomialBlock.indexOf('AnimathValidate.validateScript') < binomialBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(binomialBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(binomialBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(binomialBlock.split('../samples/').length - 1, 6);
    assert.ok(binomialBlock.includes('showError'));
    assert.ok(demo.includes("document.querySelector('#binomial-print .pr-stage') || document.querySelector('#binomial-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('kinematics manifest header names the slug, level, subject, topic and six material keys', () => {
    const start = demo.indexOf('id="kinematics-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="kinematics-manifest"'));
    assert.ok(manifest.includes('<code>a-kinematics-secondary-math</code>'));
    assert.ok(manifest.includes('level secondary'));
    assert.ok(manifest.includes('subject math'));
    assert.ok(manifest.includes('<code>a-kinematics</code>'));
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

  test('kinematics pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="kinematics-player"'));
    assert.ok(demo.includes('id="kinematics-presenter"'));
    assert.ok(demo.includes('id="kinematics-print"'));
    assert.ok(demo.includes('../samples/secondary-a-kinematics.json'));
    assert.ok(demo.includes('../samples/decks/secondary-a-kinematics.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-a-kinematics.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-a-kinematics.json'));
    assert.ok(demo.includes('../samples/notes/secondary-a-kinematics.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-a-kinematics.json'));
  });

  test('kinematics block validates all six materials before rendering and renders both answer keys', () => {
    const kinematicsStart = demo.indexOf('kinematicsAnimUrl');
    assert.ok(kinematicsStart > -1);
    const kinematicsBlock = demo.slice(kinematicsStart, demo.indexOf('quadraticAnimUrl'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateSpec') < kinematicsBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateSlides') < kinematicsBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateWorksheet') < kinematicsBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateExitTicket') < kinematicsBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateNotes') < kinematicsBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(kinematicsBlock.indexOf('AnimathValidate.validateScript') < kinematicsBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(kinematicsBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(kinematicsBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(kinematicsBlock.split('../samples/').length - 1, 6);
    assert.ok(kinematicsBlock.includes('showError'));
    assert.ok(demo.includes("document.querySelector('#kinematics-print .pr-stage') || document.querySelector('#kinematics-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('quadratic manifest header names the slug, level, subject, topic and six material keys', () => {
    const start = demo.indexOf('id="quadratic-manifest"');
    assert.ok(start > -1);
    const manifest = demo.slice(start, demo.indexOf('</header>', start));
    assert.ok(manifest.includes('id="quadratic-manifest"'));
    assert.ok(manifest.includes('<code>a-quadratic-functions-secondary-math</code>'));
    assert.ok(manifest.includes('level secondary'));
    assert.ok(manifest.includes('subject math'));
    assert.ok(manifest.includes('<code>a-quadratic-functions</code>'));
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

  test('quadratic pack sections and all six sample paths are present', () => {
    assert.ok(demo.includes('id="quadratic-player"'));
    assert.ok(demo.includes('id="quadratic-presenter"'));
    assert.ok(demo.includes('id="quadratic-print"'));
    assert.ok(demo.includes('../samples/secondary-a-quadratic-functions.json'));
    assert.ok(demo.includes('../samples/decks/secondary-a-quadratic-functions.json'));
    assert.ok(demo.includes('../samples/worksheets/secondary-a-quadratic-functions.json'));
    assert.ok(demo.includes('../samples/tickets/secondary-a-quadratic-functions.json'));
    assert.ok(demo.includes('../samples/notes/secondary-a-quadratic-functions.json'));
    assert.ok(demo.includes('../samples/scripts/secondary-a-quadratic-functions.json'));
  });

  test('quadratic block validates all six materials before rendering and renders both answer keys', () => {
    const quadraticStart = demo.indexOf('quadraticAnimUrl');
    assert.ok(quadraticStart > -1);
    const quadraticBlock = demo.slice(quadraticStart, demo.indexOf('trigonometryAAnimUrl'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateSpec') < quadraticBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateSlides') < quadraticBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateWorksheet') < quadraticBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateExitTicket') < quadraticBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateNotes') < quadraticBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(quadraticBlock.indexOf('AnimathValidate.validateScript') < quadraticBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(quadraticBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(quadraticBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(quadraticBlock.split('../samples/').length - 1, 6);
    assert.ok(quadraticBlock.includes('showError'));
    assert.ok(demo.includes("document.querySelector('#quadratic-print .pr-stage') || document.querySelector('#quadratic-print')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
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

  test('A-Math trigonometry pack is stacked fifteenth with manifest, sections, six paths and validate-before-render', () => {
    const trigAHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const trigAStart = trigAHtml.indexOf('id="trigonometry-a-manifest"');
    assert.ok(trigAStart >= 0);
    const trigAPack = trigAHtml.slice(trigAStart);
    assert.ok(trigAPack.includes('id="trigonometry-a-manifest"'));
    assert.ok(trigAPack.includes('a-trigonometry-secondary-math'));
    assert.ok(trigAPack.includes('topic a-trigonometry · level secondary · subject math ·'));
    assert.ok(trigAPack.includes('id="trigonometry-a-animation"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-stage"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-captions"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-slides"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-slides-stage"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-printables"'));
    assert.ok(trigAPack.includes('id="trigonometry-a-printables-stage"'));
    assert.ok(trigAPack.includes('secondary-a-trigonometry.json'));
    assert.ok(trigAPack.includes('decks/secondary-a-trigonometry.json'));
    assert.ok(trigAPack.includes('worksheets/secondary-a-trigonometry.json'));
    assert.ok(trigAPack.includes('tickets/secondary-a-trigonometry.json'));
    assert.ok(trigAPack.includes('notes/secondary-a-trigonometry.json'));
    assert.ok(trigAPack.includes('scripts/secondary-a-trigonometry.json'));
    const trigABlockStart = trigAPack.indexOf('trigonometryAAnimUrl');
    assert.ok(trigABlockStart > -1);
    const trigABlock = trigAPack.slice(trigABlockStart, trigAPack.indexOf('vectorsAnimUrl'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateSpec') < trigABlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateSlides') < trigABlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateWorksheet') < trigABlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateExitTicket') < trigABlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateNotes') < trigABlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(trigABlock.indexOf('AnimathValidate.validateScript') < trigABlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(trigABlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(trigABlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(trigABlock.split('../samples/').length - 1, 6);
    assert.ok(trigABlock.includes('showError'));
    assert.ok(trigAHtml.includes("document.querySelector('#trigonometry-a-printables-stage .pr-stage') || document.querySelector('#trigonometry-a-printables-stage')"));
    assert.ok(trigAHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((trigAHtml.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('vectors pack is stacked sixteenth with manifest, sections, six paths and validate-before-render', () => {
    const vectorsHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const vectorsStart = vectorsHtml.indexOf('id="vectors-manifest"');
    assert.ok(vectorsStart >= 0);
    const vectorsPack = vectorsHtml.slice(vectorsStart, vectorsHtml.indexOf('functionsGraphsAnimUrl'));
    assert.ok(vectorsPack.includes('id="vectors-manifest"'));
    assert.ok(vectorsPack.includes('h2-vectors-jc-math'));
    assert.ok(vectorsPack.includes('topic h2-vectors · level jc · subject math ·'));
    assert.ok(vectorsPack.includes('id="vectors-animation"'));
    assert.ok(vectorsPack.includes('id="vectors-stage"'));
    assert.ok(vectorsPack.includes('id="vectors-captions"'));
    assert.ok(vectorsPack.includes('id="vectors-slides"'));
    assert.ok(vectorsPack.includes('id="vectors-slides-stage"'));
    assert.ok(vectorsPack.includes('id="vectors-printables"'));
    assert.ok(vectorsPack.includes('id="vectors-printables-stage"'));
    assert.ok(vectorsPack.includes('jc-h2-vectors.json'));
    assert.ok(vectorsPack.includes('decks/jc-h2-vectors.json'));
    assert.ok(vectorsPack.includes('worksheets/jc-h2-vectors.json'));
    assert.ok(vectorsPack.includes('tickets/jc-h2-vectors.json'));
    assert.ok(vectorsPack.includes('notes/jc-h2-vectors.json'));
    assert.ok(vectorsPack.includes('scripts/jc-h2-vectors.json'));
    const vectorsBlockStart = vectorsPack.indexOf('vectorsAnimUrl');
    assert.ok(vectorsBlockStart > -1);
    const vectorsBlock = vectorsPack.slice(vectorsBlockStart);
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateSpec') < vectorsBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateSlides') < vectorsBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateWorksheet') < vectorsBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateExitTicket') < vectorsBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateNotes') < vectorsBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(vectorsBlock.indexOf('AnimathValidate.validateScript') < vectorsBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(vectorsBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(vectorsBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(vectorsBlock.split('../samples/').length - 1, 6);
    assert.ok(vectorsBlock.includes('showError'));
    assert.ok(vectorsHtml.includes("document.querySelector('#vectors-printables-stage .pr-stage') || document.querySelector('#vectors-printables-stage')"));
    assert.ok(vectorsHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((vectorsHtml.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('functions and graphs pack is stacked seventeenth with manifest, sections, six paths and validate-before-render', () => {
    const functionsGraphsHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const functionsGraphsStart = functionsGraphsHtml.indexOf('id="functions-graphs-manifest"');
    assert.ok(functionsGraphsStart >= 0);
    const functionsGraphsPack = functionsGraphsHtml.slice(functionsGraphsStart, functionsGraphsHtml.indexOf('sequencesAnimUrl'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-manifest"'));
    assert.ok(functionsGraphsPack.includes('h2-functions-graphs-jc-math'));
    assert.ok(functionsGraphsPack.includes('topic h2-functions-graphs · level jc · subject math · deck jc-h2-functions-graphs'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-animation"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-stage"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-captions"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-slides"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-slides-stage"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-printables"'));
    assert.ok(functionsGraphsPack.includes('id="functions-graphs-printables-stage"'));
    assert.ok(functionsGraphsPack.includes('jc-h2-functions-graphs.json'));
    assert.ok(functionsGraphsPack.includes('decks/jc-h2-functions-graphs.json'));
    assert.ok(functionsGraphsPack.includes('worksheets/jc-h2-functions-graphs.json'));
    assert.ok(functionsGraphsPack.includes('tickets/jc-h2-functions-graphs.json'));
    assert.ok(functionsGraphsPack.includes('notes/jc-h2-functions-graphs.json'));
    assert.ok(functionsGraphsPack.includes('scripts/jc-h2-functions-graphs.json'));
    const functionsGraphsBlockStart = functionsGraphsPack.indexOf('functionsGraphsAnimUrl');
    assert.ok(functionsGraphsBlockStart > -1);
    const functionsGraphsBlock = functionsGraphsPack.slice(functionsGraphsBlockStart);
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateSpec') < functionsGraphsBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateSlides') < functionsGraphsBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateWorksheet') < functionsGraphsBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateExitTicket') < functionsGraphsBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateNotes') < functionsGraphsBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(functionsGraphsBlock.indexOf('AnimathValidate.validateScript') < functionsGraphsBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(functionsGraphsBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(functionsGraphsBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(functionsGraphsBlock.split('../samples/').length - 1, 6);
    assert.ok(functionsGraphsBlock.includes('showError'));
    assert.ok(functionsGraphsHtml.includes("document.querySelector('#functions-graphs-printables-stage .pr-stage') || document.querySelector('#functions-graphs-printables-stage')"));
    assert.ok(functionsGraphsHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((functionsGraphsHtml.match(/#toggle-teacher/g) || []).length, 1);
  });
  test('sequences pack is stacked eighteenth with manifest, sections, six paths and validate-before-render', () => {
    const sequencesHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const sequencesStart = sequencesHtml.indexOf('id="sequences-manifest"');
    assert.ok(sequencesStart >= 0);
    const sequencesPack = sequencesHtml.slice(sequencesStart, sequencesHtml.indexOf('differentiationJcAnimUrl'));
    assert.ok(sequencesPack.includes('id="sequences-manifest"'));
    assert.ok(sequencesPack.includes('h2-sequences-jc-math'));
    assert.ok(sequencesPack.includes('topic h2-sequences · level jc · subject math · deck jc-h2-sequences'));
    assert.ok(sequencesPack.includes('id="sequences-animation"'));
    assert.ok(sequencesPack.includes('id="sequences-stage"'));
    assert.ok(sequencesPack.includes('id="sequences-captions"'));
    assert.ok(sequencesPack.includes('id="sequences-slides"'));
    assert.ok(sequencesPack.includes('id="sequences-slides-stage"'));
    assert.ok(sequencesPack.includes('id="sequences-printables"'));
    assert.ok(sequencesPack.includes('id="sequences-printables-stage"'));
    assert.ok(sequencesPack.includes('jc-h2-sequences.json'));
    assert.ok(sequencesPack.includes('decks/jc-h2-sequences.json'));
    assert.ok(sequencesPack.includes('worksheets/jc-h2-sequences.json'));
    assert.ok(sequencesPack.includes('tickets/jc-h2-sequences.json'));
    assert.ok(sequencesPack.includes('notes/jc-h2-sequences.json'));
    assert.ok(sequencesPack.includes('scripts/jc-h2-sequences.json'));
    const sequencesBlockStart = sequencesPack.indexOf('sequencesAnimUrl');
    assert.ok(sequencesBlockStart > -1);
    const sequencesBlock = sequencesPack.slice(sequencesBlockStart);
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateSpec') < sequencesBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateSlides') < sequencesBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateWorksheet') < sequencesBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateExitTicket') < sequencesBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateNotes') < sequencesBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(sequencesBlock.indexOf('AnimathValidate.validateScript') < sequencesBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(sequencesBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(sequencesBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(sequencesBlock.split('../samples/').length - 1, 6);
    assert.ok(sequencesBlock.includes('showError'));
    assert.ok(sequencesHtml.includes("document.querySelector('#sequences-printables-stage .pr-stage') || document.querySelector('#sequences-printables-stage')"));
    assert.ok(sequencesHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((sequencesHtml.match(/#toggle-teacher/g) || []).length, 1);
  });

  test('JC differentiation pack is stacked nineteenth with manifest, sections, six paths and validate-before-render', () => {
    const differentiationJcHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const differentiationJcStart = differentiationJcHtml.indexOf('id="differentiation-jc-manifest"');
    assert.ok(differentiationJcStart >= 0);
    const differentiationJcPack = differentiationJcHtml.slice(differentiationJcStart, differentiationJcHtml.indexOf('integrationJcAnimUrl'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-manifest"'));
    assert.ok(differentiationJcPack.includes('h2-differentiation-jc-math'));
    assert.ok(differentiationJcPack.includes('topic h2-differentiation · level jc · subject math · deck jc-h2-differentiation'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-animation"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-stage"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-captions"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-slides"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-slides-stage"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-printables"'));
    assert.ok(differentiationJcPack.includes('id="differentiation-jc-printables-stage"'));
    assert.ok(differentiationJcPack.includes('jc-h2-differentiation.json'));
    assert.ok(differentiationJcPack.includes('decks/jc-h2-differentiation.json'));
    assert.ok(differentiationJcPack.includes('worksheets/jc-h2-differentiation.json'));
    assert.ok(differentiationJcPack.includes('tickets/jc-h2-differentiation.json'));
    assert.ok(differentiationJcPack.includes('notes/jc-h2-differentiation.json'));
    assert.ok(differentiationJcPack.includes('scripts/jc-h2-differentiation.json'));
    const differentiationJcBlock = differentiationJcPack.slice(differentiationJcPack.indexOf('differentiationJcAnimUrl'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateSpec') < differentiationJcBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateSlides') < differentiationJcBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateWorksheet') < differentiationJcBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateExitTicket') < differentiationJcBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateNotes') < differentiationJcBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(differentiationJcBlock.indexOf('AnimathValidate.validateScript') < differentiationJcBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(differentiationJcBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(differentiationJcBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(differentiationJcBlock.split('../samples/').length - 1, 6);
    assert.ok(differentiationJcBlock.includes('showError'));
    assert.ok(differentiationJcHtml.includes("document.querySelector('#differentiation-jc-printables-stage .pr-stage') || document.querySelector('#differentiation-jc-printables-stage')"));
    assert.ok(differentiationJcHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((differentiationJcHtml.match(/#toggle-teacher/g) || []).length, 1);
  });
test('JC integration pack is stacked twentieth with manifest, sections, six paths and validate-before-render', () => {
    const integrationJcHtml = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const integrationJcStart = integrationJcHtml.indexOf('id="integration-jc-manifest"');
    assert.ok(integrationJcStart >= 0);
    const integrationJcPack = integrationJcHtml.slice(integrationJcStart, integrationJcHtml.indexOf('probabilityJcAnimUrl'));
    assert.ok(integrationJcPack.includes('id="integration-jc-manifest"'));
    assert.ok(integrationJcPack.includes('h2-integration-jc-math'));
    assert.ok(integrationJcPack.includes('topic h2-integration · level jc · subject math · deck jc-h2-integration'));
    assert.ok(integrationJcPack.includes('id="integration-jc-animation"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-stage"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-captions"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-slides"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-slides-stage"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-printables"'));
    assert.ok(integrationJcPack.includes('id="integration-jc-printables-stage"'));
    assert.ok(integrationJcPack.includes('jc-h2-integration.json'));
    assert.ok(integrationJcPack.includes('decks/jc-h2-integration.json'));
    assert.ok(integrationJcPack.includes('worksheets/jc-h2-integration.json'));
    assert.ok(integrationJcPack.includes('tickets/jc-h2-integration.json'));
    assert.ok(integrationJcPack.includes('notes/jc-h2-integration.json'));
    assert.ok(integrationJcPack.includes('scripts/jc-h2-integration.json'));
    const integrationJcBlock = integrationJcPack.slice(integrationJcPack.indexOf('integrationJcAnimUrl'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateSpec') < integrationJcBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateSlides') < integrationJcBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateWorksheet') < integrationJcBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateExitTicket') < integrationJcBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateNotes') < integrationJcBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(integrationJcBlock.indexOf('AnimathValidate.validateScript') < integrationJcBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(integrationJcBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(integrationJcBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(integrationJcBlock.split('../samples/').length - 1, 6);
    assert.ok(integrationJcBlock.includes('showError'));
    assert.ok(integrationJcHtml.includes("document.querySelector('#integration-jc-printables-stage .pr-stage') || document.querySelector('#integration-jc-printables-stage')"));
    assert.ok(integrationJcHtml.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((integrationJcHtml.match(/#toggle-teacher/g) || []).length, 1);
  });
  test('JC probability pack is stacked twenty-first with manifest, sections, six paths and validate-before-render', () => {
    const demo = fs.readFileSync(path.join(ROOT, 'player', 'pack-demo.html'), 'utf8');
    const probabilityJcStart = demo.indexOf('id="probability-jc-manifest"');
    assert.ok(probabilityJcStart >= 0);
    const probabilityJcPack = demo.slice(probabilityJcStart);
    assert.ok(probabilityJcPack.includes('id="probability-jc-manifest"'));
    assert.ok(probabilityJcPack.includes('h2-probability-jc-math'));
    assert.ok(probabilityJcPack.includes('topic h2-probability \u00b7 level jc \u00b7 subject math \u00b7 deck jc-h2-probability'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-animation"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-stage"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-captions"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-slides"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-slides-stage"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-printables"'));
    assert.ok(probabilityJcPack.includes('id="probability-jc-printables-stage"'));
    assert.ok(probabilityJcPack.includes('jc-h2-probability.json'));
    assert.ok(probabilityJcPack.includes('decks/jc-h2-probability.json'));
    assert.ok(probabilityJcPack.includes('worksheets/jc-h2-probability.json'));
    assert.ok(probabilityJcPack.includes('tickets/jc-h2-probability.json'));
    assert.ok(probabilityJcPack.includes('notes/jc-h2-probability.json'));
    assert.ok(probabilityJcPack.includes('scripts/jc-h2-probability.json'));
    const probabilityJcBlock = probabilityJcPack.slice(probabilityJcPack.indexOf('probabilityJcAnimUrl'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateSpec') < probabilityJcBlock.lastIndexOf('AnimathPlayer.mount'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateSlides') < probabilityJcBlock.lastIndexOf('AnimathSlidesPresenter.attachPresenter'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateWorksheet') < probabilityJcBlock.lastIndexOf('AnimathPrintable.renderWorksheet'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateExitTicket') < probabilityJcBlock.lastIndexOf('AnimathPrintable.renderExitTicket'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateNotes') < probabilityJcBlock.lastIndexOf('AnimathPrintable.renderNotes'));
    assert.ok(probabilityJcBlock.indexOf('AnimathValidate.validateScript') < probabilityJcBlock.lastIndexOf('AnimathPrintable.renderScript'));
    assert.ok(probabilityJcBlock.includes('AnimathPrintable.renderWorksheetAnswerKey'));
    assert.ok(probabilityJcBlock.includes('AnimathPrintable.renderExitTicketAnswerKey'));
    assert.equal(probabilityJcBlock.split('../samples/').length - 1, 6);
    assert.ok(probabilityJcBlock.includes('showError'));
    assert.ok(demo.includes("document.querySelector('#probability-jc-printables-stage .pr-stage') || document.querySelector('#probability-jc-printables-stage')"));
    assert.ok(demo.includes('[printStage, fractionsPrintStage, wavesPrintStage, complexPrintStage, trigPrintStage, thermalPrintStage, photosynthesisPrintStage, erosionPrintStage, chemMolePrintStage, differentiationPrintStage, integrationPrintStage, binomialPrintStage, kinematicsPrintStage, quadraticPrintStage, trigonometryAPrintStage, vectorsPrintStage, functionsGraphsPrintStage, sequencesPrintStage, differentiationJcPrintStage, integrationJcPrintStage, probabilityJcPrintStage]'));
    assert.equal((demo.match(/#toggle-teacher/g) || []).length, 1);
  });
});
