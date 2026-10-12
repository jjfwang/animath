// TypeScript definitions for generator/audit.js — the programmatic geometry
// audit runner (Node only; the CLI entry lives at
// generator/tooling/audit-cli.js). Exported functions stay importable for
// tests and the loop.
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
