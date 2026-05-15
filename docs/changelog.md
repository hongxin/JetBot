# Changelog

[中文版](changelog.zh-CN.md)

Development history and milestones.

| Commit | Milestone |
|--------|-----------|
| `8dd0dc5` | **Initial commit** — Core architecture: Agent, AgenticLoop, ToolRegistry, 9 tools, React UI |
| `e911ba9` | Ollama local LLM support (no API key required) |
| `0571246` | Repository restructure + code quality improvements (shared components, type safety, i18n fixes) |
| `7088d54` | New skills: decision / security / perf |
| `d79391e` | ZPower skill system (7 skills based on Five Elements philosophy) |
| `bf9c883` | `/auto on` permission policy integration |
| `0c3358b` | Tool parameter validation + AgenticLoop duplicate failure detection |
| `381a87b` | Fix /auto mode permission sync (root cause: permission level not injected) |
| `f932ea5` | jetbot.md soul file (hybrid loading: compiled default + VirtualFS editable) |
| `8cce74b` | File Bridge: VirtualFS ↔ real filesystem bidirectional transfer (drag import + download export) |
| `bc7e340` | `/export` command for quick VirtualFS file download |
| `f75bc02` | Rewrite jetbot.md with deep self-awareness of environment and constraints |
| `8d3841a` | 2 showcase demos: SaaS Dashboard + Pomodoro Timer |
| `ac741c2` | Fix layout: DropZone no longer breaks chat/preview split |
| `09d5479` | **Cosmos View** — Force-directed canvas, cross-turn edge linking, break-chain toggle |
| `c340dc7` | Permission dialog polish, default Ollama model update, LAN dev server |
| `cda1898` | Documentation restructure: streamlined README + separated docs/ folder |
| `f3ff305` | GitHub Pages deployment workflow (CI build + publish to gh-pages) |
| `1053fde` | Render markdown inside Cosmos node detail cards |
| `ef307ce` | ZhipuAI (GLM) provider support with locale-aware label |
| `c4766d9` | **IndexedDB persistence layer** — unified `lib/db.ts` wrapper with versioned store creation |
| `f737fb6` | **SessionStore / SessionIndex / MemoryStore / SkillDistiller** — Agent gains long-term memory |
| `243c2b3` | Skill lifecycle: quality score, use count, stage tracking, IndexedDB persistence |
| `86721aa` | DistillCard UI + SystemPromptBuilder memory/recall injection sections |
| `4407664` | Agent integrates SessionStore + MemoryStore + SkillDistiller end-to-end |
| `b9dd8a7` | **Skills Panel** — lifecycle visualization, paste import, `/skill status` |
| `5a03567` | `/skill export`, `/clear` archives session, integration fixup |
| `e0659ec` | Robust IndexedDB init (retry loop, version bump, store-existence checks) |
| `86be80d` | Stream crash safety net — response.body null guard |
| `6e484ee` | Auto-default CORS proxyUrl to current origin |
| `05970da` | Prevent context poisoning from empty assistant messages |
| `fdd3caa` | **Cosmos UX** — eight-handle resizable NodeCard, per-edge uniform particles |
| `1a01c24` | **Cosmos fusion** — memory & skill node kinds, `derives` edges, agent-state vista |
| `425ec5d` | Dev `/proxy` middleware mirrors Cloudflare Worker so dev LLM calls stop 404'ing |
