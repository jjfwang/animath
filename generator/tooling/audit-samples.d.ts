// TypeScript definitions for generator/tooling/audit-samples.js —
// Node-only file-walking geometry audits over samples/index.json (they
// require('fs')). Finding records come from generator/geometry.js.
import type { GeometryFinding } from '../geometry';
export function auditSampleFile(path: string): GeometryFinding[];
export function auditAllSamples(dir?: string): GeometryFinding[];
