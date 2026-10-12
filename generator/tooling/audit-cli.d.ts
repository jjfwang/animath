// TypeScript definitions for generator/tooling/audit-cli.js — the CLI entry
// point over the programmatic runner in generator/audit.js (Node only).
// Argument parsing, usage text, and the require.main guard; importing the
// module has no side effects.
import type { AuditRunResult } from '../audit';
export interface AuditCliArgs {
  files: string[];
  all: boolean;
  dir: string;
  error: string | null;
}
export function usage(): string;
export function parseArgs(argv: string[]): AuditCliArgs;
export function main(argv: string[]): AuditRunResult;
