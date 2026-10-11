// TypeScript definitions for generator/geometry.js — static geometry audit.
// Core (auditGeometry) works in browser and Node; auditSampleFile /
// auditAllSamples are Node-only (they require('fs') over samples/index.json).
export interface GeometryFinding {
  file: string;
  scene: string;
  kind: 'overflow' | 'overlap' | 'text-shape-overlap';
  detail: string;
}
// Bounding box for a label or shape. Latex anchor-in-canvas checks and
// degenerate inputs may produce boxes with null edges.
export interface TextBox {
  id: string;
  left: number | null;
  top: number | null;
  right: number | null;
  bottom: number | null;
}
export function auditGeometry(
  spec: Record<string, unknown> | null, fileName?: string
): GeometryFinding[];
export function estimateTextWidth(text: string, size: number): number;
export function textBox(shape: Record<string, unknown>): TextBox;
export function auditGeometrySampled(
  spec: Record<string, unknown> | null, fileName?: string
): GeometryFinding[];
export interface ClassifiedFinding {
  finding: GeometryFinding;
  verdict: unknown;
  flight: unknown;
  staging: unknown;
}
export function classifyFindings(
  spec: Record<string, unknown>,
  findings: GeometryFinding[]
): ClassifiedFinding[];
export function auditSampleFile(path: string): GeometryFinding[];
export function auditAllSamples(dir?: string): GeometryFinding[];
