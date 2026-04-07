import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { AGENT_OUTPUT_SCHEMA } from "./agents/types.js";
import { findLegacyRunBaseCommit, getHeadCommit } from "./git.js";

export interface RunInfo {
  runId: string;
  runDir: string;
  promptPath: string;
  notesPath: string;
  schemaPath: string;
  logPath: string;
  baseCommit: string;
  baseCommitPath: string;
}

function writeSchemaFile(schemaPath: string): void {
  writeFileSync(
    schemaPath,
    JSON.stringify(AGENT_OUTPUT_SCHEMA, null, 2),
    "utf-8",
  );
}

function ensureRunMetadataIgnored(cwd: string): void {
  const excludePath = join(cwd, ".git", "info", "exclude");
  if (existsSync(excludePath)) return;
  const gitInfoDir = join(cwd, ".git", "info");
  mkdirSync(gitInfoDir, { recursive: true });
  writeFileSync(excludePath, ".fttm/runs/\n", "utf-8");
}

export function setupRun(
  runId: string,
  prompt: string,
  baseCommit: string,
  cwd: string,
): RunInfo {
  ensureRunMetadataIgnored(cwd);

  const runDir = join(cwd, ".fttm", "runs", runId);
  mkdirSync(runDir, { recursive: true });

  const promptPath = join(runDir, "prompt.md");
  writeFileSync(promptPath, prompt, "utf-8");

  const notesPath = join(runDir, "notes.md");
  writeFileSync(
    notesPath,
    `# fttm run: ${runId}\n\nObjective: ${prompt}\n\n## Iteration Log\n`,
    "utf-8",
  );

  const schemaPath = join(runDir, "output-schema.json");
  writeSchemaFile(schemaPath);
  const logPath = join(runDir, "debug.jsonl");

  const baseCommitPath = join(runDir, "base-commit");
  const hasStoredBaseCommit = existsSync(baseCommitPath);
  const resolvedBaseCommit = hasStoredBaseCommit
    ? readFileSync(baseCommitPath, "utf-8").trim()
    : baseCommit;
  if (!hasStoredBaseCommit) {
    writeFileSync(baseCommitPath, `${baseCommit}\n`, "utf-8");
  }

  return {
    runId,
    runDir,
    promptPath,
    notesPath,
    schemaPath,
    logPath,
    baseCommit: resolvedBaseCommit,
    baseCommitPath,
  };
}

export function resumeRun(runId: string, cwd: string): RunInfo {
  const runDir = join(cwd, ".fttm", "runs", runId);
  if (!existsSync(runDir)) {
    throw new Error(`Run directory not found: ${runDir}`);
  }

  const promptPath = join(runDir, "prompt.md");
  const notesPath = join(runDir, "notes.md");
  const schemaPath = join(runDir, "output-schema.json");
  const logPath = join(runDir, "debug.jsonl");
  writeSchemaFile(schemaPath);
  const baseCommitPath = join(runDir, "base-commit");
  const baseCommit = existsSync(baseCommitPath)
    ? readFileSync(baseCommitPath, "utf-8").trim()
    : backfillLegacyBaseCommit(runId, baseCommitPath, cwd);

  return {
    runId,
    runDir,
    promptPath,
    notesPath,
    schemaPath,
    logPath,
    baseCommit,
    baseCommitPath,
  };
}

function backfillLegacyBaseCommit(
  runId: string,
  baseCommitPath: string,
  cwd: string,
): string {
  const baseCommit = findLegacyRunBaseCommit(runId, cwd) ?? getHeadCommit(cwd);
  writeFileSync(baseCommitPath, `${baseCommit}\n`, "utf-8");
  return baseCommit;
}

export function getLastIterationNumber(runInfo: RunInfo): number {
  const files = readdirSync(runInfo.runDir);
  let max = 0;
  for (const f of files) {
    const m = f.match(/^iteration-(\d+)\.jsonl$/);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function formatListSection(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `**${title}:**\n${items.map((item) => `- ${item}`).join("\n")}\n`;
}

export function appendNotes(
  notesPath: string,
  iteration: number,
  summary: string,
  changes: string[],
  learnings: string[],
): void {
  const entry = [
    `\n### Iteration ${iteration}\n`,
    `**Summary:** ${summary}\n`,
    formatListSection("Changes", changes),
    formatListSection("Learnings", learnings),
  ].join("\n");

  appendFileSync(notesPath, entry, "utf-8");
}
