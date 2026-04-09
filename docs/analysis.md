# fttm 项目分析总结

## 项目概览

fttm (Fly to the Moon) 是一个自主编码 agent 编排器。它把大任务拆成小迭代，每轮调用 agent（Claude/Codex/OpenCode/RovoDev）执行一小步，自动提交、记录、推进。

## omni-tutorial 项目运行数据

基于 `/Users/leon/files/Agent-Vault/omni-tutorial/.fttm/runs/` 的真实运行记录。

### 总计

- **18 个 run**（每次独立 fttm 命令产生的运行）
- **342 次迭代**（总计所有 run 的 iteration 数）
- **~485 KB notes.md** 内容（总计）

### 各 run 详情

| Run                         | 迭代数 | 字符   | 单词   | Token (≈) | 每迭代 Token |
| --------------------------- | ------ | ------ | ------ | --------- | ------------ |
| create-fields-medal-44ce70  | 80     | 86,331 | 11,701 | ~15,211   | ~190         |
| 2025-1901-2024-docs-9aa6d6  | 59     | 80,488 | 10,765 | ~13,994   | ~237         |
| web-docs-en-turing-1-555fd9 | 25     | 36,956 | 4,695  | ~6,103    | ~244         |
| omni-tutorial-web-ma-903413 | 23     | 30,490 | 4,219  | ~5,484    | ~238         |
| 2025-1901-2024-docs-45d9d2  | 21     | 66,534 | 8,511  | ~11,064   | ~526         |
| web-create-english-m-91a76f | 21     | 48,960 | 5,825  | ~7,572    | ~360         |
| 1-markdown-turing-md-999395 | 20     | 48,714 | 6,140  | ~7,982    | ~399         |
| 1-markdown-turing-md-fa9785 | 20     | 75     | 9      | ~11       | ~0           |
| 2025-1901-1920-docs-d0fce2  | 17     | 26,446 | 3,585  | ~4,660    | ~274         |
| 2025-1901-2024-docs-0ce6c9  | 14     | 41,532 | 5,700  | ~7,410    | ~529         |
| 1966-1991-2002-2008-b6a7c3  | 12     | 20,048 | 2,568  | ~3,338    | ~278         |
| 2025-1901-1928-docs-dac744  | 9      | 29,133 | 3,815  | ~4,959    | ~551         |
| 2025-1901-2024-docs-9fe61a  | 7      | 4,481  | 557    | ~724      | ~103         |
| 8-1966-2014-8-2015-d-197fc5 | 4      | 3,039  | 406    | ~527      | ~131         |
| 4-1966-2020-2024-4-2-4f7189 | 3      | 665    | 89     | ~115      | ~38          |
| 2025-1901-2024-docs-71294a  | 2      | 1,514  | 183    | ~237      | ~118         |
| 2025-1901-1906-docs-b0c39d  | 0      | 498    | 20     | ~26       | —            |

### Token 估算方法

- 英文 1 单词 ≈ 1.3 tokens（GPT/Claude 统一）
- 计算方式：`tokens = words × 1.3`
- 每迭代增加约 190~551 tokens（取决于 notes 的详细程度）

### 上下文消耗分析

- **notes.md 本身不长**：最大 15K tokens（80 次迭代）
- **真正的 token 消耗在 iteration JSONL**：每次迭代 100+ KB 的事件流
- **context 占比估算**：
  - Codex 1M context：15K tokens = 1.5%
  - Claude 200K context：15K tokens = 7.5%
- **200 次迭代预估**：notes ≈ 38K~110K tokens

## 历史版本记录

### v0.1.17

- agent: opencode 使用 `prompt_async` 端点替代阻塞式 `/message`，结构化输出从 SSE 事件提取
- core: 添加 JSONL debug 日志（`initDebugLog`、`serializeError`）
- cli: abort 后保持 TUI 可见
- cli: 新增 `--model`（Claude）和 `--commit` 标志
- config: 允许每 agent 二进制路径覆盖
- renderer: 随机化星空种子
- bug fixes: Windows cmd/bat 支持、Unicode 字形对齐

### v0.1.18

- 修复 CHANGELOG URL 指向 fork
- README/SKILL 补充 `--commit` 文档

### v0.1.19

- CHANGELOG 精简为只含当前版本

### v0.1.20

- `--model` 描述修正为支持所有 agent

### v0.1.21

- agent: Codex 适配增强 — 处理 `turn.started`、`item.started`（command_execution/web_search/mcp_tool_call）、`item.completed reasoning`、`turn.failed`、`error` 事件
- agent: Codex 错误信息更清晰

## 每轮迭代 Prompt 模板

每轮迭代发送给 agent 的 prompt 结构一致，只有两个变量变化：

```
You are working autonomously towards an objective given below.
This is iteration {N}. Each iteration aims to make an incremental step forward,
not to complete the entire objective.

## Instructions

1. Read .fttm/runs/{runId}/notes.md first to understand what has been done
2. Identify the next smallest logical unit of work
3. If nothing moved the needle, document learnings and record success=false
4. Run build/tests/linters/formatters if available. Do NOT make git commits
6. Respond with a JSON object according to the provided schema

## Output

- success: boolean
- summary: string
- key_changes_made: string[]
- key_learnings: string[]

## Objective

{用户写的 prompt}
```

变量：

- `{N}` — 迭代编号（每轮 +1）
- `{runId}` — 运行 ID（不变）
- `notes.md` — 被前序迭代追加，越来越长

## 当前 Skill 流程（fttm SKILL.md）

### Round 1 — 迭代计划

- 告知用户将在 `.fttm/plans/plan-YYYYMMDD.md` 创建计划
- 用户选择：AI 生成 / 自己提供 / 描述方向

### Round 2 — Agent & 参数

- agent、model、max-iterations、max-tokens、detach、commit、prevent-sleep

### Round 3 — 生成命令

- `cat .fttm/plans/plan-YYYYMMDD.md | fttm "<objective>" --agent <agent> ...`

## v0.2.1 开发计划

### Phase 1: 核心

1. 滑动窗口记忆（只保留最近 N 次迭代的完整内容）
2. 配置分层（系统级 / 项目级 / CLI 参数）
3. 运行报告（report.json）
4. 长对话压缩（100+ 迭代后自动压缩 notes.md）
5. 迭代结果缓存（相同 scope 复用）

### Phase 2: 重要

6. checkpoint/crash recovery
7. CLI 子命令（start/resume/status/log/report/stop）
8. token 统计持久化
9. 上下文拉满模式（`--context-mode full`，注入历史到 context window）
10. 统筹 Agent（Coordinator 监督 + 危险操作确认）

### Phase 3: 增强

11. Coordinator 危险操作检测
12. Hooks 系统
13. Agent 能力声明
14. 插件系统

## 项目文件结构

```
fly-to-moon/
├── src/
│   ├── core/
│   │   ├── orchestrator.ts      # 迭代循环核心
│   │   ├── run.ts               # 运行生命周期
│   │   ├── debug-log.ts         # JSONL 日志
│   │   └── agents/              # Agent 实现
│   │       ├── claude.ts
│   │       ├── codex.ts
│   │       ├── opencode.ts
│   │       ├── rovodev.ts
│   │       ├── factory.ts
│   │       └── types.ts
│   ├── templates/
│   │   └── iteration-prompt.ts  # Prompt 模板
│   ├── renderer.ts              # TUI 渲染
│   └── cli.ts                   # 命令行入口
├── skills/fttm/                 # Skill 模板
│   ├── SKILL.md
│   └── references/plan-template.md
├── docs/
│   └── v0.2.1-plan.md           # 架构重构计划
├── dist/                        # 构建产物
└── test/                        # 测试
```
