// TypeScript definitions for generator/charts.js — animath zero-dep chart toolkit.
// Sector/rect/line/text descriptors drop straight into spec `show` steps and
// are accepted unchanged by player/validate.js.
export interface SectorDescriptor {
  kind: 'sector';
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  fill?: string;
}
export interface PieSectorsOptions {
  startAngle?: number;
  fills?: string[];
}
export function pieSectors(
  cx: number, cy: number, r: number,
  values: unknown[], opts?: PieSectorsOptions
): SectorDescriptor[];

export interface RectDescriptor {
  kind: 'rect';
  x: number; y: number; w: number; h: number;
  fill?: string;
}
export interface BarLayoutOptions {
  orientation?: 'v' | 'h';
  gap?: number;
  fills?: string[];
  min?: number;
  max?: number;
}
export function barLayout(
  x: number, y: number, w: number, h: number,
  values: unknown[], opts?: BarLayoutOptions
): RectDescriptor[];

export function axisTicks(min: number, max: number, count?: number): number[];

export interface LineDescriptor {
  kind: 'line';
  x1: number; y1: number; x2: number; y2: number;
}
export interface TextDescriptor {
  kind: 'text';
  x: number; y: number;
  text: string;
  align?: string;
  size?: number;
}
export interface NumberLineResult {
  baseline: LineDescriptor;
  ticks: LineDescriptor[];
  labels: TextDescriptor[];
}
export interface NumberLineOptions {
  tickLen?: number;
  labelOffset?: number;
  size?: number;
}
export function numberLine(
  x1: number, x2: number, y: number,
  min: number, max: number,
  ticks: unknown[] | number,
  opts?: NumberLineOptions
): NumberLineResult;

export type CurvePoint = [number, number] | { x: number; y: number };
export interface AreaUnderCurveOptions {
  baseY?: number;
}
export function areaUnderCurve(
  points: unknown[], opts?: AreaUnderCurveOptions
): Array<[number, number]>;

export function gridLines(
  x: number, y: number, w: number, h: number,
  xTicks: unknown[], yTicks: unknown[]
): LineDescriptor[];
