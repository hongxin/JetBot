# Architecture

[中文版](architecture.zh-CN.md)

## Source Structure

```
jetbot/src/
├── agent/                 # Core Agent Engine
│   ├── Agent.ts           # Command routing, skill injection, message injection, distill orchestration
│   ├── AgenticLoop.ts     # Tool call loop (circuit breaker, repeat detection, stream safety)
│   ├── ContextManager.ts  # Sliding window for conversation context; turnsRef() for persistence
│   ├── SystemPromptBuilder.ts  # System prompt assembly + memory/recall sections
│   ├── SessionStore.ts    # IndexedDB session persistence + crash recovery + archive
│   ├── SessionIndex.ts    # Cross-session search & recall
│   ├── MemoryStore.ts     # Persistent facts/preferences/decisions; emits memory:added/removed events
│   ├── SkillDistiller.ts  # Heuristics + LLM-driven distillation of reusable skills
│   └── jetbot.md          # Soul file (compiled-default + VirtualFS editable)
│
├── plan/                  # Plan Mode
│   ├── PlanMode.ts        # Multi-phase plan state machine
│   └── prompts.ts         # Phase prompts
│
├── components/            # React UI
│   ├── cosmos/            # Cosmos View (force-directed canvas)
│   │   ├── CosmosCanvas.ts    # 2D rendering + force sim; hexagon/droplet shapes for skill/memory
│   │   ├── CosmosView.tsx     # React wrapper + interaction + resizable NodeCard
│   │   └── types.ts           # 5 node kinds (user/assistant/tool/memory/skill), 4 edge types
│   ├── ChatPanel.tsx      # Chat conversation panel
│   ├── MessageBubble.tsx  # Message bubble (Markdown rendering) + DistillCard slot
│   ├── DistillCard.tsx    # Proposed-skill card with save/discard actions
│   ├── SkillsPanel.tsx    # Skill lifecycle management (import/export/activate/delete)
│   ├── ToolCallBlock.tsx  # Tool call display (collapsible)
│   ├── InputBar.tsx       # Input bar + break-chain toggle
│   ├── StatusBar.tsx      # Top status bar + view toggle
│   ├── WelcomeScreen.tsx  # First-time configuration wizard
│   ├── SettingsDialog.tsx # Settings panel (hosts SkillsPanel)
│   ├── PermissionDialog.tsx # Permission confirmation dialog
│   ├── TaskPanel.tsx      # Scheduled tasks panel
│   ├── RenderPreview.tsx  # HTML preview panel
│   ├── LogPanel.tsx       # System log panel
│   ├── FileBridge.tsx     # File bridge (import/export/drag-drop)
│   └── shared/            # Modal, Spinner shared components
│
├── tools/                 # Tool System
│   ├── ToolRegistry.ts    # Tool registration + capability filtering
│   ├── Permission.ts      # Three-tier permission management
│   ├── VirtualFS.ts       # IndexedDB virtual file system
│   └── builtins/          # 10+ built-in tools (incl. getTime, getSysinfo)
│
├── skills/                # Skill System
│   ├── SkillRegistry.ts   # Registration, activation, lifecycle, IndexedDB persistence
│   ├── types.ts           # Skill type with lifecycle fields
│   └── builtins.ts        # 18 built-in skill definitions
│
├── llm/                   # LLM Client
│   └── OpenAICompatibleClient.ts  # Unified OpenAI-compatible protocol
│
├── scheduler/             # Scheduled Tasks
│   ├── Scheduler.ts       # Scheduler engine (tick + heartbeat + catch-up)
│   ├── TaskStore.ts       # IndexedDB task persistence
│   └── types.ts
│
├── store/                 # Zustand State Management
│   ├── agentStore.ts      # Agent lifecycle + memory/skill event bridge → Cosmos
│   ├── chatStore.ts       # Chat messages + UI state + distillProposal resolution
│   ├── configStore.ts     # LLM config + persistence + proxyUrl auto-default
│   └── cosmosStore.ts     # Cosmos state (incl. addMemoryNode/addSkillNode/archiveMemoryNode)
│
├── env/                   # Runtime Detection
│   ├── RuntimeDetector.ts # Browser capability auto-detection
│   └── types.ts
│
├── lib/                   # Utilities
│   ├── db.ts              # Shared IndexedDB wrapper (sessions/memory/skills/tasks)
│   ├── cors.ts            # CORS proxy URL resolution
│   ├── i18n.ts            # Bilingual i18n + useT() hook
│   ├── logger.ts          # Modular logging system
│   ├── markdown.ts        # Marked configuration
│   └── storage.ts         # localStorage helpers
│
└── types/                 # TypeScript Types
    ├── llm.ts             # LLM request/response types
    ├── message.ts         # Agent event types
    └── tool.ts            # Tool definition types
```

**Dev-only piece** (not in `src/`):

- `jetbot/vite.config.ts` — dev plugin `dev-cors-proxy` mirrors the production Cloudflare Worker so `/proxy?url=...` works in `npm run dev` too.
- `jetbot/worker/cors-proxy.ts` — production Cloudflare Worker for the same path.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand 5 |
| Build | Vite 8 + TypeScript 5.9 |
| Storage | IndexedDB (idb) + localStorage |
| Markdown | marked + highlight.js |
| LLM | OpenAI-compatible REST API |

**Zero backend dependency.** `npm run build` produces pure static files (HTML/JS/CSS) deployable anywhere.

## Key Design Decisions

### Browser-Only Architecture

All code runs in the browser. LLM calls go directly from `fetch()` to API providers. File operations use an IndexedDB-backed virtual file system. Shell commands run in a sandboxed JavaScript interpreter.

### Agentic Loop

Inspired by TrueConsole's Rust implementation, reimplemented in TypeScript. The loop supports up to 100 iterations with circuit breaker protection (3 consecutive failures) and duplicate error detection.

### Force-Directed Cosmos View

Conversation visualization using a custom 2D force simulation on HTML Canvas. Five node kinds — user, assistant, tool (conversation flow) and memory, skill (knowledge sediment). Edge types: `auto` within a turn, `cross-turn` across turns (weaker spring), `manual` from drag-connect, and `derives` from assistant to memory/skill (single-direction particle flow indicating causality).

The Cosmos store is **derived view, not source of truth** — memory and skill data live in MemoryStore and SkillRegistry (IndexedDB); Cosmos subscribes via DOM CustomEvents (`jetbot:memory:added/removed`, `jetbot:skill:distilled-accepted`) and renders only this-session events. Node detail cards are resizable (8 handles), with kind-aware bodies that render markdown for assistant/memory/skill and raw params/result for tools.

### Persistence Architecture

A single `lib/db.ts` wrapper manages IndexedDB stores across four concerns:

| Store | Owner | Content |
|------|-------|---------|
| `session_meta` / `session_turns` | SessionStore | Current + archived sessions |
| `memory` | MemoryStore | Persistent facts/preferences/decisions |
| `skills` | SkillRegistry | Distilled and built-in skills with lifecycle |
| `tasks` | TaskStore | Scheduled tasks |

Robust init: retry loop checks all stores exist, version-bumps trigger `onupgradeneeded` to recreate any missing store.

### Auto-Distillation

After a tool-heavy turn (≥5 calls, ≥50% success rate, non-retrieval, non-ephemeral query), the Agent calls SkillDistiller which prompts the LLM to produce a SKILL.md candidate. After dedup against existing skills, a DistillCard is rendered in the chat. On save, the skill is added to SkillRegistry and (via DOM event bridge) a corresponding skill node appears in Cosmos linked to the originating assistant turn.

### Three-Tier Permission System

Tools are classified as safe, risky, or dangerous. Safe tools auto-approve. Risky tools prompt once then remember the decision. Dangerous tools prompt every time. `/auto on` relaxes these constraints for power users.
