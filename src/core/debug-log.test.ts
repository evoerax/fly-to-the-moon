import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendDebugLog,
  initDebugLog,
  resetDebugLogForTests,
  serializeError,
} from "./debug-log.js";

describe("appendDebugLog", () => {
  const originalLogPath = process.env.GNHF_DEBUG_LOG_PATH;

  afterEach(() => {
    resetDebugLogForTests();
    if (originalLogPath === undefined) {
      delete process.env.GNHF_DEBUG_LOG_PATH;
    } else {
      process.env.GNHF_DEBUG_LOG_PATH = originalLogPath;
    }
  });

  it("writes JSON lines when GNHF_DEBUG_LOG_PATH is set", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fttm-debug-log-test-"));
    const logPath = join(tempDir, "debug.jsonl");
    process.env.GNHF_DEBUG_LOG_PATH = logPath;

    appendDebugLog("run:start", { prompt: "ship it" });

    const [line] = readFileSync(logPath, "utf-8").trim().split("\n");
    expect(JSON.parse(line!)).toMatchObject({
      event: "run:start",
      prompt: "ship it",
      pid: process.pid,
    });

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does nothing when the env var is unset", () => {
    delete process.env.GNHF_DEBUG_LOG_PATH;

    expect(() =>
      appendDebugLog("run:start", { prompt: "ship it" }),
    ).not.toThrow();
  });

  it("buffers events until initDebugLog is called", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fttm-debug-log-test-"));
    const logPath = join(tempDir, "debug.jsonl");

    appendDebugLog("sleep:start", { command: "caffeinate" });
    expect(existsSync(logPath)).toBe(false);

    initDebugLog(logPath);
    appendDebugLog("run:start", { prompt: "ship it" });

    const lines = readFileSync(logPath, "utf-8").trim().split("\n");
    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: "sleep:start",
      command: "caffeinate",
    });
    expect(JSON.parse(lines[1]!)).toMatchObject({
      event: "run:start",
      prompt: "ship it",
    });

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("keeps an explicit env log path when initDebugLog is called", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fttm-debug-log-test-"));
    const envLogPath = join(tempDir, "env-debug.jsonl");
    process.env.GNHF_DEBUG_LOG_PATH = envLogPath;

    appendDebugLog("sleep:start", { command: "caffeinate" });
    initDebugLog(join(tempDir, "run-debug.jsonl"));
    appendDebugLog("run:start", { prompt: "ship it" });

    const lines = readFileSync(envLogPath, "utf-8").trim().split("\n");
    expect(JSON.parse(lines[0]!)).toMatchObject({ event: "sleep:start" });
    expect(JSON.parse(lines[1]!)).toMatchObject({ event: "run:start" });

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("serializeError", () => {
  afterEach(() => {
    resetDebugLogForTests();
  });

  it("includes cause chains for nested errors", () => {
    const rootCause = Object.assign(new Error("socket hang up"), {
      code: "ECONNRESET",
    });
    const error = new Error("fetch failed", { cause: rootCause });

    expect(serializeError(error)).toMatchObject({
      name: "Error",
      message: "fetch failed",
      cause: {
        message: "socket hang up",
        code: "ECONNRESET",
      },
    });
  });

  it("never throws on unsupported values", () => {
    expect(() => serializeError(10n)).not.toThrow();
    expect(serializeError(10n)).toEqual({ value: "10" });
  });
});
