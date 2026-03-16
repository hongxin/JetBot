# JetBot

**Browser-based AI Coding Assistant — Zero Install. Zero Deploy. Zero Config.**

[Live Demo](https://hongxin.github.io/jetbot/) | [GitHub](https://github.com/hongxin/jetbot)

JetBot 是一个完全运行在浏览器中的 AI 编程助手。无需后端服务器、无需部署、无需安装——打开网页即可使用。所有代码在浏览器端通过 JavaScript 解释执行，LLM 调用直接从浏览器 `fetch()` 发送到 API Provider。

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

## Features

### Agentic Loop

自主决策的工具调用循环。LLM 根据对话上下文自动选择工具、执行操作、分析结果，直到完成任务或给出最终回答。

- 最多 100 轮迭代，3 次连续失败触发熔断
- 重复错误检测：相同工具+相同错误自动警告 LLM 换方案
- 流式输出：实时显示 LLM 思考过程

### 10 Built-in Tools

| Tool | Permission | Description |
|------|-----------|-------------|
| `read_file` | safe | 读取虚拟文件系统中的文件 |
| `list_dir` | safe | 列出目录结构（含文件大小和类型）|
| `search_text` | safe | 正则搜索文件内容 |
| `write_file` | risky | 创建或覆盖文件 |
| `edit_file` | risky | 精确文本替换编辑 |
| `http_get` | risky | HTTP 请求（自动 CORS 代理回退）|
| `js_eval` | risky | 沙箱执行 JavaScript（10s 超时）|
| `render_html` | risky | HTML/CSS 渲染到预览面板 |
| `shell_execute` | dangerous | 沙箱 shell 命令（ls, grep, cat 等）|
| `export_file` | safe | 从 VirtualFS 导出文件到本地（浏览器下载）|

所有工具均有参数校验，缺失必填参数时返回明确错误而非崩溃。

**文件桥接（File Bridge）：** 支持真实文件系统与 VirtualFS 双向传输——拖拽文件到聊天区域即可导入，agent 可调用 `export_file` 触发浏览器下载导出。

### 18 Built-in Skills

通过 `/skill <name>` 激活，将领域专家知识注入系统提示词：

**实用技能：**
`debug` · `code-review` · `architect` · `explain` · `tdd` · `writing` · `refactor` · `visualize` · `decision` · `security` · `perf`

**ZPower 五行体系：**
`zpower` · `z-observe`(观·水) · `z-design`(谋·木) · `z-build`(行·火) · `z-verify`(验·土) · `z-evolve`(化·金) · `z-diagram`

### Multi-Provider LLM

统一使用 OpenAI-compatible API 协议：

| Provider | Base URL | 特点 |
|----------|---------|------|
| **OpenAI** | `api.openai.com/v1` | GPT-4o 等 |
| **DeepSeek** | `api.deepseek.com/v1` | 高性价比 |
| **Ollama** | `localhost:11434/v1` | 本地运行，无需 API Key |
| **Custom** | 自定义 | 任何 OpenAI 兼容端点 |

### Permission System

三级权限控制，在安全与效率之间取得平衡：

|  | `/auto off`（默认） | `/auto on` |
|--|-------------------|-----------|
| **safe** | 自动通过 | 自动通过 |
| **risky** | 首次确认 → 记住 | 自动通过 |
| **dangerous** | 每次确认 | 首次确认 → 记住 |

`/auto on` 后，只有 `shell_execute` 首次需要确认，其余工具零弹窗。

### Scheduler & Heartbeat

浏览器内定时任务调度，支持自主运行模式：

```
/schedule add daily-check interval:30m "检查项目状态并汇报"
/schedule list
/auto on    ← 启用心跳，每 5 分钟自动 check-in
```

- **触发类型：** `interval:5m` · `cron:*/30 * * * *` · `once:2026-03-17T10:00`
- **IndexedDB 持久化：** 页面刷新后任务自动恢复
- **标签页感知：** 切回时补执行错过的任务
- **消息注入排队：** 不打断用户交互

### Bilingual i18n

内置中英双语支持，所有 UI 文案通过 `useT()` Hook 响应式切换，在设置中一键切换语言。

### Runtime Detection

自动探测浏览器能力（IndexedDB、Canvas、Web Worker、Crypto 等 19 项），根据能力动态加载工具。移动端和桌面端自适应。

## Quick Start

```bash
# 克隆仓库
git clone https://github.com/hongxin/jetbot.git
cd JetBot/jetbot

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:5173`，选择 LLM Provider，输入 API Key，即可开始对话。

**使用本地 Ollama（完全离线）：**

```bash
# 确保 Ollama 已运行
ollama serve
ollama pull qwen2.5:3b

# JetBot 中选择 Ollama provider，无需 API Key
```

**生产构建：**

```bash
npm run build
# 产出 dist/ 目录，纯静态文件
# 可部署到 GitHub Pages / Netlify / Vercel / 任何静态服务器
```

## Commands

| Command | Description |
|---------|-------------|
| `/help` | 显示命令帮助 |
| `/clear` | 清除对话历史 |
| `/status` | 显示模型、Token、运行状态 |
| `/model` | 显示当前模型 |
| `/runtime` | 显示运行时环境和能力 |
| `/plan <goal>` | 进入/退出计划模式 |
| `/next` | 推进计划阶段 |
| `/skill <name>\|list\|off` | 激活/列出/关闭技能 |
| `/schedule list\|add\|remove\|pause\|resume` | 管理定时任务 |
| `/auto on\|off` | 切换自主模式 |

## Architecture

```
src/
├── agent/                 # 核心 Agent 引擎
│   ├── Agent.ts           # 主 Agent：命令路由、技能注入、消息注入
│   ├── AgenticLoop.ts     # 工具调用循环（熔断、重复检测）
│   ├── ContextManager.ts  # 对话上下文滑动窗口
│   └── SystemPromptBuilder.ts  # 系统提示词组装
│
├── components/            # React UI 组件
│   ├── ChatPanel.tsx      # 对话面板
│   ├── MessageBubble.tsx  # 消息气泡（Markdown 渲染）
│   ├── ToolCallBlock.tsx  # 工具调用展示（可折叠）
│   ├── InputBar.tsx       # 输入框
│   ├── StatusBar.tsx      # 顶部状态栏
│   ├── WelcomeScreen.tsx  # 首次配置向导
│   ├── SettingsDialog.tsx # 设置面板
│   ├── PermissionDialog.tsx # 权限确认对话框
│   ├── TaskPanel.tsx      # 定时任务面板
│   ├── RenderPreview.tsx  # HTML 预览面板
│   ├── LogPanel.tsx       # 系统日志面板
│   └── shared/            # Modal, Spinner 共享组件
│
├── tools/                 # 工具系统
│   ├── ToolRegistry.ts    # 工具注册 + 能力过滤
│   ├── Permission.ts      # 三级权限管理
│   ├── VirtualFS.ts       # IndexedDB 虚拟文件系统
│   └── builtins/          # 10 个内置工具
│
├── skills/                # 技能系统
│   ├── SkillRegistry.ts   # 技能注册 + 激活管理
│   └── builtins.ts        # 18 个内置技能定义
│
├── llm/                   # LLM 客户端
│   └── OpenAICompatibleClient.ts  # 统一 OpenAI 兼容协议
│
├── scheduler/             # 定时调度
│   ├── Scheduler.ts       # 调度引擎（tick + 心跳 + 补执行）
│   ├── TaskStore.ts       # IndexedDB 任务持久化
│   └── types.ts           # 类型定义
│
├── store/                 # Zustand 状态管理
│   ├── agentStore.ts      # Agent 生命周期
│   ├── chatStore.ts       # 对话消息 + UI 状态
│   └── configStore.ts     # LLM 配置 + 持久化
│
├── env/                   # 运行时检测
│   ├── RuntimeDetector.ts # 19 项能力自动探测
│   └── types.ts           # RuntimeProfile 类型
│
├── lib/                   # 通用库
│   ├── i18n.ts            # 中英双语 + useT() Hook
│   └── logger.ts          # 模块化日志系统
│
└── types/                 # TypeScript 类型
    ├── llm.ts             # LLM 请求/响应类型
    ├── message.ts         # Agent 事件类型
    └── tool.ts            # 工具定义类型
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand 5 |
| Build | Vite 8 + TypeScript 5.9 |
| Storage | IndexedDB (idb) + localStorage |
| Markdown | marked + highlight.js |
| LLM | OpenAI-compatible REST API |

**零后端依赖。** `npm run build` 产出纯静态文件（HTML/JS/CSS），可直接部署或 `file://` 打开。

## Development History

| Commit | Milestone |
|--------|-----------|
| `8dd0dc5` | Initial commit — 核心架构：Agent、AgenticLoop、ToolRegistry、9 工具、React UI |
| `e911ba9` | Ollama 本地 LLM 支持（无需 API Key）|
| `0571246` | 仓库重组 + 全面代码质量改进（共享组件、类型安全、i18n 修复）|
| `7088d54` | 新增 decision / security / perf 技能 |
| `d79391e` | ZPower 五行技能体系（7 个技能）|
| `bf9c883` | `/auto on` 权限策略联动，减少交互疲劳 |
| `0c3358b` | 工具参数校验 + AgenticLoop 重复失败检测 |
| `381a87b` | 修复 /auto 模式权限同步（根因：permission level 未注入）|

## Design Philosophy

> **道器合一** — 以百家智慧驾驭 AI 工具，思行并进，人机协同。

- **简易**：能简则简，大道至简。6000 行代码实现完整 AI Agent
- **变易**：拥抱变化，持续演进。模块化架构，每个模块单一职责
- **不易**：坚守核心，质量为本。参数校验、熔断保护、重复检测

## Author

**Hongxin Zhang** — [hongxin.zhang@gmail.com](mailto:hongxin.zhang@gmail.com) | [github.com/hongxin](https://github.com/hongxin)

## License

MIT
