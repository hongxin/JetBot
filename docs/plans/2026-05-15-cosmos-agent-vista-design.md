# Cosmos as Agent Full Vista — Fusion Design

**Date**: 2026-05-15
**Author**: Hongxin Zhang
**Status**: Design

## 背景

两支并行工作流需要融合：

- **A 支（本地 UX 改进）**：NodeCard 八向拖拽调整大小、统一粒子模型——纯视觉层。
- **B 支（另一台机器，已合并 19 个 commit）**：IndexedDB 持久化、SessionStore、MemoryStore、SkillDistiller、SkillsPanel、DistillCard——数据/会话层。

两支几乎不重叠，所以"融合"不是 diff 级冲突解决，而是**架构级机会**：B 让 Agent 有了"会话记忆 + 技能蒸馏"的能力，但这些能力目前只在 Chat 视图可见。Cosmos 本应是 Agent 全貌的可视化，现在只画了会话流——信息完整性断了。

A 支的可调整尺寸卡片，恰好是把 memory/skill 长内容塞进 Cosmos 节点所需的必要基础设施。

## 目标

让 Cosmos 从「对话流图」升级为「Agent 状态投影图」。在同一张图里同时显示：

- 对话流（user / assistant / tool，既有）
- 沉淀物（memory / skill，新增）

并通过 `derives` 边，让用户视觉上理解"知识从哪一轮对话长出"。

## 非目标（本期不做）

- 历史 memory/skill 渲染为边缘云团——只显示本会话新增的。验证价值后再做。
- Cosmos 图结构持久化到 IndexedDB——CosmosStore 保持内存级、派生视图。
- Cosmos 与会话恢复联动（recoverCrashedSession 重建图）。这是预先存在的 gap，不在本期。
- Distill/记忆事件触发画布全局动画（粒子爆发、屏闪）——锦上添花，下期。

## 架构

```
ChatStore  ◄──── 对话事件 ──── Agent
                                │
                                ├──► MemoryStore   (IndexedDB)
                                ├──► SkillRegistry (IndexedDB)
                                │
              ◄── CustomEvent ──┤
              │
              ▼
        CosmosStore (内存、派生视图)
        ├─ user/assistant/tool 节点（既有路径）
        ├─ memory 节点（新增，监听 jetbot:memory:added）
        └─ skill  节点（新增，监听 jetbot:skill:distilled-accepted）
```

**关键决策**：
1. CosmosStore 仍是会话级、内存态。MemoryStore/SkillRegistry/SessionStore 已是 source of truth，Cosmos 只是视图——职责单一。
2. 事件桥沿用 DOM CustomEvent 模式（与既有 `jetbot:distill:save/discard`、`jetbot:export` 一致），零侵入 Agent.ts。
3. memory/skill 节点附着策略：附到当下"最近 assistant 节点"。无则独立。让"知识从对话长出"的因果关系视觉化。

## 数据模型扩展

### `CosmosNode`

```ts
export type CosmosNodeKind =
  | 'user' | 'assistant' | 'tool'   // 既有
  | 'memory' | 'skill';              // 新增

export interface CosmosNode {
  // 既有字段...
  kind: CosmosNodeKind;

  // memory-only
  memoryId?: number;
  memoryCategory?: 'preference' | 'project' | 'decision' | 'fact';

  // skill-only
  skillName?: string;
  skillDescription?: string;
  skillTriggers?: string[];
  skillTools?: string[];
  skillInstructions?: string;
}
```

### `KIND_HUE` / `RADIUS_MAP` 增补

```ts
KIND_HUE.memory = 170;   // 青绿
KIND_HUE.skill  = 42;    // 琥珀金
RADIUS_MAP.memory = 22;
RADIUS_MAP.skill  = 30;
```

### `CosmosEdge.type` 扩展

```ts
type: 'auto' | 'cross-turn' | 'manual' | 'derives'
```

`derives`：从 assistant 指向沉淀物（memory/skill），表示"由此产生"。

## 事件桥协议

| 事件名 | 触发点 | detail |
|---|---|---|
| `jetbot:memory:added` | `MemoryStore.add()` 成功后 | `{ entry: MemoryEntry }` |
| `jetbot:memory:removed` | `MemoryStore.remove()` 成功后 | `{ id: number }` |
| `jetbot:skill:distilled-accepted` | `Agent` 收到 `jetbot:distill:save` 后 `skills.addSkill` 成功后 | `{ proposal: DistillProposal, anchorMsgId: string }` |

监听器在 `agentStore.initializeAgent` 安装、`destroyAgent` 移除。

## 边连接策略

agentStore 维护：

```ts
let lastAssistantCosmosId: string | null = null;
const msgIdToCosmosId = new Map<string, string>();
```

- `llm:request` 创建 assistant 节点 → `msgIdToCosmosId.set(msgId, cosmosId)`
- `llm:response` finalize → `lastAssistantCosmosId = cosmosId`

**memory 节点**：连到 `lastAssistantCosmosId`（最近 finalize 的 assistant），无则独立。
**skill 节点**：通过 `detail.anchorMsgId` 在 `msgIdToCosmosId` 精确查找原 assistant 节点；保证可追溯。

### Slash 命令边角

`/memory add` 不经 `sendMessage`，不创建 user 节点。此时：
- 若有 `lastAssistantCosmosId` → memory 节点附到它
- 否则独立——力学模拟会把它推到画布边缘，语义自洽（"未根植于对话的孤立知识"）

### memory 删除的语义

`jetbot:memory:removed` **不删除** Cosmos 节点，而是把节点标记为 `status: 'archived'`，视觉上加灰。Cosmos 是"发生过什么"的轨迹（与 chat history 同语义），不是"现在还有什么"的快照。

## 渲染

### Canvas 绘制
- **memory**：圆 + 内嵌水滴 Path2D，hue=170。
- **skill**：六角形 polygon，hue=42，stroke 加亮。

### `derives` 边
- 虚线 `dash [6,4]`，alpha 0.5
- 粒子单向流动：源 → 目标（普通边是双向交错；此处单向暗示"流出"）

### NodeCard 适配

`NodeCard` 已是 Stream A 的可调尺寸容器。在 tool 分支后追加：

```tsx
{node.kind === 'memory' && <MemoryCardBody node={node} />}
{node.kind === 'skill'  && <SkillCardBody  node={node} />}
```

- **MemoryCardBody**：category badge + 时间戳 + markdown 内容
- **SkillCardBody**：name + description + triggers/tools chips + 可展开的完整 SKILL.md

复用 Stream A 的：八向 resize、min/max 约束、markdown 样式 `cosmos-md`。

### 默认尺寸按 kind

```ts
const DEFAULT_H: Record<CosmosNodeKind, number> = {
  user: 180, assistant: 220, tool: 280, memory: 220, skill: 320,
};
```

## 测试 / 验证

1. `tsc -b` 类型检查通过。
2. 手动跑通：`/memory add fact 测试事实` → 看到 memory 节点出现并连到最近 assistant（若有）。
3. 触发蒸馏（连续 5+ 工具调用 + 成功率 ≥ 50%）→ DistillCard 在 chat 出现 → 点保存 → 看到 skill 节点 + derives 边。
4. 手测 NodeCard 缩放对新 kind 也能正常工作。
5. 检查 i18n 中英文渲染。

## 实施顺序

1. 提交本地 Stream A（NodeCard resize + 粒子改进）作为独立 commit——基础设施。
2. 类型/边类型扩展（types.ts、cosmosStore.ts）
3. MemoryStore/SkillRegistry 事件发射
4. agentStore 监听 + 写入 cosmos
5. CosmosCanvas 新节点形状 + `derives` 边样式
6. NodeCard 适配 memory/skill 分支
7. i18n keys
8. tsc 验证 + 浏览器手测
9. 提交并 push
