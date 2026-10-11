// TypeScript definitions for generator/audit.js — headless sample-audit CLI
// (Node only). Exported functions stay importable for tests and the loop.
export interface AuditCliArgs {
  files: string[];
  all: boolean;
  dir: string;
  error: string | null;
}
export function usage(): string;
export function parseArgs(argv: string[]): AuditCliArgs;
export interface AuditFileResult {
  file: string;
  spec: Record<string, unknown> | null;
  findings: unknown[];
  error: string | null;
}
export function auditFile(file: string): AuditFileResult;
export function formatFinding(f: { file: string; scene: string; kind: string; detail: string }): string;
export function loadTriageVerdicts(
  file?: string
): { records: unknown[]; error: string | null };
export function parseCollideIds(
  detail: string
): { label: string; shape: string } | null;
export function triageMatch(
  records: unknown[], finding: { file: string; scene: string; detail: string }
): unknown;
export interface AuditRunOptions {
  files: string[];
  all: boolean;
  dir: string;
  verdictsFile?: string;
}
export interface AuditRunResult {
  output: string;
  code: number;
  findingCount: number;
}
export function run(opts: AuditRunOptions): AuditRunResult;
export function main(argv: string[]): AuditRunResult;
