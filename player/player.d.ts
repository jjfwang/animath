// TypeScript definitions for player/player.js — animath browser player.
// DOM-free: the container is a minimal structural interface, so these types
// compile with --lib es2020 only (no DOM lib reference needed).
export interface PlayerContainer {
  innerHTML: string;
  className: string;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (...args: unknown[]) => void): void;
  appendChild(child: unknown): unknown;
}
// The animation spec document (see SPEC.md v0.1; player/validate.js is the
// authoritative runtime checker). Index signature keeps the type honest
// about author-added fields on shape/step records.
export interface AnimathSpec {
  animath: '0.1';
  title: string;
  level: string;
  subject: string;
  topic: string;
  kind: string;
  canvas: { width: number; height: number };
  scenes: unknown[];
  [key: string]: unknown;
}
export interface PlayerController {
  spec: AnimathSpec;
  play(): void;
  pause(): void;
  restart(): void;
  nextScene(): void;
  prevScene(): void;
  seekScene(index: number, ms?: number): void;
  setSpeed(x: number): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  destroy(): void;
}
export function mount(container: PlayerContainer, spec: AnimathSpec): PlayerController;
export const version: string;
export function katexAvailable(katex: unknown): boolean;
export function latexFallbackText(tex: string): string;
export interface LatexFit {
  width: number;
  height: number;
  scale: number;
}
export function latexFit(contentW: number, contentH: number, availW: number): LatexFit;
export function fitLatex(node: unknown, availW: number): unknown;
export function stripLabels(scenes: unknown): unknown;
export function stripAria(index: number, scene: unknown): unknown;
export function fullCaption(scene: unknown): string;
export function keyAction(eventLike: unknown): string | null;
export function controlButtons(): unknown[];
export function shortcutHint(): string;
export function prefersReducedMotion(matcher: unknown): boolean;
export function interpFields(from: unknown, to: unknown, p: number): unknown;
export function applyPos(node: unknown, shape: unknown, pos: unknown): void;
export function sectorPath(shape: unknown): string;
export function dashAttr(shape: unknown): unknown;
export function taperShaft(shape: unknown, wt: number, wh: number, headSize: number): unknown;
export function isWidths(x: unknown): boolean;
export function explainText(shape: unknown): string;
export interface TipPoint {
  x: number;
  y: number;
}
export function tipPoint(px: number, py: number, stageW: number, stageH: number): TipPoint;
