import { create } from 'zustand';
import type { CosmosNode, CosmosEdge, Viewport, MemoryCategory } from '../components/cosmos/types';
import { useAgentStore } from './agentStore';

export type ActiveView = 'chat' | 'cosmos';

type AddNodeInput = Omit<CosmosNode, 'x' | 'y' | 'radius' | 'birthTime'>;

export interface AddMemoryNodeInput {
  id: string;
  memoryId: number;
  category: MemoryCategory;
  content: string;
  anchorNodeId?: string | null;
}

export interface AddSkillNodeInput {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  instructions: string;
  anchorNodeId?: string | null;
}

interface CosmosState {
  nodes: CosmosNode[];
  edges: CosmosEdge[];
  viewport: Viewport;
  activeView: ActiveView;
  selectedNodeId: string | null;
  dragConnectFrom: string | null;
  currentTurnId: number;
  breakNext: boolean;
  _crossTurnFromId: string | null;

  setActiveView: (view: ActiveView) => void;
  toggleView: () => void;
  setBreakNext: (v: boolean) => void;
  nextTurn: () => number;
  addNode: (node: AddNodeInput) => void;
  addMemoryNode: (input: AddMemoryNodeInput) => void;
  addSkillNode: (input: AddSkillNodeInput) => void;
  archiveMemoryNode: (memoryId: number) => void;
  updateNode: (id: string, update: Partial<CosmosNode>) => void;
  selectNode: (id: string | null) => void;
  setDragConnectFrom: (id: string | null) => void;
  completeDragConnect: (toId: string) => void;
  setViewport: (v: Partial<Viewport>) => void;
}

const RADIUS_MAP: Record<string, number> = {
  user: 32, assistant: 36, tool: 28,
  memory: 22, skill: 30,
};

export const useCosmosStore = create<CosmosState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
  activeView: 'cosmos',
  selectedNodeId: null,
  dragConnectFrom: null,
  currentTurnId: 0,
  breakNext: false,
  _crossTurnFromId: null,

  setActiveView: (view) => set({ activeView: view }),
  toggleView: () => set((s) => ({ activeView: s.activeView === 'chat' ? 'cosmos' : 'chat' })),
  setBreakNext: (v) => set({ breakNext: v }),

  nextTurn: () => {
    const { currentTurnId, nodes, breakNext } = get();
    const next = currentTurnId + 1;
    const prevTurnNodes = nodes.filter(n => n.turnId === currentTurnId);
    const lastNode = prevTurnNodes[prevTurnNodes.length - 1] ?? null;
    set({
      currentTurnId: next,
      _crossTurnFromId: (breakNext || !lastNode) ? null : lastNode.id,
      breakNext: false,
    });
    return next;
  },

  addNode: (partial) => {
    const { nodes, edges } = get();

    // Random initial position (force sim in canvas will arrange)
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 80;
    // If there's a node in the same turn, spawn near it
    const sameTurn = nodes.filter((n) => n.turnId === partial.turnId);
    let cx = 0, cy = 0;
    if (sameTurn.length > 0) {
      const last = sameTurn[sameTurn.length - 1];
      cx = last.x;
      cy = last.y;
    }

    const node: CosmosNode = {
      ...partial,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      radius: RADIUS_MAP[partial.kind] ?? 28,
      birthTime: performance.now(),
    };

    // Auto-edge: connect to last node in same turn
    const newEdges = [...edges];
    if (sameTurn.length > 0) {
      const prev = sameTurn[sameTurn.length - 1];
      newEdges.push({
        id: `edge-${prev.id}-${node.id}`,
        fromId: prev.id,
        toId: node.id,
        type: 'auto',
      });
    }

    // Cross-turn edge: link previous turn's last node to this turn's first node
    const { _crossTurnFromId } = get();
    if (_crossTurnFromId && sameTurn.length === 0) {
      newEdges.push({
        id: `edge-cross-${_crossTurnFromId}-${node.id}`,
        fromId: _crossTurnFromId,
        toId: node.id,
        type: 'cross-turn',
      });
    }

    set({ nodes: [...nodes, node], edges: newEdges, _crossTurnFromId: null });
  },

  addMemoryNode: ({ id, memoryId, category, content, anchorNodeId }) => {
    const { nodes, edges, currentTurnId } = get();
    const anchor = anchorNodeId ? nodes.find(n => n.id === anchorNodeId) : null;
    // Spawn near anchor if present, else random initial position
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 60;
    const cx = anchor ? anchor.x : 0;
    const cy = anchor ? anchor.y : 0;

    const node: CosmosNode = {
      id,
      kind: 'memory',
      content,
      toolName: '',
      params: {},
      isError: false,
      status: 'done',
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      radius: RADIUS_MAP.memory,
      turnId: currentTurnId,
      timestamp: Date.now(),
      birthTime: performance.now(),
      memoryId,
      memoryCategory: category,
    };

    const newEdges = anchor
      ? [...edges, { id: `edge-derives-${anchor.id}-${id}`, fromId: anchor.id, toId: id, type: 'derives' as const }]
      : edges;

    set({ nodes: [...nodes, node], edges: newEdges });
  },

  addSkillNode: ({ id, name, description, triggers, tools, instructions, anchorNodeId }) => {
    const { nodes, edges, currentTurnId } = get();
    const anchor = anchorNodeId ? nodes.find(n => n.id === anchorNodeId) : null;
    const angle = Math.random() * Math.PI * 2;
    const dist = 110 + Math.random() * 60;
    const cx = anchor ? anchor.x : 0;
    const cy = anchor ? anchor.y : 0;

    const node: CosmosNode = {
      id,
      kind: 'skill',
      content: description,
      toolName: '',
      params: {},
      isError: false,
      status: 'done',
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      radius: RADIUS_MAP.skill,
      turnId: currentTurnId,
      timestamp: Date.now(),
      birthTime: performance.now(),
      skillName: name,
      skillDescription: description,
      skillTriggers: triggers,
      skillTools: tools,
      skillInstructions: instructions,
    };

    const newEdges = anchor
      ? [...edges, { id: `edge-derives-${anchor.id}-${id}`, fromId: anchor.id, toId: id, type: 'derives' as const }]
      : edges;

    set({ nodes: [...nodes, node], edges: newEdges });
  },

  archiveMemoryNode: (memoryId) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.kind === 'memory' && n.memoryId === memoryId ? { ...n, status: 'archived' } : n,
      ),
    }));
  },

  updateNode: (id, update) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...update } : n)),
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setDragConnectFrom: (id) => set({ dragConnectFrom: id }),

  completeDragConnect: (toId) => {
    const { dragConnectFrom, nodes, edges } = get();
    if (!dragConnectFrom || dragConnectFrom === toId) {
      set({ dragConnectFrom: null });
      return;
    }

    const fromNode = nodes.find((n) => n.id === dragConnectFrom);
    const toNode = nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) {
      set({ dragConnectFrom: null });
      return;
    }

    const edgeId = `edge-manual-${dragConnectFrom}-${toId}`;
    const prompt = buildConnectPrompt(fromNode, toNode);

    const newEdge: CosmosEdge = {
      id: edgeId,
      fromId: dragConnectFrom,
      toId,
      type: 'manual',
      manualPrompt: prompt,
    };

    set({ edges: [...edges, newEdge], dragConnectFrom: null });
    useAgentStore.getState().sendMessage(prompt);
  },

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
}));

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function describeNode(n: CosmosNode): string {
  if (n.kind === 'user') return `[用户]: ${truncate(n.content, 200)}`;
  if (n.kind === 'assistant') return `[AI]: ${truncate(n.content, 200)}`;
  if (n.kind === 'memory') return `[记忆/${n.memoryCategory ?? 'fact'}]: ${truncate(n.content, 200)}`;
  if (n.kind === 'skill') {
    const triggers = (n.skillTriggers ?? []).join(', ');
    return `[技能 ${n.skillName ?? '?'}]: ${truncate(n.skillDescription ?? n.content, 160)}${triggers ? ` (触发: ${triggers})` : ''}`;
  }
  return `[${n.toolName}]: ${truncate(JSON.stringify(n.params), 120)} → ${truncate(n.content, 200)}`;
}

function buildConnectPrompt(from: CosmosNode, to: CosmosNode): string {
  return (
    `分析这两个节点的关系：\n` +
    `1. ${describeNode(from)}\n` +
    `2. ${describeNode(to)}\n` +
    `请说明它们之间的关联，以及如何组合使用。`
  );
}
