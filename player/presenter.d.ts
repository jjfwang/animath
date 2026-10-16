// TypeScript definitions for player/presenter.js - slide presenter:
// zero-dependency deck renderer with print stylesheet (issue #746).
export type SlideVisual = string | { sceneId?: string; kind?: string };
export interface Slide {
  kind: string;
  heading?: string;
  bullets?: string[];
  notes?: string;
  visual?: SlideVisual;
  [key: string]: unknown;
}
export interface SlideDeck {
  title: string;
  level: string;
  subject: string;
  topic: string;
  slides: Slide[];
  [key: string]: unknown;
}
export interface ResolvedVisual {
  type: string;
  sceneId?: string;
  kind?: string;
}
export interface PresenterView {
  index: number;
  count: number;
  counter: string;
  kind: string;
  heading: string;
  bullets: string[];
  notes: string | null;
  visual: ResolvedVisual | null;
}
export interface PresenterEventLike {
  key?: string;
  target?: { tagName?: string } | null;
}
export interface PresenterController {
  count(): number;
  index(): number;
  current(): Slide;
  counter(): string;
  next(): number;
  prev(): number;
  goTo(i: number): number;
  toggleNotes(): boolean;
  setNotes(v: boolean): boolean;
  notesVisible(): boolean;
  view(): PresenterView;
  keyAction(eventLike: PresenterEventLike): string | null;
  handleKey(eventLike: PresenterEventLike): string | null;
  printViews(): PresenterView[];
}
export interface AttachPresenterOptions {
  mountPlayer?: unknown;
  animSpec?: unknown;
}
export interface AttachPresenterResult {
  controller: PresenterController;
  render(): void;
}
export function createPresenter(deck: SlideDeck): PresenterController;
export function resolveVisual(visual: unknown): ResolvedVisual | null;
export function printViews(deck: SlideDeck): PresenterView[];
export function keyAction(eventLike: PresenterEventLike): string | null;
export function attachPresenter(doc: unknown, container: unknown, deck: SlideDeck, opts?: AttachPresenterOptions): AttachPresenterResult;
