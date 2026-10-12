// TypeScript definitions for player/export-ui.js — export button UI wiring for the WebM export modules.
export const EXPORT_FPS: number;
export interface ExportRunResult {
  name: string;
  frameCount: number;
  totalMs: number;
}
export interface ExportController {
  supportReason(): string | null;
  fileName(when?: Date): string;
  run(ui?: unknown): Promise<ExportRunResult>;
}
export interface AttachExportResult {
  refresh(): void;
}
export interface ExportUIFns {
  getSpec: () => unknown;
  getSlug: () => string;
}
export function createExportController(cfg: Record<string, unknown>): ExportController;
export function attachExportUI(doc: unknown, win: unknown, record: unknown, fns: ExportUIFns): AttachExportResult;
