# 架构

[English](architecture.md)

## 源码结构

```
jetbot/src/
├── agent/                 # Agent 核心引擎
│   ├── Agent.ts           # 命令路由、技能注入、消息注入、蒸馏编排
│   ├── AgenticLoop.ts     # 工具调用循环（熔断器、重复检测、流式兜底）
│   ├── ContextManager.ts  # 对话上下文滑动窗口；提供 turnsRef() 供持久化使用
│   ├── SystemPromptBuilder.ts  # 系统提示词组装 + memory/recall 段
│   ├── SessionStore.ts    # IndexedDB 会话持久化 + 崩溃恢复 + 归档
│   ├── SessionIndex.ts    # 跨会话搜索与召回
│   ├── MemoryStore.ts     # 持久化事实/偏好/决策；发射 memory:added/removed 事件
│   ├── SkillDistiller.ts  # 启发式 + LLM 驱动的可复用技能蒸馏
│   └── jetbot.md          # 灵魂文件（编译默认 + VirtualFS 可编辑）
│
├── plan/                  # 计划模式
│   ├── PlanMode.ts        # 多阶段计划状态机
│   └── prompts.ts         # 阶段提示词
│
├── components/            # React 界面
│   ├── cosmos/            # 宇宙视图（力引导画布）
│   │   ├── CosmosCanvas.ts    # 2D 渲染 + 力模拟；skill 六边形、memory 水滴
│   │   ├── CosmosView.tsx     # React 封装 + 交互 + 可缩放 NodeCard
│   │   └── types.ts           # 5 种节点（user/assistant/tool/memory/skill）、4 种边
│   ├── ChatPanel.tsx      # 对话面板
│   ├── MessageBubble.tsx  # 消息气泡（Markdown 渲染）+ DistillCard 插槽
│   ├── DistillCard.tsx    # 提议的技能卡片，带保存/舍弃操作
│   ├── SkillsPanel.tsx    # 技能生命周期管理（导入/导出/激活/删除）
│   ├── ToolCallBlock.tsx  # 工具调用展示（可折叠）
│   ├── InputBar.tsx       # 输入栏 + 断链切换
│   ├── StatusBar.tsx      # 顶部状态栏 + 视图切换
│   ├── WelcomeScreen.tsx  # 首次配置向导
│   ├── SettingsDialog.tsx # 设置面板（承载 SkillsPanel）
│   ├── PermissionDialog.tsx # 权限确认对话框
│   ├── TaskPanel.tsx      # 定时任务面板
│   ├── RenderPreview.tsx  # HTML 预览面板
│   ├── LogPanel.tsx       # 系统日志面板
│   ├── FileBridge.tsx     # 文件桥接（导入/导出/拖拽）
│   └── shared/            # Modal、Spinner 共享组件
│
├── tools/                 # 工具系统
│   ├── ToolRegistry.ts    # 工具注册 + 能力过滤
│   ├── Permission.ts      # 三级权限管理
│   ├── VirtualFS.ts       # IndexedDB 虚拟文件系统
│   └── builtins/          # 10+ 内置工具（含 getTime、getSysinfo）
│
├── skills/                # 技能系统
│   ├── SkillRegistry.ts   # 注册、激活、生命周期、IndexedDB 持久化
│   ├── types.ts           # 带生命周期字段的 Skill 类型
│   └── builtins.ts        # 18 个内置技能定义
│
├── llm/                   # LLM 客户端
│   └── OpenAICompatibleClient.ts  # 统一 OpenAI 兼容协议
│
├── scheduler/             # 定时调度
│   ├── Scheduler.ts       # 调度引擎（心跳 + 补执行）
│   ├── TaskStore.ts       # IndexedDB 任务持久化
│   └── types.ts
│
├── store/                 # Zustand 状态管理
│   ├── agentStore.ts      # Agent 生命周期 + memory/skill 事件桥 → Cosmos
│   ├── chatStore.ts       # 对话消息 + UI 状态 + distillProposal 解析
│   ├── configStore.ts     # LLM 配置 + 持久化 + proxyUrl 自动默认
│   └── cosmosStore.ts     # 宇宙视图状态（含 addMemoryNode/addSkillNode/archiveMemoryNode）
│
├── env/                   # 运行时检测
│   ├── RuntimeDetector.ts # 浏览器能力自动探测
│   └── types.ts
│
├── lib/                   # 通用库
│   ├── db.ts              # 共享 IndexedDB 封装（会话/记忆/技能/任务）
│   ├── cors.ts            # CORS 代理 URL 解析
│   ├── i18n.ts            # 中英双语 + useT() Hook
│   ├── logger.ts          # 模块化日志系统
│   ├── markdown.ts        # Marked 配置
│   └── storage.ts         # localStorage 辅助
│
└── types/                 # TypeScript 类型
    ├── llm.ts             # LLM 请求/响应类型
    ├── message.ts         # Agent 事件类型
    └── tool.ts            # 工具定义类型
```

**Dev 期独有**（不在 `src/`）：

- `jetbot/vite.config.ts` — dev 插件 `dev-cors-proxy` 镜像生产 Cloudflare Worker，让 `/proxy?url=...` 在 `npm run dev` 也能用。
- `jetbot/worker/cors-proxy.ts` — 生产 Cloudflare Worker，处理同一路径。

## 技术栈

| 层级 | 技术 |
|------|-----|
| 界面 | React 19 + Tailwind CSS 4 |
| 状态 | Zustand 5 |
| 构建 | Vite 8 + TypeScript 5.9 |
| 存储 | IndexedDB (idb) + localStorage |
| Markdown | marked + highlight.js |
| LLM | OpenAI 兼容 REST API |

**零后端依赖。** `npm run build` 产出纯静态文件，可部署于任何位置。

## 关键设计决策

### 纯浏览器架构

所有代码在浏览器中运行。LLM 调用通过 `fetch()` 直连 API 服务商。文件操作基于 IndexedDB 虚拟文件系统。Shell 命令在沙箱 JavaScript 解释器中执行。

### 自主工具循环

受 TrueConsole（Rust 实现）启发，以 TypeScript 重新实现。支持最多 100 轮迭代，内置熔断保护（连续 3 次失败）和重复错误检测。

### 力引导宇宙视图

基于 HTML Canvas 的自定义 2D 力模拟。五种节点——user、assistant、tool（对话流）和 memory、skill（知识沉淀）。四种边：`auto`（同轮）、`cross-turn`（跨轮，弱弹簧）、`manual`（拖拽连线）、`derives`（assistant 到 memory/skill，单向粒子流，暗示因果）。

Cosmos store 是**派生视图，非真理之源**——memory 和 skill 的数据存于 MemoryStore 与 SkillRegistry（IndexedDB）；Cosmos 通过 DOM CustomEvent（`jetbot:memory:added/removed`、`jetbot:skill:distilled-accepted`）订阅，只渲染本会话的事件。节点详情卡片八向可缩放，按 kind 渲染不同内容：assistant/memory/skill 走 markdown，tool 走原始 params/result。

### 持久化架构

`lib/db.ts` 统一管理 IndexedDB 四类 store：

| Store | 归属 | 内容 |
|------|------|------|
| `session_meta` / `session_turns` | SessionStore | 当前会话 + 归档 |
| `memory` | MemoryStore | 持久化事实/偏好/决策 |
| `skills` | SkillRegistry | 蒸馏与内置技能（含生命周期） |
| `tasks` | TaskStore | 定时任务 |

初始化加固：重试循环检查所有 store 存在，版本递增触发 `onupgradeneeded` 重建缺失 store。

### 自动蒸馏

工具调用密集的对话结束后（≥5 次调用、成功率 ≥50%、非检索类、非时效话题），Agent 触发 SkillDistiller 调 LLM 生成 SKILL.md 候选。与现有技能查重后，DistillCard 在 chat 出现。保存时技能写入 SkillRegistry，并通过 DOM 事件桥让 Cosmos 中出现一个 skill 节点连回起源 assistant 节点。

### 三级权限体系

工具分为安全、风险、危险三级。安全工具自动通过；风险工具首次确认后记住；危险工具每次确认。`/auto on` 为高级用户放宽限制。
