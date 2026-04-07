# Changelog

## 0.1.18 (2026-04-08)

### Features

- **agents:** use `prompt_async` endpoint instead of blocking `/message` for opencode agent — structured output extracted from SSE events, avoiding fetch timeouts during long-running operations
- **core:** add detailed JSONL debug logging to `.fttm/runs/<runId>/debug.jsonl` with `initDebugLog`, `serializeError` (including error cause chains), and lifecycle events for orchestrator, agent, and HTTP requests
- **cli:** keep the final interactive TUI visible after aborted runs until the user exits
- **cli:** add `--model` flag for specifying model per-agent (currently Claude)
- **cli:** add `--commit` flag to commit both successful and failed iterations
- **config:** allow per-agent binary path overrides
- **renderer:** randomize star field seeds between runs

### Bug Fixes

- **agents:** support Windows cmd/bat agent wrappers and terminate overridden agent processes cleanly
- **renderer:** keep wide Unicode graphemes wrapped and aligned in the live terminal UI
