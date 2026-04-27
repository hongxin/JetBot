import { create } from 'zustand';
import type { DistillProposal } from '../agent/SkillDistiller';

export interface UIToolCallBlock {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
  isError?: boolean;
  collapsed: boolean;
}

/** Source of the message — undefined means normal user input. */
export type MessageSource = 'scheduler' | 'heartbeat' | undefined;

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  reasoningContent?: string;
  toolCalls: UIToolCallBlock[];
  isStreaming: boolean;
  timestamp: number;
  /** Set for autonomously injected messages. */
  source?: MessageSource;
  /** Set when this message is a distillation proposal */
  distillProposal?: DistillProposal;
}

export type AgentStatus = 'idle' | 'thinking' | 'executing_tool' | 'waiting_permission' | 'error';

export type PermissionResponse = 'allow' | 'deny' | 'always';

export interface PendingPermission {
  toolName: string;
  params: Record<string, unknown>;
  /** Whether this tool is 'dangerous' — if so, "Always Allow" is not offered. */
  isDangerous: boolean;
  resolve: (response: PermissionResponse) => void;
}

interface ChatState {
  messages: UIMessage[];
  status: AgentStatus;
  pendingPermission: PendingPermission | null;
  currentIteration: number;

  addUserMessage: (text: string, source?: MessageSource) => void;
  addAssistantMessage: (source?: MessageSource) => string;
  appendToAssistant: (id: string, chunk: string) => void;
  setReasoning: (id: string, reasoning: string) => void;
  finalizeAssistant: (id: string) => void;
  addToolCall: (msgId: string, tc: { id: string; name: string; params: Record<string, unknown> }) => void;
  updateToolCall: (tcId: string, update: Partial<UIToolCallBlock>) => void;
  addError: (message: string) => void;
  setStatus: (status: AgentStatus) => void;
  setPendingPermission: (pp: PendingPermission | null) => void;
  setIteration: (n: number) => void;
  clearMessages: () => void;
  addDistillProposal: (proposal: DistillProposal, source?: MessageSource) => string;
  resolveDistillProposal: (msgId: string, accepted: boolean) => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: 'idle',
  pendingPermission: null,
  currentIteration: 0,

  addUserMessage: (text, source?) => set(s => ({
    messages: [...s.messages, {
      id: `msg-${++msgCounter}`,
      role: 'user',
      content: text,
      toolCalls: [],
      isStreaming: false,
      timestamp: Date.now(),
      source,
    }],
  })),

  addAssistantMessage: (source?) => {
    const id = `msg-${++msgCounter}`;
    set(s => ({
      messages: [...s.messages, {
        id,
        role: 'assistant',
        content: '',
        toolCalls: [],
        isStreaming: true,
        timestamp: Date.now(),
        source,
      }],
    }));
    return id;
  },

  appendToAssistant: (() => {
    // Batch streaming chunks: accumulate between animation frames to reduce re-renders
    let pendingChunks = new Map<string, string>();
    let rafId = 0;

    const flush = () => {
      rafId = 0;
      const batch = pendingChunks;
      pendingChunks = new Map();
      if (batch.size === 0) return;
      set(s => ({
        messages: s.messages.map(m => {
          const extra = batch.get(m.id);
          return extra ? { ...m, content: m.content + extra } : m;
        }),
      }));
    };

    return (id: string, chunk: string) => {
      pendingChunks.set(id, (pendingChunks.get(id) ?? '') + chunk);
      if (!rafId) {
        rafId = requestAnimationFrame(flush);
      }
    };
  })(),

  setReasoning: (id, reasoning) => set(s => ({
    messages: s.messages.map(m => m.id === id ? { ...m, reasoningContent: (m.reasoningContent ?? '') + reasoning } : m),
  })),

  finalizeAssistant: (id) => set(s => ({
    messages: s.messages.map(m => m.id === id ? { ...m, isStreaming: false } : m),
  })),

  addToolCall: (msgId, tc) => set(s => ({
    messages: s.messages.map(m => m.id === msgId ? {
      ...m,
      toolCalls: [...m.toolCalls, { ...tc, status: 'running', collapsed: false }],
    } : m),
  })),

  updateToolCall: (tcId, update) => set(s => ({
    messages: s.messages.map(m => ({
      ...m,
      toolCalls: m.toolCalls.map(tc => tc.id === tcId ? { ...tc, ...update } : tc),
    })),
  })),

  addError: (message) => set(s => ({
    messages: [...s.messages, {
      id: `msg-${++msgCounter}`,
      role: 'error',
      content: message,
      toolCalls: [],
      isStreaming: false,
      timestamp: Date.now(),
    }],
  })),

  setStatus: (status) => set({ status }),
  setPendingPermission: (pendingPermission) => set({ pendingPermission }),
  setIteration: (currentIteration) => set({ currentIteration }),
  clearMessages: () => set({ messages: [], currentIteration: 0 }),

  addDistillProposal: (proposal, source?) => {
    const id = `msg-${++msgCounter}`;
    set(s => ({
      messages: [...s.messages, {
        id,
        role: 'assistant',
        content: `提炼出新 Skill: **${proposal.name}** — ${proposal.description}`,
        toolCalls: [],
        isStreaming: false,
        timestamp: Date.now(),
        source,
        distillProposal: proposal,
      }],
    }));
    return id;
  },

  resolveDistillProposal: (msgId, accepted) => set(s => ({
    messages: s.messages.map(m => {
      if (m.id !== msgId) return m;
      if (accepted && m.distillProposal) {
        return { ...m, content: m.content + '\n\n已保存。', distillProposal: undefined };
      }
      return { ...m, content: m.content + '\n\n已舍弃。', distillProposal: undefined };
    }),
  })),
}));
