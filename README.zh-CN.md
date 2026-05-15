# JetBot

**浏览器端 AI 编程助手 — 零安装、零部署、零配置**

[English](README.md)

JetBot 完全运行在浏览器中。无需后端、无需部署、无需安装——打开网页即可使用。代码在客户端执行，LLM 调用从浏览器直连 API。

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

## 快速开始

```bash
git clone https://github.com/hongxin/JetBot.git
cd JetBot/jetbot
npm install
npm run dev
```

打开 `http://localhost:5173`，选择 LLM 服务商，输入 API Key，即可对话。

**本地 Ollama（完全离线）：**

```bash
ollama serve
ollama pull qwen3.5:27b
# 在 JetBot 中选择 Ollama，无需 API Key
```

**生产构建：**

```bash
npm run build
# 产出 dist/，纯静态文件，可部署到任意静态服务器
```

## 核心特性

### 自主工具调用循环

LLM 自动选择工具、执行操作、分析结果，循环往复直到任务完成。最多 100 轮迭代，3 次连续失败触发熔断，重复错误自动预警。

### 十大内置工具

| 工具 | 权限 | 说明 |
|------|-----|------|
| `read_file` | 安全 | 读取虚拟文件系统中的文件 |
| `list_dir` | 安全 | 列出目录结构 |
| `search_text` | 安全 | 正则搜索文件内容 |
| `write_file` | 风险 | 创建或覆盖文件 |
| `edit_file` | 风险 | 精确查找替换 |
| `http_get` | 风险 | HTTP 请求（自动 CORS 代理回退） |
| `js_eval` | 风险 | 沙箱执行 JavaScript（10 秒超时） |
| `render_html` | 风险 | 渲染 HTML/CSS 到预览面板 |
| `shell_execute` | 危险 | 沙箱 Shell 命令 |
| `export_file` | 安全 | 从虚拟文件系统下载到本地 |

### 18 项内置技能

通过 `/skill <name>` 激活，将领域专家知识注入系统提示词：

`debug` · `code-review` · `architect` · `explain` · `tdd` · `writing` · `refactor` · `visualize` · `decision` · `security` · `perf`

**五行体系：** `zpower` · `z-observe`(观) · `z-design`(谋) · `z-build`(行) · `z-verify`(验) · `z-evolve`(化) · `z-diagram`

### 多服务商支持

| 服务商 | 地址 | 备注 |
|--------|-----|------|
| **OpenAI** | `api.openai.com/v1` | GPT-4o 等 |
| **DeepSeek** | `api.deepseek.com/v1` | 高性价比 |
| **Ollama** | `localhost:11434/v1` | 本地运行，无需密钥 |
| **自定义** | 自行填写 | 任何 OpenAI 兼容端点 |

### 宇宙视图（Cosmos View）

对话化为力引导星空画布——并不止于此。同一张图同时呈现五种节点：

- **user / assistant / tool** — 对话流本身
- **memory**（青绿水滴）— 写入 MemoryStore 的事实/偏好/决策
- **skill**（琥珀六边形）— 由会话自动蒸馏并固化的 SKILL.md

memory 与 skill 节点通过虚线 *derives* 边连回产生它们的 assistant 节点，让"这轮对话留下了什么"一目了然。详情卡片支持八向拖拽缩放、长 markdown 内部滚动。拖拽连接任意两节点触发 LLM 关联分析。

### 权限体系

三级控制：**安全**（自动通过）、**风险**（首次确认后记住）、**危险**（每次确认）。`/auto on` 切换自主模式。

### 更多能力

- **会话持久化** — 每一轮增量写入 IndexedDB；崩溃可恢复；历史会话可检索、可作为长期上下文召回（`/sessions`）
- **记忆库** — 跨会话保留事实/偏好/决策，每次会话开始自动注入系统提示词（`/memory add|list|remove|clear`）
- **技能生命周期** — 蒸馏出的技能带质量评分、使用次数、阶段标记（new / active / stable / stale / deprecated）；设置面板内的 Skills Panel 管理激活、粘贴导入、导出
- **自动蒸馏** — 工具调用密集且成功率良好的对话结束后，agent 自动通过 DistillCard 提议可复用技能，一键保存
- **文件桥接** — 拖拽导入本地文件，`export_file` 触发下载
- **定时调度** — 浏览器内定时任务（interval / cron / once），IndexedDB 持久化
- **双语界面** — 中英文一键切换
- **运行时检测** — 自动探测浏览器能力，按需加载工具

## 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清除对话历史 |
| `/status` | 显示模型与运行状态 |
| `/model` | 显示当前模型 |
| `/runtime` | 显示运行时环境与能力 |
| `/plan <目标>` | 进入/退出计划模式 |
| `/next` | 推进计划阶段 |
| `/skill <name>\|list\|off\|status\|delete\|export` | 技能管理（激活、列表、生命周期状态、删除、导出 SKILL.md） |
| `/memory list\|add\|remove\|clear` | 管理持久化记忆条目 |
| `/sessions list\|search\|recall\|prune` | 浏览归档会话、跨会话搜索、按年龄清理 |
| `/export <路径>` | 从虚拟文件系统下载文件 |
| `/schedule` | 管理定时任务 |
| `/auto on\|off` | 切换自主模式 |

## 文档

- [架构](docs/architecture.zh-CN.md) — 源码结构与技术栈
- [更新日志](docs/changelog.zh-CN.md) — 开发历程与里程碑
- [设计文档](docs/design.zh-CN.md) — 初始设计方案与可行性分析
- [缘起](docs/idea.zh-CN.md) — 项目起源

> English versions: [architecture](docs/architecture.md) · [changelog](docs/changelog.md) · [design](docs/design.md) · [idea](docs/idea.md)

## 设计哲学

> **道器合一** — 以百家智慧驾驭 AI 工具，思行并进，人机协同。

- **简易** — 大道至简，浏览器即 Agent
- **变易** — 拥抱变化，模块化架构持续演进
- **不易** — 坚守质量，参数校验、熔断保护、重复检测

## 作者

**张宏鑫** — [github.com/hongxin](https://github.com/hongxin)

## 许可

MIT
