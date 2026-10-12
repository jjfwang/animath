// TypeScript definitions for generator/llm_client.js — OpenAI-compatible
// chat completions. Works in browser and Node 18+. The API key is supplied
// by the caller (browser localStorage in web/) and is sent only to the
// configured baseUrl.
export interface GenerateSpecOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** Number of repair turns after the first attempt. Default 3; 0 means no repairs. */
  maxRepairs?: number;
}
// The parsed animath animation spec the model returned.
export type AnimathSpecDocument = Record<string, unknown>;
export function generateSpec(
  opts: GenerateSpecOptions
): Promise<AnimathSpecDocument>;
export type SpecValidator = (
  spec: AnimathSpecDocument
) => string[] | Promise<string[]>;
export type RepairProgress = (attemptNumber: number, maxRepairs: number) => void;
export function generateSpecWithRepair(
  opts: GenerateSpecOptions,
  validate: SpecValidator,
  onProgress?: RepairProgress
): Promise<AnimathSpecDocument>;
export function extractJson(text: string): unknown;
export interface LlmPreset {
  label: string;
  baseUrl: string;
  model: string;
  keyHint: string;
}
export const PRESETS: { [preset: string]: LlmPreset };
export const DEFAULT_PRESET: string;
