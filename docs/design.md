# JetBot 项目设计方案

> 设计时间：2026-03-16 15:45
> 设计者：小哲
> 目标：浏览器端 AI Agent，零难度使用

---

## 一、项目定位

### 核心理念

```
"零门槛、零部署、零配置"
→ 打开浏览器即用
→ 微信中也能运行
→ 一键分享传播
```

### 目标用户

| 用户类型 | 场景 | 价值 |
|----------|------|------|
| **个人用户** | 日常 AI 助手 | 无需安装，打开即用 |
| **开发者** | 快速原型验证 | 参考 TrueConsole 逻辑 |
| **企业用户** | 内部工具分享 | 分享链接即用 |
| **微信用户** | 公众号/小程序 | 微信生态无缝集成 |

---

## 二、可行性分析

### ✅ 可行点

#### 1. TypeScript 生态成熟

```typescript
// TrueConsole 的 Rust 逻辑可以完全用 TS 实现
interface Agent {
  handle(input: string): Promise<string>;
  executeTool(name: string, params: any): Promise<any>;
}

// 成熟的库支持
- OpenAI SDK (官方支持浏览器)
- Anthropic SDK (支持浏览器)
- 事件驱动架构 (RxJS)
- 状态管理 (Zustand)
```

#### 2. 浏览器能力足够

| 能力 | API | 支持度 |
|------|-----|--------|
| **本地存储** | IndexedDB / OPFS | ✅ 所有现代浏览器 |
| **文件操作** | File System Access API | ✅ Chrome/Edge |
| **HTTP 请求** | fetch + CORS | ✅ 需代理处理 |
| **后台运行** | Service Worker | ✅ Chrome/Edge |
| **本地推理** | WebLLM / Transformers.js | ✅ Chrome/Edge |
| **加密** | Web Crypto API | ✅ 所有浏览器 |

#### 3. 微信浏览器兼容性

```
微信浏览器支持：
✅ ES6+ JavaScript
✅ IndexedDB
✅ Service Worker（有限）
✅ Web Crypto
✅ fetch API

微信浏览器限制：
⚠️ File System Access API（不支持）
⚠️ WebGPU（不支持）
⚠️ WebRTC P2P（限制）
```

**结论：基础功能可行，高级功能降级处理**

#### 4. 参考项目验证

| 项目 | Stars | 证明 |
|------|-------|------|
| **WebLLM** | 17.6k⭐ | 浏览器内 LLM 推理可行 |
| **Transformers.js** | 13k+⭐ | Transformers 浏览器运行可行 |
| **Cherry Studio** | 41.6k⭐ | 浏览器端 AI Agent 可行 |
| **Browser Agent** | 4k⭐ | 浏览器自动化 Agent 可行 |

---

### ⚠️ 挑战与解决方案

#### 挑战 1：CORS 限制

**问题：** 浏览器不能直接调用 LLM API（跨域）

**解决方案：**

```typescript
// 方案 A：CORS 代理（开发阶段）
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com';
const response = await fetch(`${CORS_PROXY}/${API_URL}`);

// 方案 B：Cloudflare Workers（生产环境）
// worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const apiUrl = url.searchParams.get('url');
    return fetch(apiUrl, {
      headers: request.headers,
    });
  }
}

// 方案 C：用户自建代理（企业部署）
const PROXY_URL = 'https://your-company.com/api-proxy';
```

#### 挑战 2：文件系统访问

**问题：** 浏览器不能直接访问本地文件

**解决方案：**

```typescript
// 方案 A：IndexedDB 虚拟文件系统
class VirtualFS {
  async readFile(path: string): Promise<string> {
    const db = await this.openDB();
    return db.get('files', path);
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    const db = await this.openDB();
    await db.put('files', content, path);
  }
}

// 方案 B：File System Access API（Chrome/Edge）
async function openLocalDir() {
  const dirHandle = await window.showDirectoryPicker();
  const file = await dirHandle.getFileHandle('README.md');
  const content = await file.getFile();
  return content.text();
}

// 方案 C：用户上传文件
<input type="file" onChange={handleFileUpload} />
```

#### 挑战 3：Shell 命令执行

**问题：** 浏览器不能执行 shell 命令

**解决方案：**

```typescript
// 方案 A：内置命令解释器（安全）
const BUILTIN_COMMANDS = {
  'ls': async (args) => { /* 虚拟文件系统 ls */ },
  'cat': async (args) => { /* 读取虚拟文件 */ },
  'grep': async (args) => { /* 搜索虚拟文件 */ },
};

// 方案 B：WebAssembly 沙箱
import loadWasm from './shell.wasm';
const wasmShell = await loadWasm();
wasmShell.execute('ls -la');

// 方案 C：远程执行（需要服务器）
const response = await fetch('/api/shell', {
  method: 'POST',
  body: JSON.stringify({ command: 'ls -la' })
});
```

#### 挑战 4：微信浏览器限制

**问题：** 微信不支持某些现代 API

**解决方案：**

```typescript
// 特性检测 + 降级
class FeatureDetector {
  hasFileSystemAccess(): boolean {
    return 'showDirectoryPicker' in window;
  }
  
  hasWebGPU(): boolean {
    return 'gpu' in navigator;
  }
  
  hasServiceWorker(): boolean {
    return 'serviceWorker' in navigator;
  }
}

// 根据环境自动降级
if (!detector.hasFileSystemAccess()) {
  // 使用 IndexedDB 虚拟文件系统
  fs = new VirtualFS();
} else {
  // 使用真实文件系统
  fs = new NativeFS();
}
```

---

## 三、架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    JetBot (Browser)                      │
├─────────────────────────────────────────────────────────┤
│  UI Layer (React/Vue/Svelte)                            │
│  ├─ Chat Interface                                      │
│  ├─ Tool Panel                                          │
│  └─ Settings Panel                                      │
├─────────────────────────────────────────────────────────┤
│  Agent Layer (参考 TrueConsole)                         │
│  ├─ Plan Mode (观→谋→行→验)                             │
│  ├─ Tool Executor (Agentic Loop)                        │
│  ├─ Context Manager (20轮滑动窗口)                       │
│  └─ Skill Registry (三阶段加载)                          │
├─────────────────────────────────────────────────────────┤
│  Tool Layer                                             │
│  ├─ VirtualFS (IndexedDB)                               │
│  ├─ WebFetch (CORS Proxy)                               │
│  ├─ WebSearch (Brave API)                               │
│  └─ Calculator (内置)                                   │
├─────────────────────────────────────────────────────────┤
│  LLM Layer                                              │
│  ├─ Remote LLM (OpenAI/Anthropic/DeepSeek via Proxy)    │
│  └─ Local LLM (WebLLM - 可选)                           │
├─────────────────────────────────────────────────────────┤
│  Storage Layer                                          │
│  ├─ IndexedDB (持久化)                                  │
│  ├─ LocalStorage (配置)                                 │
│  └─ OPFS (大文件 - 可选)                                │
└─────────────────────────────────────────────────────────┘
```

### 核心模块设计

#### 1. Agent 核心（参考 TrueConsole）

```typescript
// src/agent/Agent.ts

export class JetBotAgent {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private skills: SkillRegistry;
  private context: ContextManager;
  private planMode: PlanMode | null = null;
  
  // 熔断器（参考 TrueConsole）
  private circuitBreaker = {
    maxIterations: 25,
    maxFailures: 3,
    failures: 0,
  };
  
  async handle(input: string): Promise<string> {
    // 1. 检测命令
    if (input.startsWith('/')) {
      return this.handleCommand(input);
    }
    
    // 2. Plan 模式
    if (this.planMode) {
      return this.handlePlanMode(input);
    }
    
    // 3. 正常对话（Agentic Loop）
    return this.executeWithTools(input);
  }
  
  private async executeWithTools(input: string): Promise<string> {
    let iterations = 0;
    
    while (iterations < this.circuitBreaker.maxIterations) {
      // 调用 LLM
      const response = await this.llm.complete({
        messages: this.context.toMessages(),
        tools: this.tools.schemas(),
      });
      
      // 检查是否需要工具调用
      if (response.toolCalls.length === 0) {
        return response.content;
      }
      
      // 执行工具
      for (const toolCall of response.toolCalls) {
        try {
          const result = await this.tools.execute(
            toolCall.name,
            toolCall.params
          );
          this.context.addToolResult(toolCall.id, result);
        } catch (error) {
          this.circuitBreaker.failures++;
          if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
            throw new Error('熔断器触发：连续失败过多');
          }
        }
      }
      
      iterations++;
    }
    
    throw new Error('达到最大迭代次数');
  }
}
```

#### 2. 虚拟文件系统

```typescript
// src/tools/VirtualFS.ts

import { openDB, IDBPDatabase } from 'idb';

interface FileEntry {
  path: string;
  content: string;
  type: 'file' | 'directory';
  createdAt: number;
  updatedAt: number;
}

export class VirtualFS {
  private db: IDBPDatabase | null = null;
  
  async init(): Promise<void> {
    this.db = await openDB('jetbot-fs', 1, {
      upgrade(db) {
        const store = db.createObjectStore('files', { keyPath: 'path' });
        store.createIndex('type', 'type');
      },
    });
    
    // 初始化基础目录
    await this.mkdir('/workspace');
    await this.mkdir('/workspace/src');
    await this.mkdir('/workspace/docs');
  }
  
  async readFile(path: string): Promise<string> {
    const entry = await this.db!.get('files', path);
    if (!entry) throw new Error(`文件不存在: ${path}`);
    return entry.content;
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    const existing = await this.db!.get('files', path);
    const entry: FileEntry = {
      path,
      content,
      type: 'file',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await this.db!.put('files', entry);
  }
  
  async listDir(path: string): Promise<FileEntry[]> {
    const all = await this.db!.getAll('files');
    return all.filter(f => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === path || (path === '/' && f.path.count('/') === 1);
    });
  }
  
  async mkdir(path: string): Promise<void> {
    const entry: FileEntry = {
      path,
      content: '',
      type: 'directory',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.db!.put('files', entry);
  }
  
  async search(pattern: RegExp): Promise<Array<{path: string, matches: string[]}>> {
    const all = await this.db!.getAll('files');
    const results = [];
    
    for (const file of all) {
      if (file.type !== 'file') continue;
      const matches = file.content.match(pattern);
      if (matches) {
        results.push({ path: file.path, matches });
      }
    }
    
    return results;
  }
}
```

#### 3. WebFetch 工具（CORS 代理）

```typescript
// src/tools/WebFetch.ts

export class WebFetchTool implements Tool {
  name = 'http_get';
  description = '获取网页内容';
  
  private proxyUrl = 'https://api.allorigins.win/raw?url=';
  
  async execute(params: { url: string }): Promise<string> {
    const url = encodeURIComponent(params.url);
    const response = await fetch(`${this.proxyUrl}${url}`);
    const html = await response.text();
    
    // 提取正文（使用 Readability）
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc);
    const article = reader.parse();
    
    return article?.textContent || html;
  }
}
```

#### 4. Skill 系统（参考 TrueConsole）

```typescript
// src/skills/SkillRegistry.ts

export interface Skill {
  name: string;
  description: string;
  instructions: string;  // 注入到 system prompt
  tools?: Tool[];        // Skill 专属工具
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private active: string | null = null;
  
  // 阶段 1：名称和描述始终在 context（~100 tokens/skill）
  getMenuText(): string {
    if (this.skills.size === 0) return '';
    
    let text = '<available_skills>\n';
    for (const [name, skill] of this.skills) {
      text += `- ${name}: ${skill.description}\n`;
    }
    text += '</available_skills>';
    return text;
  }
  
  // 阶段 2：激活时加载完整指令
  getActiveInstructions(): string | null {
    if (!this.active) return null;
    const skill = this.skills.get(this.active);
    return skill?.instructions || null;
  }
  
  activate(name: string): string {
    if (!this.skills.has(name)) {
      return `Skill "${name}" 不存在`;
    }
    this.active = name;
    return `已激活 Skill: ${name}`;
  }
  
  deactivate(): string {
    this.active = null;
    return '已停用 Skill';
  }
}

// 内置 Skills
const CODE_REVIEW_SKILL: Skill = {
  name: 'code-review',
  description: '代码审查专家',
  instructions: `
你是代码审查专家。审查代码时关注：
1. 代码质量（可读性、可维护性）
2. 潜在 Bug
3. 性能问题
4. 安全隐患
5. 最佳实践

输出格式：
- 问题列表（按严重程度排序）
- 改进建议
- 评分（1-10）
`,
};

const DEBUGGING_SKILL: Skill = {
  name: 'debugging',
  description: '调试专家',
  instructions: `
你是调试专家。帮助用户：
1. 分析错误信息
2. 定位问题根因
3. 提供修复方案
4. 预防类似问题

调试方法论：
1. 复现问题
2. 缩小范围
3. 假设验证
4. 修复验证
`,
};
```

#### 5. LLM 客户端（多 Provider）

```typescript
// src/llm/LLMClient.ts

export interface LLMClient {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  model(): string;
}

export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private proxyUrl?: string;
  private modelId: string;
  
  constructor(config: { apiKey: string; model?: string; proxyUrl?: string }) {
    this.apiKey = config.apiKey;
    this.modelId = config.model || 'gpt-4o';
    this.proxyUrl = config.proxyUrl;
  }
  
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = this.proxyUrl 
      ? `${this.proxyUrl}?url=${encodeURIComponent('https://api.openai.com/v1/chat/completions')}`
      : 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: req.messages,
        tools: req.tools,
        tool_choice: 'auto',
      }),
    });
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  model(): string {
    return this.modelId;
  }
}

// DeepSeek 客户端
export class DeepSeekClient implements LLMClient {
  // 类似实现...
}

// WebLLM 本地客户端（可选）
export class WebLLMClient implements LLMClient {
  private engine: any;
  
  async init(model: string): Promise<void> {
    const { CreateMLCEngine } = await import('@anthropic-ai/web-llm');
    this.engine = await CreateMLCEngine(model);
  }
  
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.engine.chat.completions.create({
      messages: req.messages,
    });
    return this.parseResponse(response);
  }
}
```

---

## 四、UI 设计

### 界面布局

```
┌─────────────────────────────────────────────────────────┐
│  🔥 JetBot                          [Settings] [Share]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User: 帮我分析这段代码的性能瓶颈                        │
│                                                         │
│  JetBot: [Plan 模式] 观察阶段                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔍 正在读取文件...                               │   │
│  │ 📄 /workspace/src/app.ts (234 lines)            │   │
│  │ 📊 分析中...                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  找到 3 个性能问题：                                    │
│  1. 第 45 行：O(n²) 循环                               │
│  2. 第 89 行：重复计算                                  │
│  3. 第 112 行：不必要的内存分配                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [📁 Files] [🛠 Tools] [📚 Skills] [📊 Status]          │
├─────────────────────────────────────────────────────────┤
│  > _                                                    │
│  [Send] [Auto Mode: ON] [Model: gpt-4o ▼]               │
└─────────────────────────────────────────────────────────┘
```

### 响应式设计

```typescript
// 移动端适配
const useStyles = makeStyles((theme) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    [theme.breakpoints.up('md')]: {
      flexDirection: 'row',
    },
  },
  sidebar: {
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: 300,
    },
  },
}));
```

---

## 五、技术栈选择

### 推荐方案

```yaml
前端框架: React 18 + TypeScript
  - 原因: 生态成熟，组件库丰富
  
状态管理: Zustand
  - 原因: 轻量，易理解，适合 Agent 状态
  
UI 组件: Shadcn/ui + TailwindCSS
  - 原因: 现代化，可定制，小体积
  
数据存储: IndexedDB (via idb)
  - 原因: 浏览器原生，容量大，异步
  
LLM 客户端: 
  - OpenAI SDK (官方)
  - Anthropic SDK (官方)
  - WebLLM (可选本地推理)
  
构建工具: Vite
  - 原因: 快速，HMR，ESM 原生
  
部署: 
  - Cloudflare Pages (免费)
  - Vercel (免费)
  - GitHub Pages (免费)
```

### 依赖清单

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "idb": "^8.0.0",
    "@mozilla/readability": "^0.5.0",
    "marked": "^12.0.0",
    "highlight.js": "^11.9.0"
  },
  "devDependencies": {
    "vite": "^5.1.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.2.0"
  }
}
```

**总依赖数：~15 个**（远小于 NanoClaw 的 70+）

---

## 六、部署方案

### 方案 A：静态托管（推荐）

```bash
# 构建
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy dist

# 或部署到 Vercel
npx vercel --prod

# 或部署到 GitHub Pages
npm run deploy
```

**优势：**
- ✅ 完全免费
- ✅ 全球 CDN
- ✅ 自动 HTTPS
- ✅ 自定义域名

### 方案 B：Docker 容器

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
```

```bash
docker build -t jetbot .
docker run -p 8080:80 jetbot
```

### 方案 C：微信小程序（扩展）

```typescript
// 将核心逻辑打包为小程序可用
import { JetBotCore } from 'jetbot-core';

Page({
  onLoad() {
    this.agent = new JetBotCore({
      storage: wx.storage,
      http: wx.request,
    });
  },
  
  async handleInput(e) {
    const response = await this.agent.handle(e.detail.value);
    this.setData({ response });
  }
});
```

---

## 七、与竞品对比

| 维度 | JetBot | ZeroClaw | NanoClaw | TrueConsole |
|------|--------|----------|----------|-------------|
| **语言** | TypeScript | Rust | TypeScript | Rust |
| **运行环境** | 浏览器 | 原生 | Node.js | 原生 |
| **部署难度** | ⭐ 零部署 | ⭐⭐ 需安装 | ⭐⭐ 需安装 | ⭐⭐ 需安装 |
| **文件系统** | 虚拟FS | 原生 | 原生 | 原生 |
| **LLM 推理** | 远程 + 本地 | 远程 | 远程 | 远程 |
| **微信兼容** | ✅ | ❌ | ❌ | ❌ |
| **分享传播** | ✅ 链接 | ❌ | ❌ | ❌ |
| **离线使用** | ⚠️ 部分 | ✅ | ✅ | ✅ |
| **代码量** | ~3k 行 | ~30k 行 | ~5k 行 | 3.3k 行 |

---

## 八、实施计划

### 阶段一：MVP（1周）

```
Day 1-2: 项目初始化
  □ 创建 Vite + React 项目
  □ 配置 TypeScript + TailwindCSS
  □ 实现基础 UI 框架

Day 3-4: 核心功能
  □ 实现 Agent 核心（参考 TrueConsole）
  □ 实现虚拟文件系统
  □ 实现 LLM 客户端（OpenAI）

Day 5-6: 工具集成
  □ 实现内置工具（read/write/search）
  □ 实现 WebFetch（CORS 代理）
  □ 实现熔断器

Day 7: 测试发布
  □ 端到端测试
  □ 部署到 Cloudflare Pages
  □ 编写使用文档
```

### 阶段二：功能完善（2周）

```
Week 2:
  □ Plan 模式实现
  □ Skill 系统实现
  □ 多 LLM Provider 支持

Week 3:
  □ WebLLM 本地推理（可选）
  □ 微信浏览器适配
  □ 性能优化
```

### 阶段三：生态扩展（1个月）

```
  □ Skill 市场
  □ 小程序版本
  □ 浏览器扩展
  □ VS Code 插件
```

---

## 九、核心代码示例

### 完整的 Agent 实现

```typescript
// src/agent/Agent.ts

import { LLMClient, CompletionRequest } from '../llm/types';
import { ToolRegistry } from '../tools/Registry';
import { SkillRegistry } from '../skills/Registry';
import { ContextManager } from '../context/Manager';
import { PlanMode } from '../plan/PlanMode';

export interface AgentConfig {
  llm: LLMClient;
  tools?: ToolRegistry;
  skills?: SkillRegistry;
  maxIterations?: number;
  maxFailures?: number;
}

export class JetBotAgent {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private skills: SkillRegistry;
  private context: ContextManager;
  private planMode: PlanMode | null = null;
  
  private circuitBreaker = {
    maxIterations: 25,
    maxFailures: 3,
    failures: 0,
  };
  
  constructor(config: AgentConfig) {
    this.llm = config.llm;
    this.tools = config.tools || new ToolRegistry();
    this.skills = config.skills || new SkillRegistry();
    this.context = new ContextManager(20);
    
    if (config.maxIterations) this.circuitBreaker.maxIterations = config.maxIterations;
    if (config.maxFailures) this.circuitBreaker.maxFailures = config.maxFailures;
  }
  
  async handle(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) return '';
    
    // 命令处理
    if (trimmed.startsWith('/')) {
      return this.handleCommand(trimmed);
    }
    
    // Plan 模式
    if (this.planMode) {
      return this.handlePlanMode(trimmed);
    }
    
    // 正常对话
    return this.executeWithTools(trimmed);
  }
  
  private async executeWithTools(input: string): Promise<string> {
    let iterations = 0;
    
    // 添加用户消息
    this.context.addUserMessage(input);
    
    while (iterations < this.circuitBreaker.maxIterations) {
      // 构建请求
      const systemPrompt = this.buildSystemPrompt();
      const messages = this.context.toMessages(systemPrompt);
      
      // 调用 LLM
      const response = await this.llm.complete({
        messages,
        tools: this.tools.getSchemas(),
      });
      
      // 添加助手消息
      this.context.addAssistantMessage(response.content, response.toolCalls);
      
      // 没有工具调用，返回结果
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return response.content;
      }
      
      // 执行工具
      for (const toolCall of response.toolCalls) {
        try {
          console.log(`[Tool] ${toolCall.name}`, toolCall.params);
          
          const result = await this.tools.execute(toolCall.name, toolCall.params);
          this.context.addToolResult(toolCall.id, result);
          
          // 重置失败计数
          this.circuitBreaker.failures = 0;
        } catch (error: any) {
          console.error(`[Tool Error] ${toolCall.name}:`, error);
          this.circuitBreaker.failures++;
          
          this.context.addToolResult(
            toolCall.id,
            `Error: ${error.message}`,
            true
          );
          
          // 熔断器检查
          if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
            throw new Error('熔断器触发：连续失败过多，停止执行');
          }
        }
      }
      
      iterations++;
    }
    
    throw new Error(`达到最大迭代次数 (${this.circuitBreaker.maxIterations})`);
  }
  
  private buildSystemPrompt(): string {
    const now = new Date();
    const cwd = '/workspace';  // 虚拟工作目录
    
    let prompt = `你是 JetBot，一个在浏览器中运行的 AI 助手。用中文回答，简明扼要。

<environment>
当前时间: ${now.toLocaleString('zh-CN')}
工作目录: ${cwd}
运行环境: 浏览器 (${navigator.userAgent.split(' ').slice(-2).join(' ')})
</environment>

你可以使用工具来完成任务：读写文件、搜索代码、HTTP 请求。
优先使用专用工具，而非通用命令。`;

    // 添加 Skill 菜单
    const skillMenu = this.skills.getMenuText();
    if (skillMenu) {
      prompt += `\n\n${skillMenu}`;
    }
    
    // 添加已激活 Skill 的指令
    const skillInstructions = this.skills.getActiveInstructions();
    if (skillInstructions) {
      prompt += `\n\n<active_skill_instructions>\n${skillInstructions}\n</active_skill_instructions>`;
    }
    
    return prompt;
  }
  
  private handleCommand(input: string): string {
    const [cmd, ...args] = input.slice(1).split(/\s+/);
    
    switch (cmd) {
      case 'help':
        return this.getHelpText();
      case 'clear':
        this.context.clear();
        return '上下文已清空';
      case 'status':
        return this.getStatus();
      case 'skill':
        return this.handleSkillCommand(args);
      case 'model':
        return `当前模型: ${this.llm.model()}`;
      default:
        return `未知命令: ${cmd}。输入 /help 查看帮助。`;
    }
  }
  
  private handleSkillCommand(args: string[]): string {
    if (args.length === 0 || args[0] === 'list') {
      return this.skills.list();
    }
    
    if (args[0] === 'off') {
      return this.skills.deactivate();
    }
    
    return this.skills.activate(args[0]);
  }
  
  private handlePlanMode(input: string): string {
    // Plan 模式实现（参考 TrueConsole）
    return this.planMode!.handle(input);
  }
  
  private getHelpText(): string {
    return `
JetBot 命令列表:

  /help          显示帮助
  /clear         清空上下文
  /status        显示状态
  /skill [name]  激活/列出 Skills
  /model         显示当前模型

内置工具:
  read_file      读取文件
  write_file     写入文件
  list_dir       列出目录
  search_text    搜索文本
  http_get       HTTP 请求

示例:
  "读取 README.md 文件"
  "帮我分析这段代码的性能"
  "搜索所有 TODO 注释"
`;
  }
  
  private getStatus(): string {
    return `
状态:
  上下文: ${this.context.turnCount()} 轮
  模型: ${this.llm.model()}
  Skill: ${this.skills.activeName() || '无'}
  迭代: ${this.circuitBreaker.failures}/${this.circuitBreaker.maxFailures} 失败
`;
  }
}
```

---

## 十、总结

### 核心优势

1. **零门槛** - 打开浏览器即用，无需安装
2. **易分享** - 分享链接即可传播
3. **微信兼容** - 微信浏览器中也能运行
4. **代码精简** - ~3k 行，易于理解和定制
5. **渐进增强** - 基础功能全平台，高级功能现代浏览器

### 风险提示

1. **CORS 限制** - 需要代理服务器（可免费部署）
2. **文件系统** - 虚拟文件系统，非真实文件
3. **离线能力** - 部分功能需要网络
4. **性能** - 大文件操作可能较慢

### 下一步行动

1. ✅ **确认方案** - 本设计已评估可行
2. 🚀 **启动开发** - 创建 GitHub 仓库
3. 📦 **MVP 开发** - 1 周完成核心功能
4. 🌐 **部署上线** - Cloudflare Pages
5. 📢 **推广传播** - 分享链接

---

**"大道至简，浏览器即 Agent"**

---

*设计完成于 2026-03-16 16:00*
