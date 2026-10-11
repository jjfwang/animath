// ESM consumption fixture for issue #637 — the README-documented pattern.
// The package is CJS+UMD, so ESM consumers import the default export and
// destructure. Named imports are NOT supported: the UMD factory-return shape
// is opaque to Node's named-export detection (import { pieSectors } throws).
import charts from '@jjfwang/animath/charts';

const { pieSectors } = charts;
const sectors = pieSectors(480, 320, 200, [30, 50, 20]);

process.stdout.write(
  JSON.stringify({
    api:
      typeof charts === 'object' &&
      charts !== null &&
      typeof pieSectors === 'function'
        ? 'ok'
        : 'bad',
    sectorCount: sectors.length,
    allSectorKind: sectors.every((s) => s.kind === 'sector'),
  }) + '\n',
);
