/** Experimental zero-dependency registered simulation engine (version 0.2). */
export type SimulationModel = 'water-cycle' | 'fraction-bars' | 'uniform-motion' | 'ohms-law' | 'ideal-gas' | 'quadratic-curve' | 'transpiration' | 'erosion';
export type SimulationActor = 'student' | 'tutor';
export interface SimulationParameter {
  id: string; label: string; min: number; max: number; step: number; default: number;
}
export interface SimulationBeat { id: string; label: string; narration: string; }
export interface SimulationCheck {
  question: string; options: string[]; correctIndex: number; explanation: string;
}
export interface SimulationSpec {
  simulation: '0.2'; model: SimulationModel; title: string; level: string; subject: string;
  topic: string; disclaimer: string; parameters: SimulationParameter[];
  beats: SimulationBeat[]; check: SimulationCheck;
}
export interface SimulationState {
  model: SimulationModel; beat: string; parameters: Record<string, number>;
  output: Record<string, number>; answer: null | { index: number; correct: boolean };
}
export interface SimulationEvent {
  sequence: number; type: 'parameter'|'beat'|'checkpoint'|'reset'; source: SimulationActor;
  detail: Record<string, unknown>; state: SimulationState;
}
export interface SimulationController {
  spec: SimulationSpec;
  getState(): SimulationState; getHistory(): SimulationEvent[];
  setParameter(id: string, value: number, source?: SimulationActor): SimulationEvent;
  playBeat(id: string, source?: SimulationActor): SimulationEvent;
  answer(index: number, source?: SimulationActor): SimulationEvent;
  reset(source?: SimulationActor): SimulationEvent;
  on(handler: (event: SimulationEvent) => void): () => void;
  destroy(): void;
}
export const version: string;
export const models: SimulationModel[];
export function validate(spec: unknown): string[];
export function calculate(model: SimulationModel, params: Record<string, number>): Record<string, number>;
export function createSession(spec: SimulationSpec): SimulationController;
export function svgFor(spec: SimulationSpec, state: SimulationState): string;
export function mount(container: HTMLElement, spec: SimulationSpec): SimulationController;
export function escapeText(text: unknown): string;
