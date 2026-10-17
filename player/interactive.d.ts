/** Experimental interactive pilot. Distinct from the stable animath v0.1 SVG player. */
export type ParameterId = 'solar' | 'cooling' | 'growth';
export type BeatId = 'overview' | 'evaporation' | 'condensation' | 'precipitation' | 'collection';
export type Source = 'student' | 'tutor';
export interface Parameter {
  id: ParameterId;
  label: string;
  min: 0;
  max: 100;
  step: 10;
  default: number;
}
export interface Beat { id: BeatId; label: string; narration: string; }
export interface UnderstandingCheck {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
export interface InteractiveSpec {
  interactive: '0.1';
  model: 'water-cycle';
  title: string;
  level: 'secondary';
  subject: 'science';
  topic: 'water-cycle';
  disclaimer: string;
  parameters: Parameter[];
  beats: Beat[];
  check: UnderstandingCheck;
}
export interface Activity {
  evaporation: number;
  condensation: number;
  precipitation: number;
  collection: number;
}
export interface State {
  parameters: Record<ParameterId, number>;
  activity: Activity;
  beat: BeatId;
  answer: null | { index: number; correct: boolean };
}
export interface SessionEvent {
  seq: number;
  type: 'parameter' | 'beat' | 'answer' | 'reset';
  source: Source;
  detail: Record<string, string | number | boolean>;
  state: State;
}
export interface InteractiveController {
  getState(): State;
  getHistory(): SessionEvent[];
  setParameter(id: ParameterId, value: number, source?: Source): SessionEvent;
  playBeat(id: BeatId, source?: Source): SessionEvent;
  answer(index: number, source?: Source): SessionEvent;
  reset(source?: Source): SessionEvent;
  on(handler: (event: SessionEvent) => void): () => void;
  destroy(): void;
}
export const version: string;
export function validate(spec: unknown): string[];
export function evaluate(values: Record<ParameterId, number>): Activity;
export function createSession(spec: InteractiveSpec): InteractiveController;
export function svgFor(state: State): string;
export function mount(container: HTMLElement, spec: InteractiveSpec): InteractiveController;
export const parameterIds: ParameterId[];
export const beatIds: BeatId[];
export const parameterLabels: Record<ParameterId, string>;
export const beatLabels: Record<BeatId, string>;
