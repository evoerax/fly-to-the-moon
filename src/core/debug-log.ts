import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PRE_INIT_BUFFER_CAPACITY = 1000;
const STACK_LINE_LIMIT = 12;
const CAUSE_DEPTH_LIMIT = 6;

let logPath: string | null = null;
let preInitBuffer: string[] = [];
let preInitDroppedCount = 0;

function formatLine(event: string, details: Record<string, unknown>): string {
  const base = {
    timestamp: new Date().toISOString(),
    pid: process.pid,
    event,
  };

  try {
    return `${JSON.stringify({ ...base, ...details })}\n`;
  } catch (error) {
    return `${JSON.stringify({
      ...base,
      logError:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      detailsKeys: Object.keys(details),
    })}\n`;
  }
}

export function initDebugLog(path: string): void {
  const resolvedPath = process.env.GNHF_DEBUG_LOG_PATH ?? path;
  logPath = resolvedPath;

  try {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  } catch {
    // Best-effort: the directory usually already exists.
  }

  if (preInitBuffer.length === 0 && preInitDroppedCount === 0) {
    return;
  }

  const droppedSentinel =
    preInitDroppedCount > 0
      ? formatLine("debug-log:pre-init-overflow", {
          droppedCount: preInitDroppedCount,
          bufferCapacity: PRE_INIT_BUFFER_CAPACITY,
        })
      : "";

  try {
    appendFileSync(
      resolvedPath,
      droppedSentinel + preInitBuffer.join(""),
      "utf-8",
    );
  } catch {
    // Debug logging is best-effort only.
  } finally {
    preInitBuffer = [];
    preInitDroppedCount = 0;
  }
}

export function appendDebugLog(
  event: string,
  details: Record<string, unknown> = {},
): void {
  const line = formatLine(event, details);

  if (logPath === null) {
    const envLogPath = process.env.GNHF_DEBUG_LOG_PATH;
    if (envLogPath) {
      logPath = envLogPath;
    } else {
      preInitBuffer.push(line);
      if (preInitBuffer.length > PRE_INIT_BUFFER_CAPACITY) {
        preInitBuffer.shift();
        preInitDroppedCount += 1;
      }
      return;
    }
  }

  try {
    appendFileSync(logPath, line, "utf-8");
  } catch {
    // Debug logging is best-effort only.
  }
}

export function serializeError(
  error: unknown,
  depth = 0,
): Record<string, unknown> {
  try {
    return serializeErrorUnsafe(error, depth);
  } catch (serializationError) {
    return {
      value: "[serialization failed]",
      serializationError:
        serializationError instanceof Error
          ? `${serializationError.name}: ${serializationError.message}`
          : String(serializationError),
    };
  }
}

function tryRead<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function serializeErrorUnsafe(
  error: unknown,
  depth: number,
): Record<string, unknown> {
  if (depth > CAUSE_DEPTH_LIMIT) {
    return { value: "[cause chain truncated]" };
  }

  if (error instanceof Error) {
    const result: Record<string, unknown> = {
      name: tryRead(() => error.name) ?? "Error",
      message: tryRead(() => error.message) ?? "",
    };

    const code = tryRead(() => (error as { code?: unknown }).code);
    if (typeof code === "string" || typeof code === "number") {
      result.code = code;
    }

    const stack = tryRead(() => error.stack);
    if (typeof stack === "string") {
      result.stack = stack.split("\n").slice(0, STACK_LINE_LIMIT).join("\n");
    }

    const cause = tryRead(() => ("cause" in error ? error.cause : undefined));
    if (cause !== undefined) {
      result.cause = serializeError(cause, depth + 1);
    }

    return result;
  }

  if (error === null || error === undefined) {
    return { value: String(error) };
  }

  if (typeof error === "bigint") {
    return { value: error.toString() };
  }

  if (typeof error === "object") {
    try {
      return { value: JSON.parse(JSON.stringify(error)) as unknown };
    } catch {
      return { value: String(error) };
    }
  }

  return { value: String(error) };
}

export function resetDebugLogForTests(): void {
  logPath = null;
  preInitBuffer = [];
  preInitDroppedCount = 0;
}
