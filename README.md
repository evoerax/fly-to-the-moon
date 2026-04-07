<p align="center">Humans fly to space. AI does the work.</p>
<h1 align="center">Fly to the Moon, Fly to Mars</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/fly-to-moon"
    ><img
      alt="npm"
      src="https://img.shields.io/npm/v/fly-to-moon?style=flat-square"
  /></a>
  <a
    href="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square"
    ><img
      alt="Platform"
      src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square"
  /></a>
</p>

<p align="center">
  <!-- <img src="assets/splash.png" alt="fttm — Fly to the Moon" width="800"> -->
</p>

Never wake up empty-handed.

fttm is an autonomous coding agent orchestrator — each iteration makes one small, committed, documented change towards an objective while you sleep. You wake up to a branch full of clean work and a log of everything that happened.

- **Dead simple** — one command starts an autonomous loop that runs until you Ctrl+C or a configured runtime cap is reached
- **Long running** — each iteration is committed on success, rolled back on failure, with sensible retries and exponential backoff
- **Agent-agnostic** — works with Claude Code, Codex, Rovo Dev, or OpenCode out of the box

## Quick Start

### Install

```sh
npm install -g fly-to-moon
```

### Update

```sh
npm install -g fly-to-moon@latest
```

Or force reinstall:

```sh
npm install -g fly-to-moon@latest --force
```

### OpenCode

```sh
fttm "your task here" \
    --agent opencode \
    --model minimax-cn-coding-plan/MiniMax-M2.7
```

### Claude Code

```sh
fttm "your task here" --agent claude
```

### Codex

```sh
fttm "your task here" --agent codex
```

### Background/Daemon Mode

```sh
fttm "your task here" \
    --agent opencode \
    --model minimax-cn-coding-plan/MiniMax-M2.7 \
    --max-iterations 50 \
    --detach
# runs in background, returns immediately to terminal
```

### Skills

Install the `fttm` skill for interactive command generation:

```sh
npx skills add evoerax/fly-to-the-moon --skill fttm
```

Then use it:

```
fttm skill -> interactive fttm command builder
```

Run `fttm` from inside a Git repository with a clean working tree. If you are starting from a plain directory, run `git init` first.
`fttm` supports macOS, Linux, and Windows.

## Install (From source)

```sh
git clone https://github.com/evoerax/fly-to-the-moon.git
cd fly-to-the-moon
npm install
npm run build
npm link
```

## How It Works

```
                    ┌─────────────┐
                    │  fttm start │
                    └──────┬──────┘
                           ▼
                 ┌──────────────────────┐
                 │  validate clean git  │
                 │  create fttm/ branch │
                 │  write prompt.md     │
                 └──────────┬───────────┘
                            ▼
               ┌────────────────────────────┐
               │  build iteration prompt    │◄──────────────┐
               │  (inject notes.md context) │               │
               └────────────┬───────────────┘               │
                            ▼                               │
               ┌────────────────────────────┐               │
               │  invoke your agent         │               │
               │  (non-interactive mode)    │               │
               └────────────┬───────────────┘               │
                            ▼                               │
                     ┌─────────────┐                        │
                     │  success?   │                        │
                     └──┬──────┬───┘                        │
                   yes  │      │  no                        │
                        ▼      ▼                            │
               ┌──────────┐  ┌───────────┐                  │
               │  commit  │  │ git reset │                  │
               │  append  │  │  --hard   │                  │
               │ notes.md │  │  backoff  │                  │
               └────┬─────┘  └─────┬─────┘                  │
                    │              │                        │
                    │   ┌──────────┘                        │
                    ▼   ▼                                   │
               ┌────────────┐    yes   ┌──────────┐         │
               │ 3 consec.  ├─────────►│  abort   │         │
               │ failures?  │          └──────────┘         │
               └─────┬──────┘                               │
                  no │                                      │
                     └──────────────────────────────────────┘
```

- **Incremental commits** — each successful iteration is a separate git commit, so you can cherry-pick or revert individual changes
- **Runtime caps** — `--max-iterations` stops before the next iteration begins, while `--max-tokens` can abort mid-iteration once reported usage reaches the cap; uncommitted work is rolled back in either case
- **Shared memory** — the agent reads `notes.md` (built up from prior iterations) to communicate across iterations
- **Local run metadata** — fttm stores prompt, notes, and resume metadata under `.fttm/runs/` and ignores it locally, so your branch only contains intentional work
- **Resume support** — run `fttm` while on an existing `fttm/` branch to pick up where a previous run left off

## CLI Reference

| Command                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `fttm "<prompt>"`         | Start a new run with the given objective        |
| `fttm`                    | Resume a run (when on an existing fttm/ branch) |
| `echo "<prompt>" \| fttm` | Pipe prompt via stdin                           |
| `cat prd.md \| fttm`      | Pipe a large spec or PRD via stdin              |

### Flags

| Flag                     | Description                                                                    | Default                |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------- |
| `--agent <agent>`        | Agent to use (`claude`, `codex`, `rovodev`, or `opencode`)                     | config file (`claude`) |
| `--model <model>`        | Model to use with opencode agent (e.g., `minimax-cn-coding-plan/MiniMax-M2.7`) | agent default          |
| `--max-iterations <n>`   | Abort after `n` total iterations                                               | unlimited              |
| `--max-tokens <n>`       | Abort after `n` total input+output tokens                                      | unlimited              |
| `--detach`               | Run in daemon mode (background execution with `--max-iterations`)              | `false` (foreground)   |
| `--prevent-sleep <mode>` | Prevent system sleep during the run (`on`/`off` or `true`/`false`)             | config file (`on`)     |
| `--commit`               | Commit both successful and failed iterations (default: only on success)        | `false`                |
| `--version`              | Show version                                                                   |                        |

## Configuration

Config lives at `~/.fttm/config.yml`:

```yaml
# Agent to use by default (claude, codex, rovodev, or opencode)
agent: claude

# Custom paths to agent binaries (optional)
# agentPathOverride:
#   claude: /path/to/custom-claude
#   codex: /path/to/custom-codex

# Abort after this many consecutive failures
maxConsecutiveFailures: 3

# Prevent the machine from sleeping during a run
preventSleep: true
```

If the file does not exist yet, `fttm` creates it on first run using the resolved defaults.

CLI flags override config file values. `--prevent-sleep` accepts `on`/`off` as well as `true`/`false`; the config file always uses a boolean.
The iteration and token caps are runtime-only flags and are not persisted in `config.yml`.

### Custom Agent Paths

Use `agentPathOverride` to point any agent at a custom binary — useful for wrappers like Claude Code Switch or custom Codex builds that accept the same flags and arguments as the original:

```yaml
agentPathOverride:
  claude: ~/bin/claude-code-switch
  codex: /usr/local/bin/my-codex-wrapper
```

Paths may be absolute, bare executable names already on your `PATH`, `~`-prefixed, or relative to the config directory (`~/.fttm/`). The override replaces only the binary name; all standard arguments are preserved, so the replacement must be CLI-compatible with the original agent. On Windows, `.cmd` and `.bat` wrappers are supported, including bare names resolved from `PATH`. For `rovodev`, the override must point to an `acli`-compatible binary since fttm invokes it as `<bin> rovodev serve ...`.
When sleep prevention is enabled, `fttm` uses the native mechanism for your OS: `caffeinate` on macOS, `systemd-inhibit` on Linux, and a small PowerShell helper backed by `SetThreadExecutionState` on Windows.

### Sleep Prevention

By default, `fttm` prevents your computer from sleeping while running:

| OS      | Command                                | What it does                         |
| ------- | -------------------------------------- | ------------------------------------ |
| macOS   | `caffeinate -i -w <pid>`               | Prevents idle sleep until fttm exits |
| Linux   | `systemd-inhibit`                      | Blocks sleep via systemd logind      |
| Windows | PowerShell + `SetThreadExecutionState` | Calls Windows sleep blocker API      |

You can disable this with `--prevent-sleep off`.

## Local Run Metadata

`fttm` stores run data in `.fttm/runs/<run-id>/` within your project:

```
.fttm/
└── runs/
    └── <run-id>/
        ├── notes.md          # Iteration history (cumulative)
        ├── prompt.md         # Original prompt
        ├── base-commit       # Git commit hash where run started
        └── output-schema.json # JSON schema for agent output
```

This folder is automatically added to `.gitignore` — it never gets committed.

## Debug Logs

Set `FTtm_DEBUG_LOG_PATH` to capture lifecycle events as JSONL while debugging a run:

```sh
FTtm_DEBUG_LOG_PATH=/tmp/fttm-debug.jsonl fttm "ship it"
```

## UI Display

The terminal UI shows real-time information about the run:

- **Top bar**: Displays the agent being used (e.g., `fttm · opencode`)
- **Bottom bar**: Shows the model name (for opencode) and resume hint (`[ctrl+c to stop, fttm again to resume]`)
- **Stats line**: Shows elapsed time, iteration count (`iter X/Y` or `iter X/∞` if unlimited), token usage, and commit count
- **Moon phases**: Visual representation of iteration progress

## Agents

`fttm` supports four agents:

| Agent       | Flag               | Requirements                                                               | Notes                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `--agent claude`   | Install Anthropic's `claude` CLI and sign in first.                        | `fttm` invokes `claude` directly in non-interactive mode.                                                                                                                                                                                                                                                                  |
| Codex       | `--agent codex`    | Install OpenAI's `codex` CLI and sign in first.                            | `fttm` invokes `codex exec` directly in non-interactive mode.                                                                                                                                                                                                                                                              |
| Rovo Dev    | `--agent rovodev`  | Install Atlassian's `acli` and authenticate it with Rovo Dev first.        | `fttm` starts a local `acli rovodev serve --disable-session-token <port>` process automatically in the repo workspace.                                                                                                                                                                                                     |
| OpenCode    | `--agent opencode` | Install `opencode` and configure at least one usable model provider first. | `fttm` starts a local `opencode serve --hostname 127.0.0.1 --port <port> --print-logs` process automatically, creates a per-run session, and applies a blanket allow rule so tool calls do not block on prompts. Use `--model` to specify a model (format: `provider/model`, e.g., `minimax-cn-coding-plan/MiniMax-M2.7`). |

## Acknowledgments

fttm is inspired by and built upon the pioneering work of [gnhf](https://github.com/kunchenguid/gnhf) — "Good Night, Have Fun". The original project proved that autonomous coding agents can be both practical and delightful.

Special thanks to the open-source community and all the developers who make tools like this possible.

## Development

```sh
npm run build          # Build with tsdown
npm run dev            # Watch mode
npm test               # Build, then run unit tests (vitest)
npm run test:e2e       # Build, then run end-to-end tests against the mock opencode executable
npm run lint           # ESLint
npm run format         # Prettier
```
