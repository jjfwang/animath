/* Tests for generator/audit.js — geometry audit CLI (issue #365).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const child = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = require('../generator/audit.js');

const repoRoot = path.join(__dirname, '..');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'animath-audit-'));
}
// run-274 falling-shape spec: static audit clean, sampled finds [400-500ms]
function fallingSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'lbl', kind: 'text', x: 100, y: 300, text: 'hello', size: 24 } },
        { at_ms: 0, do: 'show', shape: { id: 'ball', kind: 'circle', cx: 160, cy: 100, r: 20 } },
        { at_ms: 0, do: 'move', target: 'ball', to: { cy: 500 }, dur_ms: 1000 }
      ]
    }]
  };
}
function cleanSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 't', kind: 'text', x: 100, y: 100, text: 'hi', size: 24 } },
        { at_ms: 0, do: 'show', shape: { id: 'c', kind: 'circle', cx: 700, cy: 400, r: 30 } }
      ]
    }]
  };
}
function writeSpec(dir, name, spec) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(spec));
  return p;
}

test('parseArgs: files, --all, --dir, and usage errors', () => {
  const a = cli.parseArgs(['a.json', 'b.json']);
  assert.deepEqual(a.files, ['a.json', 'b.json']);
  assert.equal(a.all, false);
  assert.equal(a.error, null);
  const b = cli.parseArgs(['--all', '--dir', 'samples']);
  assert.equal(b.all, true);
  assert.equal(b.dir, 'samples');
  assert.equal(b.error, null);
  assert.ok(cli.parseArgs([]).error);
  assert.ok(cli.parseArgs(['--bogus']).error);
  assert.ok(cli.parseArgs(['--dir']).error);
  assert.ok(cli.parseArgs(['--dir', '--all']).error);
  assert.equal(cli.parseArgs(['--help']).error, 'help');
  assert.equal(cli.parseArgs(['-h']).error, 'help');
});

test('usage: documents commands and exit codes', () => {
  assert.match(cli.usage(), /--all/);
  assert.match(cli.usage(), /0 clean/);
});

test('main: clean file exits 0', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'clean.json', cleanSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 0);
  assert.equal(r.findingCount, 0);
  assert.match(r.output, /clean/);
});

test('main: falling-shape file exits 0 — the crossing is intentional-motion', () => {
  // issue #382: the exit-1 contract applies to genuine findings only
  const dir = tmpDir();
  const f = writeSpec(dir, 'fall.json', fallingSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 0);
  assert.equal(r.findingCount, 1);
  assert.match(r.output, /intentional-motion findings:/);
  assert.match(r.output, /lbl collides with ball \[400-500ms\]  flight ball \[0-1000ms\]/);
  assert.match(r.output, /1 finding\(s\): 1 intentional-motion, 0 intentional-staging, 0 genuine/);
  assert.doesNotMatch(r.output, /genuine findings:/);
});

function restSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'lbl', kind: 'text', x: 100, y: 300, text: 'hello', size: 24 } },
        { at_ms: 0, do: 'show', shape: { id: 'ball', kind: 'circle', cx: 160, cy: 290, r: 20 } }
      ]
    }]
  };
}

test('main: rest overlap stays genuine and exits 1', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'rest.json', restSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 1);
  assert.equal(r.findingCount, 2); // static + sampled, both genuine
  assert.match(r.output, /genuine findings:/);
  assert.match(r.output, /2 finding\(s\): 0 intentional-motion, 0 intentional-staging, 2 genuine/);
  assert.doesNotMatch(r.output, /intentional-motion findings:/);
});

test('main: unreadable and invalid files exit 2', () => {
  const dir = tmpDir();
  const missing = cli.main([path.join(dir, 'nope.json')]);
  assert.equal(missing.code, 2);
  assert.match(missing.output, /cannot read/);
  const badPath = path.join(dir, 'bad.json');
  fs.writeFileSync(badPath, '{not json');
  const bad = cli.main([badPath]);
  assert.equal(bad.code, 2);
});

test('main: no args and bad flags exit 2, --help exits 0', () => {
  assert.equal(cli.main([]).code, 2);
  assert.equal(cli.main(['--bogus']).code, 2);
  const help = cli.main(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.output, /Usage/);
});

test('main: --all audits the manifest without throwing', () => {
  const r = cli.main(['--all', '--dir', path.join(repoRoot, 'samples')]);
  // shipped samples have known mid-flight crossings; the contract is the
  // exit code follows the findings, and the run completes
  assert.ok(r.code === 0 || r.code === 1);
  assert.equal(typeof r.findingCount, 'number');
});

test('main: --all with a bad dir exits 2', () => {
  const r = cli.main(['--all', '--dir', path.join(repoRoot, 'no-such-dir')]);
  assert.equal(r.code, 2);
});

test('main: --all with a non-array manifest exits 2', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'index.json'), '{"a":1}');
  const r = cli.main(['--all', '--dir', dir]);
  assert.equal(r.code, 2);
  assert.match(r.output, /bad manifest/);
});

test('main: explicit files resolve against --dir', () => {
  const dir = tmpDir();
  writeSpec(dir, 'clean.json', cleanSpec());
  const r = cli.main(['clean.json', '--dir', dir]);
  assert.equal(r.code, 0);
});

test('require.main guard: real CLI invocation exits and prints', () => {
  const out = child.spawnSync(process.execPath, [path.join(repoRoot, 'generator', 'audit.js'), '--help'], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /Usage/);
});

test('auditFile: record shape and formatFinding', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'fall.json', fallingSpec());
  const r = cli.auditFile(f);
  assert.equal(r.error, null);
  assert.equal(r.findings.length, 1);
  const line = cli.formatFinding(r.findings[0]);
  assert.match(line, /^fall\.json s1 text-shape-overlap /);
  const missing = cli.auditFile(path.join(dir, 'nope.json'));
  assert.ok(missing.error);
  assert.deepEqual(missing.findings, []);
});

function stagingSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'read1', kind: 'text', x: 100, y: 300, text: 'first', size: 24 } },
        { at_ms: 500, do: 'hide', target: 'read1' },
        { at_ms: 500, do: 'show', shape: { id: 'read2', kind: 'text', x: 100, y: 300, text: 'second', size: 24 } }
      ]
    }]
  };
}

test('main: never-co-visible sequential labels are intentional-staging and exit 0', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'stage.json', stagingSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 0);
  assert.equal(r.findingCount, 1);
  assert.match(r.output, /intentional-staging findings:/);
  assert.match(r.output, /staging read1 \[0-400ms\] vs read2 \[500-1000ms\]/);
  assert.match(r.output, /1 finding\(s\): 0 intentional-motion, 1 intentional-staging, 0 genuine/);
  assert.doesNotMatch(r.output, /genuine findings:/);
  assert.doesNotMatch(r.output, /intentional-motion findings:/);
});

test('main: mixed file reports all three classes and exits 1 on the genuine', () => {
  const dir = tmpDir();
  const spec = {
    canvas: { width: 960, height: 540 },
    scenes: [
      {
        id: 's1', duration_ms: 1000, steps: [
          { at_ms: 0, do: 'show', shape: { id: 'read1', kind: 'text', x: 100, y: 300, text: 'first', size: 24 } },
          { at_ms: 500, do: 'hide', target: 'read1' },
          { at_ms: 500, do: 'show', shape: { id: 'read2', kind: 'text', x: 100, y: 300, text: 'second', size: 24 } }
        ]
      },
      {
        id: 's2', duration_ms: 1000, steps: [
          { at_ms: 0, do: 'show', shape: { id: 'lbl', kind: 'text', x: 100, y: 300, text: 'hello', size: 24 } },
          { at_ms: 0, do: 'show', shape: { id: 'ball', kind: 'circle', cx: 160, cy: 290, r: 20 } }
        ]
      }
    ]
  };
  const f = writeSpec(dir, 'mixed.json', spec);
  const r = cli.main([f]);
  assert.equal(r.code, 1);
  assert.equal(r.findingCount, 3); // 1 staging + 2 genuine (static + sampled rest overlap)
  assert.match(r.output, /genuine findings:/);
  assert.match(r.output, /intentional-staging findings:/);
  assert.doesNotMatch(r.output, /intentional-motion findings:/);
  assert.match(r.output, /3 finding\(s\): 0 intentional-motion, 1 intentional-staging, 2 genuine/);
});

/* Triage-verdict records (issue #495). */

function overlapSpec() {
  // static + sampled audits both flag this rest overlap as genuine
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'cap', kind: 'text', x: 100, y: 300, text: 'cap', size: 24 } },
        // rect offset so the label grazes its left edge (not centered-on it)
        { at_ms: 0, do: 'show', shape: { id: 'box', kind: 'rect', x: 130, y: 280, w: 60, h: 30 } }
      ]
    }]
  };
}

function verdictRecord(over) {
  return Object.assign({
    file: 'overlap.json', scene: 's1', label: 'cap', shape: 'box',
    verdict: 'deliberate-placement',
    evidence: 'test fixture evidence', date: '2026-10-09'
  }, over || {});
}

function writeVerdicts(dir, records) {
  const p = path.join(dir, 'verdicts.json');
  fs.writeFileSync(p, JSON.stringify(records));
  return p;
}

test('loadTriageVerdicts: valid file loads records', () => {
  const dir = tmpDir();
  const p = writeVerdicts(dir, [verdictRecord()]);
  const r = cli.loadTriageVerdicts(p);
  assert.equal(r.error, null);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].verdict, 'deliberate-placement');
});

test('loadTriageVerdicts: fail-closed on unreadable, unparsable, non-array', () => {
  const missing = cli.loadTriageVerdicts(path.join(tmpDir(), 'nope.json'));
  assert.match(missing.error, /cannot read triage verdicts/);
  assert.deepEqual(missing.records, []);
  const dir = tmpDir();
  const bad = path.join(dir, 'verdicts.json');
  fs.writeFileSync(bad, '{not json');
  assert.match(cli.loadTriageVerdicts(bad).error, /cannot parse triage verdicts/);
  const arr = path.join(dir, 'verdicts2.json');
  fs.writeFileSync(arr, '{"a":1}');
  assert.match(cli.loadTriageVerdicts(arr).error, /must be an array/);
});

test('loadTriageVerdicts: fail-closed on malformed records and unknown verdicts', () => {
  const dir = tmpDir();
  const missingLabel = verdictRecord();
  delete missingLabel.label;
  const cases = [
    [['nope'], /not an object/], // non-object record
    [[missingLabel], /missing\/invalid field "label"/],
    [[verdictRecord({ date: 2026 })], /missing\/invalid field "date"/],
    [[verdictRecord({ verdict: 'fine-by-me' })], /unknown verdict "fine-by-me"/]
  ];
  cases.forEach(([records, re]) => {
    const p = writeVerdicts(dir, records);
    assert.match(cli.loadTriageVerdicts(p).error, re);
  });
});

test('parseCollideIds: parses collides-with and overlaps ids, rejects other phrasing', () => {
  assert.deepEqual(cli.parseCollideIds('cap collides with box (100px^2 intersection)'),
    { label: 'cap', shape: 'box' });
  assert.deepEqual(cli.parseCollideIds('cap collides with box [600-9000ms]'),
    { label: 'cap', shape: 'box' });
  // issue #529: text-vs-text / shape-vs-shape "overlaps" phrasing triages too
  assert.deepEqual(cli.parseCollideIds('eq overlaps letter (100px^2 intersection)'),
    { label: 'eq', shape: 'letter' });
  assert.deepEqual(cli.parseCollideIds('eq overlaps letter [600-9000ms]'),
    { label: 'eq', shape: 'letter' });
  assert.equal(cli.parseCollideIds('overflow wrongL: text box extends outside'), null);
  // issue #545: overflow findings triage-match with the canvas as the shape
  assert.deepEqual(cli.parseCollideIds('wrongL: text box extends outside the 960x540 canvas'),
    { label: 'wrongL', shape: 'canvas' });
  assert.equal(cli.parseCollideIds('eq: latex anchor outside the 960x540 canvas'), null);
});

test('run: recorded genuine pair moves off genuine into triage-verified', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'overlap.json', overlapSpec());
  const v = writeVerdicts(dir, [verdictRecord()]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 0); // no genuine left
  assert.equal(r.findingCount, 2); // static + sampled, both triaged
  assert.match(r.output, /triage-verified findings:/);
  assert.match(r.output, /cap collides with box \(/);
  assert.match(r.output, /triage: deliberate-placement \(test fixture evidence\)/);
  assert.doesNotMatch(r.output, /genuine findings:/);
  assert.match(r.output, /2 finding\(s\): 0 intentional-motion, 0 intentional-staging, 0 genuine, 2 triage-verified/);
});

function textOverlapSpec() {
  // issue #529: two text shapes whose boxes overlap at rest -> kind 'overlap'
  // ("eq overlaps letter") phrasing, static + sampled both flag it
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'eq', kind: 'text', x: 100, y: 300, text: 'aaa', size: 48 } },
        { at_ms: 0, do: 'show', shape: { id: 'letter', kind: 'text', x: 130, y: 300, text: 'b', size: 48 } }
      ]
    }]
  };
}

test('run: overlaps-phrased pair triages via record (issue #529)', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'textoverlap.json', textOverlapSpec());
  const v = writeVerdicts(dir, [Object.assign(verdictRecord(), {
    file: 'textoverlap.json', label: 'eq', shape: 'letter'
  })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 0); // no genuine left
  assert.equal(r.findingCount, 2); // static + sampled, both triaged
  assert.match(r.output, /triage-verified findings:/);
  assert.match(r.output, /eq overlaps letter/);
  assert.match(r.output, /triage: deliberate-placement \(test fixture evidence\)/);
  assert.doesNotMatch(r.output, /genuine findings:/);
  assert.match(r.output, /2 finding\(s\): 0 intentional-motion, 0 intentional-staging, 0 genuine, 2 triage-verified/);
});

test('run: unrecorded overlaps-phrased pair stays genuine', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'textoverlap.json', textOverlapSpec());
  const v = writeVerdicts(dir, [verdictRecord({ label: 'other', shape: 'letter', file: 'textoverlap.json' })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 1);
  assert.match(r.output, /genuine findings:/);
  assert.match(r.output, /eq overlaps letter/);
  assert.doesNotMatch(r.output, /triage-verified findings:/);
});

function overflowSpec() {
  // in-bounds at show time (static audit clean), parked out-of-bounds by a
  // flight — the sampled audit flags the post-flight band, like wrongL
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'far', kind: 'text', x: 100, y: 300, text: 'wide label here', size: 40 } },
        { at_ms: 400, do: 'move', target: 'far', to: { x: 920, y: 300 }, dur_ms: 200 }
      ]
    }]
  };
}

test('run: overflow finding triages via record with canvas shape (issue #545)', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'overflow.json', overflowSpec());
  const v = writeVerdicts(dir, [Object.assign(verdictRecord(), {
    file: 'overflow.json', scene: 's1', label: 'far', shape: 'canvas',
    verdict: 'box-model-artifact'
  })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 0); // no genuine left
  assert.equal(r.findingCount, 1); // single overflow note, triaged
  assert.match(r.output, /triage-verified findings:/);
  assert.match(r.output, /far: text box extends outside/);
  assert.match(r.output, /triage: box-model-artifact \(test fixture evidence\)/);
  assert.doesNotMatch(r.output, /genuine findings:/);
  assert.match(r.output, /1 finding\(s\): 0 intentional-motion, 0 intentional-staging, 0 genuine, 1 triage-verified/);
});

test('run: unrecorded overflow stays genuine', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'overflow.json', overflowSpec());
  const v = writeVerdicts(dir, [verdictRecord({ label: 'other', shape: 'canvas', file: 'overflow.json' })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 1);
  assert.match(r.output, /genuine findings:/);
  assert.match(r.output, /far: text box extends outside/);
  assert.doesNotMatch(r.output, /triage-verified findings:/);
});

function latexAnchorSpec() {
  // latex anchor outside the canvas: the "latex anchor outside" phrasing
  // must never triage-match (parseCollideIds rejects it by design)
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'lx', kind: 'latex', x: 1000, y: 100, tex: 'x', size: 24 } }
      ]
    }]
  };
}

test('run: latex-anchor overflow never triage-matches (issue #545)', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'lxoverflow.json', latexAnchorSpec());
  const v = writeVerdicts(dir, [Object.assign(verdictRecord(), {
    file: 'lxoverflow.json', scene: 's1', label: 'lx', shape: 'canvas',
    verdict: 'box-model-artifact'
  })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 1); // stays genuine: the phrasing is not triage-matchable
  assert.match(r.output, /lx: latex anchor outside the 960x540 canvas/);
  assert.doesNotMatch(r.output, /triage-verified findings:/);
});

test('run: unrecorded genuine stays genuine', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'overlap.json', overlapSpec());
  const v = writeVerdicts(dir, [verdictRecord({ label: 'other' })]);
  const r = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v });
  assert.equal(r.code, 1);
  assert.match(r.output, /genuine findings:/);
  assert.doesNotMatch(r.output, /triage-verified findings:/);
});

test('run: malformed verdicts file and unknown verdict exit 2', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'overlap.json', overlapSpec());
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  const r1 = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: bad });
  assert.equal(r1.code, 2);
  assert.match(r1.output, /cannot parse triage verdicts/);
  const v2 = writeVerdicts(dir, [verdictRecord({ verdict: 'bogus' })]);
  const r2 = cli.run({ files: [f], all: false, dir: 'samples', verdictsFile: v2 });
  assert.equal(r2.code, 2);
  assert.match(r2.output, /unknown verdict "bogus"/);
});

test('run: default verdicts path is the shipped audit-verdicts.json', () => {
  // every shipped record still matches a current genuine finding
  const r = cli.run({ files: [], all: true, dir: path.join(repoRoot, 'samples') });
  const records = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'generator', 'audit-verdicts.json'), 'utf8'));
  assert.ok(records.length > 0);
  const triage = r.output.split('triage-verified findings:\n')[1]
    .split('intentional-motion findings:')[0];
  records.forEach(rec => {
    // issue #545: overflow findings triage-match with the canvas as the shape
    const frag = rec.shape === 'canvas'
      ? rec.label + ': text box extends outside'
      : rec.label + ' (collides with|overlaps) ' + rec.shape;
    const re = new RegExp(rec.file.replace(/\./g, '\\.') + ' ' + rec.scene +
      ' .*' + frag);
    assert.match(triage, re);
  });
  // genuine count drops by exactly the number of triaged lines
  const r2 = cli.run({ files: [], all: true, dir: path.join(repoRoot, 'samples'),
    verdictsFile: writeVerdicts(tmpDir(), []) });
  const genuineCount = out => {
    const m = /(\d+) genuine, (\d+) triage-verified/.exec(out);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const [g1, t1] = genuineCount(r.output);
  const [g2] = genuineCount(r2.output);
  assert.equal(t1, g2 - g1); // every triaged line came off genuine, nothing else moved
});
