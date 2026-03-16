import { create } from 'zustand';
import type { CosmosNode, CosmosEdge, Viewport } from '../components/cosmos/types';
import { useAgentStore } from './agentStore';

export type ActiveView = 'chat' | 'cosmos';

type AddNodeInput = Omit<CosmosNode, 'x' | 'y' | 'radius' | 'birthTime'>;

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
  updateNode: (id: string, update: Partial<CosmosNode>) => void;
  selectNode: (id: string | null) => void;
  setDragConnectFrom: (id: string | null) => void;
  completeDragConnect: (toId: string) => void;
  setViewport: (v: Partial<Viewport>) => void;
}

const RADIUS_MAP = { user: 32, assistant: 36, tool: 28 };

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
