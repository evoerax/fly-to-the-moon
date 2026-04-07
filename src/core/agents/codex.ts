import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import type {
  Agent,
  AgentResult,
  AgentOutput,
  TokenUsage,
  AgentRunOptions,
} from "./types.js";
import {
  parseJSONLStream,
  setupAbortHandler,
  setupChildProcessHandlers,
} from "./stream-utils.js";

interface CodexItemCompleted {
  type: "item.completed";
  item: {
    type: string;
    text?: string;
    command?: string[];
    query?: string;
    title?: string;
    name?: string;
    tool_name?: string;
  };
}

interface CodexTurnCompleted {
  type: "turn.completed";
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
}

interface CodexItemStarted {
  type: "item.started";
  item: {
    type: string;
    command?: string[];
    query?: string;
    title?: string;
    name?: string;
    tool_name?: string;
  };
}

interface CodexTurnStarted {
  type: "turn.started";
}

interface CodexTurnFailed {
  type: "turn.failed";
  error?: {
    message?: string;
  };
}

interface CodexErrorEvent {
  type: "error";
  message?: string;
  error?: {
    message?: string;
  };
}

type CodexEvent =
  | CodexItemCompleted
  | CodexItemStarted
  | CodexTurnCompleted
  | CodexTurnStarted
  | CodexTurnFailed
  | CodexErrorEvent
  | { type: string };

function truncateStatus(text: string, maxLength = 60): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function extractEventErrorMessage(event: CodexTurnFailed | CodexErrorEvent): string {
  return (
    event.error?.message ??
    ("message" in event ? event.message : undefined) ??
    "unknown error"
  );
}

function formatStartedItemMessage(item: CodexItemStarted["item"]): string | null {
  if (item.type === "command_execution") {
    return item.command?.length ? `Running: ${item.command.join(" ")}` : "Running command...";
  }

  if (item.type === "web_search") {
    return item.query ? `Searching: ${item.query}` : "Searching...";
  }

  if (item.type === "mcp_tool_call") {
    const toolName = item.tool_name ?? item.name ?? item.title;
    return toolName ? `Using tool: ${toolName}` : "Using tool...";
  }

  return null;
}

function formatCompletedItemMessage(item: CodexItemCompleted["item"]): string | null {
  if (item.type === "reasoning" && item.text?.trim()) {
    return `Reasoning: ${truncateStatus(item.text.trim())}`;
  }

  return null;
}

interface CodexAgentDeps {
  bin?: string;
  platform?: NodeJS.Platform;
}

function shouldUseWindowsShell(
  bin: string,
  platform: NodeJS.Platform,
): boolean {
  if (platform !== "win32") {
    return false;
  }

  if (/\.(cmd|bat)$/i.test(bin)) {
    return true;
  }

  if (/[\\/]/.test(bin)) {
    return false;
  }

  try {
    const resolved = execFileSync("where", [bin], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const firstMatch = resolved
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return firstMatch ? /\.(cmd|bat)$/i.test(firstMatch) : false;
  } catch {
    return false;
  }
}

function terminateCodexProcess(
  child: ReturnType<typeof spawn>,
  platform: NodeJS.Platform,
): void {
  if (platform === "win32" && child.pid) {
    try {
      execFileSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], {
        stdio: "ignore",
      });
    } catch {
      // Best-effort: the process may have already exited.
    }
    return;
  }

  child.kill("SIGTERM");
}

export class CodexAgent implements Agent {
  name = "codex";

  private bin: string;
  private platform: NodeJS.Platform;
  private schemaPath: string;

  constructor(schemaPath: string, binOrDeps: string | CodexAgentDeps = {}) {
    const deps = typeof binOrDeps === "string" ? { bin: binOrDeps } : binOrDeps;
    this.bin = deps.bin ?? "codex";
    this.platform = deps.platform ?? process.platform;
    this.schemaPath = schemaPath;
  }

  run(
    prompt: string,
    cwd: string,
    options?: AgentRunOptions,
  ): Promise<AgentResult> {
    const { onUsage, onMessage, signal, logPath } = options ?? {};

    return new Promise((resolve, reject) => {
      const logStream = logPath ? createWriteStream(logPath) : null;

      const child = spawn(
        this.bin,
        [
          "exec",
          prompt,
          "--json",
          "--output-schema",
          this.schemaPath,
          "--dangerously-bypass-approvals-and-sandbox",
          "--color",
          "never",
        ],
        {
          cwd,
          shell: shouldUseWindowsShell(this.bin, this.platform),
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        },
      );

      if (
        setupAbortHandler(signal, child, reject, () =>
          terminateCodexProcess(child, this.platform),
        )
      ) {
        return;
      }

      let lastAgentMessage: string | null = null;
      let terminalError: Error | null = null;
      const cumulative: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      };

      parseJSONLStream<CodexEvent>(child.stdout!, logStream, (event) => {
        if (event.type === "turn.started") {
          onMessage?.("Starting turn...");
          return;
        }

        if (event.type === "item.started" && "item" in event) {
          const message = formatStartedItemMessage((event as CodexItemStarted).item);
          if (message) {
            onMessage?.(message);
          }
          return;
        }

        if (
          event.type === "item.completed" &&
          "item" in event &&
          (event as CodexItemCompleted).item.type === "agent_message"
        ) {
          lastAgentMessage = (event as CodexItemCompleted).item.text;
          onMessage?.(lastAgentMessage);
          return;
        }

        if (event.type === "item.completed" && "item" in event) {
          const message = formatCompletedItemMessage(
            (event as CodexItemCompleted).item,
          );
          if (message) {
            onMessage?.(message);
          }
          return;
        }

        if (event.type === "turn.completed" && "usage" in event) {
          const u = (event as CodexTurnCompleted).usage;
          cumulative.inputTokens += u.input_tokens ?? 0;
          cumulative.outputTokens += u.output_tokens ?? 0;
          cumulative.cacheReadTokens += u.cached_input_tokens ?? 0;
          onUsage?.({ ...cumulative });
          return;
        }

        if (event.type === "turn.failed") {
          terminalError = new Error(
            `codex turn failed: ${extractEventErrorMessage(event)}`,
          );
          return;
        }

        if (event.type === "error") {
          terminalError = new Error(
            `codex error: ${extractEventErrorMessage(event)}`,
          );
        }
      });

      setupChildProcessHandlers(child, "codex", logStream, reject, () => {
        if (terminalError) {
          reject(terminalError);
          return;
        }

        if (!lastAgentMessage) {
          reject(new Error("codex completed without a final agent_message"));
          return;
        }

        try {
          const output = JSON.parse(lastAgentMessage) as AgentOutput;
          resolve({ output, usage: cumulative });
        } catch (err) {
          reject(
            new Error(
              `Failed to parse codex output: ${err instanceof Error ? err.message : err}`,
            ),
          );
        }
      });
    });
  }
}
