// TypeScript definitions for player/export-record.js — browser recording harness that turns export frames into a WebM blob.
export interface ExportFrameRef {
  scene: number;
  frame: number;
  atMs: number;
}
export interface FramePlan {
  frames: ExportFrameRef[];
  fps: number;
  totalFrames: number;
  totalMs: number;
}
export interface ExportRecordOptions {
  fps?: number;
  mimeType?: string;
  videoBitsPerSecond?: number;
  onProgress?: unknown;
  [key: string]: unknown;
}
export interface ExportRecordEnv {
  document?: unknown;
  Image?: unknown;
  MediaRecorder?: unknown;
  Blob?: unknown;
  [key: string]: unknown;
}
export interface RecordResult {
  blob: unknown;
  mimeType: string;
  frameCount: number;
  totalMs: number;
}
export function buildFramePlan(spec: Record<string, unknown>, opts?: ExportRecordOptions): FramePlan;
export function defaultExportName(slug: string, when?: Date): string;
export function preferredMimeTypes(): string[];
export function pickMimeType(mrLike: unknown): string;
export function supportCheck(env: unknown): string | null;
export function recordSpec(spec: Record<string, unknown>, opts: ExportRecordOptions, env: unknown): Promise<RecordResult>;
