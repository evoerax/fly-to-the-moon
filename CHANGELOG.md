# Changelog

## [0.1.12](https://github.com/evoerax/fly-to-the-moon/compare/gnhf-v0.1.11...gnhf-v0.1.12) (2026-04-09)


### Features

* add --commit flag to commit failed iterations ([1abca5d](https://github.com/evoerax/fly-to-the-moon/commit/1abca5dbebf4881e45d459f3181de2ebf84af958))
* add opencode async prompt support and debug logging (codex) ([f771352](https://github.com/evoerax/fly-to-the-moon/commit/f77135208720f89b4cb6291c467b951fd6d21d12))


### Bug Fixes

* bin field maps to 'fttm' command instead of 'fly-to-moon' ([29b3b18](https://github.com/evoerax/fly-to-the-moon/commit/29b3b18805939fee45c9fc4c9cb251e545f1966b))
* update --model description to reflect it works for all agents ([2ed1656](https://github.com/evoerax/fly-to-the-moon/commit/2ed165687ed5473ace11775b40138cb7300f72fe))

## 0.1.21 (2026-04-08)

### Features

- **agents:** enhance Codex agent with richer event handling — `turn.started`, `item.started` (command_execution, web_search, mcp_tool_call), `item.completed reasoning`, `turn.failed`, and `error` events now surface meaningful progress updates to the UI (e.g., "Running: ls", "Searching: how to fix...", "Using tool: github.create_issue")
- **agents:** Codex agent now surfaces clear error messages when `turn.failed` or `error` events occur, instead of silent failures

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
