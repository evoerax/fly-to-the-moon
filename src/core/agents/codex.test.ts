import { beforeEach, describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { CodexAgent } from "./codex.js";

const mockSpawn = vi.mocked(spawn);

function createMockProcess() {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: null,
    kill: vi.fn(),
  });
  return proc as typeof proc & ReturnType<typeof spawn>;
}

function emitJsonl(
  proc: ReturnType<typeof createMockProcess>,
  events: unknown[],
  closeCode = 0,
) {
  for (const event of events) {
    proc.stdout.emit("data", Buffer.from(`${JSON.stringify(event)}\n`));
  }
  proc.emit("close", closeCode, null);
}

describe("CodexAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not use a shell for direct Windows launches", () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const agent = new CodexAgent("/tmp/schema.json", {
      platform: "win32",
    });

    agent.run("test prompt", "/work/dir");

    expect(mockSpawn).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "test prompt",
        "--json",
        "--output-schema",
        "/tmp/schema.json",
        "--dangerously-bypass-approvals-and-sandbox",
        "--color",
        "never",
      ],
      {
        cwd: "/work/dir",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );
  });

  it("uses a shell on Windows for cmd wrapper paths", () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const agent = new CodexAgent("/tmp/schema.json", {
      bin: "C:\\tools\\codex.cmd",
      platform: "win32",
    });

    agent.run("test prompt", "/work/dir");

    expect(mockSpawn).toHaveBeenCalledWith(
      "C:\\tools\\codex.cmd",
      [
        "exec",
        "test prompt",
        "--json",
        "--output-schema",
        "/tmp/schema.json",
        "--dangerously-bypass-approvals-and-sandbox",
        "--color",
        "never",
      ],
      {
        cwd: "/work/dir",
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );
  });

  it("uses a shell on Windows when a bare override resolves to a cmd wrapper", () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    vi.mocked(execFileSync).mockReturnValue(
      "C:\\tools\\codex-switch.cmd\r\n" as never,
    );
    const agent = new CodexAgent("/tmp/schema.json", {
      bin: "codex-switch",
      platform: "win32",
    });

    agent.run("test prompt", "/work/dir");

    expect(mockSpawn).toHaveBeenCalledWith(
      "codex-switch",
      [
        "exec",
        "test prompt",
        "--json",
        "--output-schema",
        "/tmp/schema.json",
        "--dangerously-bypass-approvals-and-sandbox",
        "--color",
        "never",
      ],
      {
        cwd: "/work/dir",
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );
  });

  it("kills the full process tree on Windows when aborted", async () => {
    const proc = createMockProcess();
    Object.defineProperty(proc, "pid", { value: 6789 });
    mockSpawn.mockReturnValue(proc);
    const controller = new AbortController();
    const agent = new CodexAgent("/tmp/schema.json", {
      platform: "win32",
    });

    const promise = agent.run("test prompt", "/work/dir", {
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toThrow("Agent was aborted");
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      "taskkill",
      ["/T", "/F", "/PID", "6789"],
      { stdio: "ignore" },
    );
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it("surfaces high-signal progress updates from started and completed items", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const onMessage = vi.fn();
    const onUsage = vi.fn();
    const agent = new CodexAgent("/tmp/schema.json");

    const promise = agent.run("test prompt", "/work/dir", {
      onMessage,
      onUsage,
    });

    emitJsonl(proc, [
      { type: "turn.started" },
      {
        type: "item.started",
        item: {
          type: "command_execution",
          command: ["npm", "test"],
        },
      },
      {
        type: "item.started",
        item: {
          type: "web_search",
          query: "vitest child process mocking",
        },
      },
      {
        type: "item.completed",
        item: {
          type: "reasoning",
          text: "Investigating why the child process exits before sending the final message.",
        },
      },
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            success: true,
            summary: "done",
            key_changes_made: ["a"],
            key_learnings: ["b"],
          }),
        },
      },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 12,
          cached_input_tokens: 3,
          output_tokens: 5,
        },
      },
    ]);

    await expect(promise).resolves.toEqual({
      output: {
        success: true,
        summary: "done",
        key_changes_made: ["a"],
        key_learnings: ["b"],
      },
      usage: {
        inputTokens: 12,
        outputTokens: 5,
        cacheReadTokens: 3,
        cacheCreationTokens: 0,
      },
    });
    expect(onMessage).toHaveBeenNthCalledWith(1, "Starting turn...");
    expect(onMessage).toHaveBeenNthCalledWith(2, "Running: npm test");
    expect(onMessage).toHaveBeenNthCalledWith(
      3,
      "Searching: vitest child process mocking",
    );
    expect(onMessage).toHaveBeenNthCalledWith(
      4,
      "Reasoning: Investigating why the child process exits before sending ...",
    );
    expect(onMessage).toHaveBeenLastCalledWith(
      '{"success":true,"summary":"done","key_changes_made":["a"],"key_learnings":["b"]}',
    );
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 12,
      outputTokens: 5,
      cacheReadTokens: 3,
      cacheCreationTokens: 0,
    });
  });

  it("rejects immediately on turn.failed events", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const agent = new CodexAgent("/tmp/schema.json");

    const promise = agent.run("test prompt", "/work/dir");

    emitJsonl(proc, [
      {
        type: "turn.failed",
        error: {
          message: "model overloaded",
        },
      },
    ]);

    await expect(promise).rejects.toThrow("codex turn failed: model overloaded");
  });

  it("rejects immediately on error events", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const agent = new CodexAgent("/tmp/schema.json");

    const promise = agent.run("test prompt", "/work/dir");

    emitJsonl(proc, [
      {
        type: "error",
        message: "connection dropped",
      },
    ]);

    await expect(promise).rejects.toThrow("codex error: connection dropped");
  });

  it("fails with a clearer error when no final agent_message is produced", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const agent = new CodexAgent("/tmp/schema.json");

    const promise = agent.run("test prompt", "/work/dir");

    emitJsonl(proc, [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "reasoning",
          text: "Still working",
        },
      },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 1,
          cached_input_tokens: 0,
          output_tokens: 1,
        },
      },
    ]);

    await expect(promise).rejects.toThrow(
      "codex completed without a final agent_message",
    );
  });
});
