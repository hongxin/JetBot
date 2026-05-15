# JetBot

**Browser-based AI Coding Assistant — Zero Install. Zero Deploy. Zero Config.**

[中文文档](README.zh-CN.md)

JetBot is a fully browser-based AI coding assistant. No backend server, no deployment pipeline, no installation required — just open the page and start working. All code executes client-side via JavaScript; LLM calls go directly from the browser's `fetch()` to your chosen API provider.

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
│  │  React   │  │  Agentic  │  │  Virtual   │ │
│  │   UI     │←→│   Loop    │←→│   FS       │ │
│  └──────────┘  └─────┬─────┘  │ (IndexedDB)│ │
│                      │        └───────────┘ │
│                      │ fetch()               │
└──────────────────────┼──────────────────────┘
                       ↓
              ┌────────────────┐
              │  LLM Provider  │
              │ OpenAI/DeepSeek│
              │ Ollama/Custom  │
              └────────────────┘
```

## Quick Start

```bash
git clone https://github.com/hongxin/JetBot.git
cd JetBot/jetbot
npm install
npm run dev
```

Open `http://localhost:5173`, select an LLM provider, enter your API key, and start chatting.

**Local Ollama (fully offline):**

```bash
ollama serve
ollama pull qwen3.5:27b
# Select the Ollama provider in JetBot — no API key needed
```

**Production build:**

```bash
npm run build
# Outputs dist/ — pure static files deployable to any static host
```

## Features

### Agentic Loop

An autonomous tool-calling loop where the LLM selects tools, executes actions, and analyzes results until the task is complete. Supports up to 100 iterations with circuit breaker protection (3 consecutive failures) and automatic duplicate-error detection.

### 10 Built-in Tools

| Tool | Permission | Description |
|------|-----------|-------------|
| `read_file` | safe | Read files from the virtual file system |
| `list_dir` | safe | List directory structure |
| `search_text` | safe | Regex search across file contents |
| `write_file` | risky | Create or overwrite files |
| `edit_file` | risky | Precise find-and-replace editing |
| `http_get` | risky | HTTP requests (automatic CORS proxy fallback) |
| `js_eval` | risky | Sandboxed JavaScript execution (10s timeout) |
| `render_html` | risky | Render HTML/CSS to the preview panel |
| `shell_execute` | dangerous | Sandboxed shell commands |
| `export_file` | safe | Download files from VirtualFS to local disk |

### 18 Built-in Skills

Activate via `/skill <name>` to inject domain expertise into the system prompt:

`debug` · `code-review` · `architect` · `explain` · `tdd` · `writing` · `refactor` · `visualize` · `decision` · `security` · `perf`

**ZPower (Five Elements):** `zpower` · `z-observe` · `z-design` · `z-build` · `z-verify` · `z-evolve` · `z-diagram`

### Multi-Provider LLM

| Provider | Base URL | Notes |
|----------|---------|-------|
| **OpenAI** | `api.openai.com/v1` | GPT-4o, etc. |
| **DeepSeek** | `api.deepseek.com/v1` | Cost-effective |
| **Ollama** | `localhost:11434/v1` | Local, no API key |
| **Custom** | User-defined | Any OpenAI-compatible endpoint |

### Cosmos View

Conversations rendered as a force-directed starfield canvas — and beyond. Five node kinds coexist on a single graph:

- **user / assistant / tool** — the conversation flow
- **memory** (teal droplet) — facts/decisions saved to the persistent MemoryStore
- **skill** (amber hexagon) — capabilities distilled from a session and crystallized into SKILL.md

Memory and skill nodes attach via dashed *derives* edges back to the assistant turn that produced them, making it visible at a glance "what this conversation left behind." Node detail cards are resizable on eight handles and scroll long markdown internally. Drag-connect any two nodes to trigger an LLM relationship analysis.

### Permission System

Three-tier access control: **safe** (auto-approve), **risky** (approve once, then remembered), **dangerous** (approve every time). Toggle `/auto on` for autonomous mode.

### Additional Capabilities

- **Session Persistence** — Every turn is incrementally written to IndexedDB; crashed sessions can be recovered; previous sessions are searchable and recallable as long-term context (`/sessions`)
- **Memory Store** — Persistent facts, preferences, decisions injected into the system prompt across sessions (`/memory add|list|remove|clear`)
- **Skill Lifecycle** — Distilled skills carry quality score, use count, and a stage (new / active / stable / stale / deprecated); a Skills Panel in Settings manages activation, import (paste SKILL.md), and export
- **Auto-Distillation** — After a tool-heavy turn with good success rate, the agent proposes a reusable skill via a DistillCard; one click saves it
- **File Bridge** — Drag-and-drop local file import; `export_file` triggers browser download
- **Scheduler** — In-browser scheduled tasks (interval / cron / once), persisted in IndexedDB
- **Bilingual i18n** — English and Chinese UI, switchable in settings
- **Runtime Detection** — Auto-detects browser capabilities; tools load dynamically based on what's available

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/status` | Display model, tokens, and run status |
| `/model` | Show current model |
| `/runtime` | Show runtime environment and capabilities |
| `/plan <goal>` | Enter or exit plan mode |
| `/next` | Advance to next plan phase |
| `/skill <name>\|list\|off\|status\|delete\|export` | Manage skills (activate, list, lifecycle status, delete, export SKILL.md) |
| `/memory list\|add\|remove\|clear` | Manage persistent memory entries |
| `/sessions list\|search\|recall\|prune` | Browse archived sessions, search across them, prune by age |
| `/export <path>` | Download a file from VirtualFS |
| `/schedule` | Manage scheduled tasks |
| `/auto on\|off` | Toggle autonomous mode |

## Documentation

- [Architecture](docs/architecture.md) — Source structure and tech stack
- [Changelog](docs/changelog.md) — Development history and milestones
- [Design](docs/design.md) — Original design document and feasibility analysis
- [Idea](docs/idea.md) — Project origin

> Chinese versions available: [architecture](docs/architecture.zh-CN.md) · [changelog](docs/changelog.zh-CN.md) · [design](docs/design.zh-CN.md) · [idea](docs/idea.zh-CN.md)

## Design Philosophy

> **Dao-Qi Unity** — Harness AI tools with classical wisdom; think and act in concert, human and machine as one.

- **Simplicity** — The simplest solution that works. The browser *is* the Agent.
- **Adaptability** — Embrace change. Modular architecture evolves continuously.
- **Integrity** — Hold the line on quality. Parameter validation, circuit breakers, duplicate detection.

## Author

**Hongxin Zhang** — [github.com/hongxin](https://github.com/hongxin)

## License

MIT
