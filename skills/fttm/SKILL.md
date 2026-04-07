---
name: fttm
description: Interactively generate and run fttm (Fly to the Moon) autonomous coding agent commands. Use when user wants to start an fttm run, especially with specific agents (claude/codex/rovodev/opencode), models, iteration limits, token caps, or daemon mode. NOT for reading docs or explaining how fttm works. Triggers on "fttm", "fly to the moon", "autonomous coding loop", or any request to run/start the fttm agent orchestrator with a specific goal or task.
---

# fttm - Fly to the Moon

An interactive skill that generates fttm commands by asking all necessary questions upfront.

## How It Works

fttm is an autonomous coding agent orchestrator — each iteration makes one small, committed, documented change towards an objective while you sleep.

## Interaction Flow (Max 3 Rounds)

Collect all requirements in up to 3 rounds of questions, then generate and run the command.

### Round 1 — Core Requirements

Ask these together in one message:

1. **Objective** — What is the coding task/goal? (required)
2. **Agent** — Which agent? Options: `claude` (default), `codex`, `rovodev`, `opencode`
3. **Model** — If agent is `opencode`, ask which model (e.g., `minimax-cn-coding-plan/MiniMax-M2.7`)

### Round 2 — Limits & Mode (if relevant)

Based on Round 1 answers:

4. **Max iterations** — Any iteration cap? (default: unlimited)
5. **Max tokens** — Any token cap? (default: unlimited)
6. **Detach mode** — Run in background with `--detach`? (default: foreground)
7. **Commit mode** — Commit failed iterations too with `--commit`? (default: only on success)
8. **Sleep prevention** — Override config's default `preventSleep`? Options: `on` (default), `off`

### Round 3 — Generate Command

Generate the full command and show it:

```
fttm "<objective>" \
  --agent <agent> \
  [--model <model>] \
  [--max-iterations <n>] \
  [--max-tokens <n>] \
  [--detach] \
  [--commit] \
  [--prevent-sleep on|off]
```

Say: "Here's your fttm command:" followed by the command. Do NOT ask for confirmation — just present it.

## Quick Reference

| Flag               | Purpose                                      | Default                |
| ------------------ | -------------------------------------------- | ---------------------- |
| `--agent`          | `claude`, `codex`, `rovodev`, or `opencode`  | config file (`claude`) |
| `--model`          | Model for opencode                           | agent default          |
| `--max-iterations` | Stop after N iterations                      | unlimited              |
| `--max-tokens`     | Stop after N total tokens                    | unlimited              |
| `--detach`         | Background daemon mode                       | foreground             |
| `--commit`         | Commit both successful and failed iterations | false (success only)   |
| `--prevent-sleep`  | `on` or `off`                                | config file (`on`)     |

## Resume Detection

If the current git branch is already a `fttm/` branch, fttm will offer to resume the previous run. You can acknowledge this in your question round: "I see you're on an fttm branch — should I resume or start fresh?"

## Examples

**Minimal run:**

- Objective: "reduce API latency by 50%"
- Agent: (just use default claude)
  → `fttm "reduce API latency by 50%"`

**Full featured:**

- Objective: "migrate user auth to JWT"
- Agent: opencode
- Model: minimax-cn-coding-plan/MiniMax-M2.7
- Max iterations: 20
- Detach: yes
- Commit failed: yes
  → `fttm "migrate user auth to JWT" --agent opencode --model minimax-cn-coding-plan/MiniMax-M2.7 --max-iterations 20 --detach --commit`
