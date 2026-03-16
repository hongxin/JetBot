import { create } from 'zustand';
import { Agent } from '../agent/Agent';
import { OpenAICompatibleClient } from '../llm/OpenAICompatibleClient';
import { useConfigStore } from './configStore';
import { useChatStore, type MessageSource, type PermissionResponse } from './chatStore';
import type { AgentEvent } from '../types/message';
import type { Scheduler } from '../scheduler/Scheduler';
import { logger } from '../lib/logger';
import { useCosmosStore } from './cosmosStore';

const log = logger.module('store');

// Module-level state for event routing (shared between initAgent and handleInjection)
let currentMsgId = '';
let currentSource: MessageSource = undefined;
// Track current cosmos turn for linking user→assistant→tools
let currentCosmosTurnId = 0;
// Track assistant node id so we can update its content when finalized
let currentAssistantCosmosId = '';

interface AgentState {
  agent: Agent | null;
  scheduler: Scheduler | null;
  autoMode: boolean;
  taskCount: number;
  initAgent: () => void;
  destroyAgent: () => void;
  sendMessage: (text: string) => Promise<void>;
  handleInjection: (prompt: string, source: string) => Promise<void>;
  abort: () => void;
  refreshTaskCount: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agent: null,
  scheduler: null,
  autoMode: false,
  taskCount: 0,

  initAgent: () => {
    const config = useConfigStore.getState();

    const llm = new OpenAICompatibleClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelId: config.model,
      proxyUrl: config.proxyUrl,
    });

    const agent = new Agent({
      llm,
      permissionConfirmFn: (toolName, params, isDangerous) => {
        return new Promise<PermissionResponse>((resolve) => {
          useChatStore.getState().setStatus('waiting_permission');
          useChatStore.getState().setPendingPermission({ toolName, params, isDangerous, resolve });
        });
      },
      onInject: (prompt, source) => {
        // Route injection through agentStore so it appears in UI
        return get().handleInjection(prompt, source);
      },
      onEvent: (event: AgentEvent) => {
        const store = useChatStore.getState();
        const cosmos = useCosmosStore.getState();

        switch (event.type) {
          case 'llm:request': {
            currentMsgId = store.addAssistantMessage(currentSource);
            store.setStatus('thinking');
            store.setIteration(event.data.iteration as number);
            // Create assistant cosmos node (content will be updated when finalized)
            currentAssistantCosmosId = `assistant-${currentMsgId}`;
            cosmos.addNode({
              id: currentAssistantCosmosId,
              kind: 'assistant',
              content: '',
              toolName: '',
              params: {},
              isError: false,
              status: 'running',
              turnId: currentCosmosTurnId,
              timestamp: Date.now(),
            });
            break;
          }
          case 'llm:chunk':
            store.appendToAssistant(currentMsgId, event.data.chunk as string);
            break;
          case 'llm:response': {
            store.finalizeAssistant(currentMsgId);
            // Update assistant cosmos node with final content
            const msg = store.messages.find(m => m.id === currentMsgId);
            if (msg) {
              cosmos.updateNode(currentAssistantCosmosId, {
                content: msg.content,
                status: 'done',
              });
            }
            const toolCalls = event.data.toolCalls as Array<{ id: string; name: string; arguments: string }>;
            if (toolCalls?.length) {
              for (const tc of toolCalls) {
                let params: Record<string, unknown> = {};
                try { params = JSON.parse(tc.arguments); } catch {}
                store.addToolCall(currentMsgId, { id: tc.id, name: tc.name, params });
              }
            }
            break;
          }
          case 'tool:start': {
            store.setStatus('executing_tool');
            // Forward to cosmos store
            const toolCalls = store.messages.find(m => m.id === currentMsgId)?.toolCalls;
            const tc = toolCalls?.[toolCalls.length - 1];
            if (tc) {
              cosmos.addNode({
                id: tc.id,
                kind: 'tool',
                content: '',
                toolName: tc.name,
                params: tc.params,
                isError: false,
                status: 'running',
                turnId: currentCosmosTurnId,
                timestamp: Date.now(),
              });
            }
            break;
          }
          case 'tool:result': {
            const isError = event.data.isError as boolean;
            store.updateToolCall(event.data.id as string, {
              status: isError ? 'error' : 'done',
              result: event.data.result as string,
              isError,
              collapsed: !isError,
            });
            cosmos.updateNode(event.data.id as string, {
              status: isError ? 'error' : 'done',
              content: event.data.result as string,
              isError,
            });
            break;
          }
          case 'tool:error':
            store.updateToolCall(event.data.id as string, {
              status: 'error',
              result: event.data.error as string,
              isError: true,
            });
            break;
          case 'error':
            store.addError(event.data.message as string);
            break;
          case 'circuit_breaker':
            store.addError(`Circuit breaker triggered after ${event.data.failures} consecutive failures.`);
            break;
          case 'loop:end':
            store.setStatus('idle');
            break;
        }
      },
    });

    const scheduler = agent.getScheduler();
    set({ agent, scheduler });
    // Initial task count
    scheduler.listTasks().then(tasks => set({ taskCount: tasks.length }));
  },

  destroyAgent: () => {
    const { agent } = get();
    agent?.destroy();
    set({ agent: null, scheduler: null, autoMode: false, taskCount: 0 });
  },

  sendMessage: async (text) => {
    const { agent } = get();
    if (!agent) return;

    const chat = useChatStore.getState();
    chat.addUserMessage(text);
    chat.setStatus('thinking');

    // Start a new cosmos turn and add user node
    const cosmos = useCosmosStore.getState();
    currentCosmosTurnId = cosmos.nextTurn();
    cosmos.addNode({
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'user',
      content: text,
      toolName: '',
      params: {},
      isError: false,
      status: 'idle',
      turnId: currentCosmosTurnId,
      timestamp: Date.now(),
    });

    try {
      const result = await agent.handle(text);
      // If it was a command (no stats), add the response as assistant message
      if (!result.stats && result.response) {
        const id = chat.addAssistantMessage();
        chat.appendToAssistant(id, result.response);
        chat.finalizeAssistant(id);
        // Also add as cosmos node
        cosmos.addNode({
          id: `cmd-${Date.now()}`,
          kind: 'assistant',
          content: result.response,
          toolName: '',
          params: {},
          isError: false,
          status: 'done',
          turnId: currentCosmosTurnId,
          timestamp: Date.now(),
        });
      }
      if (text.startsWith('/schedule') || text.startsWith('/auto')) {
        get().refreshTaskCount();
      }
    } catch (err: any) {
      chat.addError(err.message);
    } finally {
      useChatStore.getState().setStatus('idle');
    }
  },

  abort: () => {
    get().agent?.abort();
    useChatStore.getState().setStatus('idle');
  },

  handleInjection: async (prompt, source) => {
    const { agent } = get();
    if (!agent) return;

    const msgSource: MessageSource = (source === 'heartbeat' || source === 'scheduler') ? source : 'scheduler';
    log.info('autonomous injection', { source: msgSource, promptLength: prompt.length });

    const chat = useChatStore.getState();
    chat.addUserMessage(prompt, msgSource);
    chat.setStatus('thinking');

    // Start a new cosmos turn and add user node for injection
    const cosmos = useCosmosStore.getState();
    currentCosmosTurnId = cosmos.nextTurn();
    cosmos.addNode({
      id: `inject-${Date.now()}`,
      kind: 'user',
      content: `[${source}] ${prompt}`,
      toolName: '',
      params: {},
      isError: false,
      status: 'idle',
      turnId: currentCosmosTurnId,
      timestamp: Date.now(),
    });

    currentSource = msgSource;
    try {
      const taggedPrompt = `[${source}] ${prompt}`;
      const result = await agent.handle(taggedPrompt);
      if (!result.stats && result.response) {
        const id = chat.addAssistantMessage(msgSource);
        chat.appendToAssistant(id, result.response);
        chat.finalizeAssistant(id);
        cosmos.addNode({
          id: `cmd-${Date.now()}`,
          kind: 'assistant',
          content: result.response,
          toolName: '',
          params: {},
          isError: false,
          status: 'done',
          turnId: currentCosmosTurnId,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      chat.addError(err.message);
    } finally {
      currentSource = undefined;
      useChatStore.getState().setStatus('idle');
      get().refreshTaskCount();
    }
  },

  refreshTaskCount: () => {
    const { scheduler, agent } = get();
    if (scheduler) {
      scheduler.listTasks().then(tasks => set({ taskCount: tasks.length }));
    }
    if (agent) {
      set({ autoMode: agent.isAutoMode() });
    }
  },
}));
