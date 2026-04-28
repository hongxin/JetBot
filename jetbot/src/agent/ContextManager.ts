import type { Turn, LLMMessage, ContentPart, Role } from '../types/message';

/** Tools whose results serve as a persistent project map — never masked when small */
const PROJECT_MAP_TOOLS = new Set(['list_dir', 'search_text', 'glob']);

/** Max size in chars to keep as project map context */
const MAP_RESULT_MAX = 2000;

export interface BudgetConfig {
  maxTokenBudget: number;
  compactThreshold: number;
  maxTurns: number;
}

/** Per-provider context budgets */
export function getBudgetForModel(modelId: string): BudgetConfig {
  if (modelId.startsWith('deepseek-v4-')) {
    return { maxTokenBudget: 128_000, compactThreshold: 0.80, maxTurns: 30 };
  }
  if (modelId.startsWith('deepseek')) {
    return { maxTokenBudget: 64_000, compactThreshold: 0.80, maxTurns: 20 };
  }
  if (modelId.startsWith('glm-')) {
    return { maxTokenBudget: 128_000, compactThreshold: 0.80, maxTurns: 25 };
  }
  if (modelId.includes('qwen')) {
    return { maxTokenBudget: 24_000, compactThreshold: 0.75, maxTurns: 15 };
  }
  if (modelId.startsWith('gpt-4o')) {
    return { maxTokenBudget: 128_000, compactThreshold: 0.80, maxTurns: 25 };
  }
  return { maxTokenBudget: 30_000, compactThreshold: 0.80, maxTurns: 20 };
}

export class ContextManager {
  private turns: Turn[] = [];
  private maxTurns: number;
  private maxTokenBudget: number;
  private compactThreshold: number;
  private recentToolResults: number;

  // Cache
  private _cachedMessages: LLMMessage[] | null = null;
  private _cachedSystemPrompt: string | null = null;
  private _dirty = true;

  constructor(maxTurns = 20, maxTokenBudget = 30000, compactThreshold = 0.80, recentToolResults = 4) {
    this.maxTurns = maxTurns;
    this.maxTokenBudget = maxTokenBudget;
    this.compactThreshold = compactThreshold;
    this.recentToolResults = recentToolResults;
  }

  /** Adapt context budget for a specific model */
  adaptForModel(modelId: string): void {
    const budget = getBudgetForModel(modelId);
    this.maxTokenBudget = budget.maxTokenBudget;
    this.compactThreshold = budget.compactThreshold;
    this.maxTurns = budget.maxTurns;
  }

  addUserMessage(text: string): void {
    this.pushTurn('user', [{ type: 'text', text }]);
  }

  addAssistantMessage(text: string, reasoningContent?: string, toolCalls?: Array<{ id: string; name: string; arguments: string }>): void {
    const parts: ContentPart[] = [];
    if (reasoningContent) parts.push({ type: 'reasoning', text: reasoningContent });
    // Guard: assistant message must have content or tool_calls for API validity.
    // When the LLM returns only reasoning with no text and no tool calls, insert
    // a minimal placeholder so toMessages() never emits an invalid message.
    const hasContent = text || (toolCalls && toolCalls.length > 0);
    if (text) parts.push({ type: 'text', text });
    if (!hasContent) parts.push({ type: 'text', text: ' ' });
    if (toolCalls) {
      for (const tc of toolCalls) {
        parts.push({ type: 'tool_call', id: tc.id, name: tc.name, arguments: tc.arguments });
      }
    }
    this.pushTurn('assistant', parts);
  }

  addToolResult(toolCallId: string, content: string, isError = false, toolName?: string): void {
    this.pushTurn('tool', [{ type: 'tool_result', toolCallId, content, isError, toolName }]);
  }

  clear(): void {
    this.turns = [];
    this.invalidateCache();
  }

  turnCount(): number { return this.turns.length; }

  currentTokenEstimate(): number {
    return this.turns.reduce((sum, t) => sum + t.tokenEstimate, 0);
  }

  toMessages(systemPrompt: string): LLMMessage[] {
    if (!this._dirty && this._cachedMessages && this._cachedSystemPrompt === systemPrompt) {
      return this._cachedMessages;
    }

    const msgs: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

    // Count tool result turns from the end for smart masking
    let toolResultCount = 0;
    const toolResultIndices = new Map<number, number>();
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].role === 'tool') {
        toolResultIndices.set(i, toolResultCount);
        toolResultCount++;
      }
    }

    for (let i = 0; i < this.turns.length; i++) {
      const turn = this.turns[i];
      if (turn.role === 'user') {
        const textParts: string[] = [];
        for (const c of turn.content) {
          if (c.type === 'text') textParts.push(c.text);
        }
        msgs.push({ role: 'user', content: textParts.join('\n') });
      } else if (turn.role === 'assistant') {
        const msg: LLMMessage = { role: 'assistant' };
        const textParts: string[] = [];
        const reasoningParts: string[] = [];
        const tcParts: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
        for (const c of turn.content) {
          if (c.type === 'text') textParts.push(c.text);
          else if (c.type === 'reasoning') reasoningParts.push(c.text);
          else if (c.type === 'tool_call') {
            tcParts.push({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } });
          }
        }
        if (textParts.length) msg.content = textParts.join('');
        if (reasoningParts.length) msg.reasoning_content = reasoningParts.join('');
        if (tcParts.length) msg.tool_calls = tcParts;
        // Defense in depth: API rejects assistant messages with neither content nor tool_calls.
        // If a malformed turn slipped through, patch it rather than poison the request.
        if (!msg.content && !msg.tool_calls) {
          msg.content = ' ';
        }
        msgs.push(msg);
      } else if (turn.role === 'tool') {
        const result = turn.content[0] as any;
        const idx = toolResultIndices.get(i) ?? 999;
        let content = result.content;

        if (idx >= this.recentToolResults && !result.isError) {
          // Smart masking: preserve project-map tools (list_dir, search_text, glob)
          // when results are small — they serve as persistent context
          const tn = result.toolName as string | undefined;
          if (tn && PROJECT_MAP_TOOLS.has(tn) && content.length <= MAP_RESULT_MAX) {
            // Keep it as a persistent project map entry
          } else {
            content = `[Result masked - ${result.content.length} bytes]`;
          }
        }
        msgs.push({ role: 'tool', content, tool_call_id: result.toolCallId });
      }
    }

    this._cachedMessages = msgs;
    this._cachedSystemPrompt = systemPrompt;
    this._dirty = false;
    return msgs;
  }

  /** Return a read-only reference to current turns (for session persistence) */
  turnsRef(): readonly Turn[] {
    return this.turns;
  }

  private invalidateCache(): void {
    this._dirty = true;
    this._cachedMessages = null;
    this._cachedSystemPrompt = null;
  }

  private pushTurn(role: Role, content: ContentPart[]): void {
    this.invalidateCache();

    const text = content.map(c => {
      if (c.type === 'text') return c.text;
      if (c.type === 'reasoning') return c.text;
      if (c.type === 'tool_call') return c.arguments;
      if (c.type === 'tool_result') return c.content;
      return '';
    }).join('');

    this.turns.push({
      role,
      content,
      timestamp: Date.now(),
      tokenEstimate: Math.ceil(text.length / 4),
      masked: false,
    });

    this.trimTurns();

    if (this.currentTokenEstimate() > this.maxTokenBudget * this.compactThreshold) {
      this.compact();
    }
  }

  /**
   * Trim oldest turns to stay within maxTurns, without orphaning tool results.
   * Every tool result must follow an assistant message with matching tool_calls.
   * When we remove an assistant that had tool_calls, we must also remove its tool results.
   */
  private trimTurns(): void {
    while (this.turns.length > this.maxTurns) {
      this.turns.shift();
    }
    // Clean up orphan tool results at the front:
    // a tool role turn must always have a preceding assistant with tool_calls.
    // If the first turn is a tool, it's orphaned — remove it and re-check.
    while (this.turns.length > 0 && this.turns[0].role === 'tool') {
      this.turns.shift();
    }
  }

  private compact(): void {
    this.invalidateCache();
    const half = Math.floor(this.turns.length / 2);
    for (let i = 0; i < half; i++) {
      const turn = this.turns[i];
      turn.content = turn.content.map(c => {
        if (c.type === 'text' && c.text.length > 200) {
          return { ...c, text: c.text.slice(0, 200) + '... [compacted]' };
        }
        if (c.type === 'reasoning' && c.text.length > 200) {
          return { ...c, text: c.text.slice(0, 200) + '... [compacted]' };
        }
        if (c.type === 'tool_result' && c.content.length > 200) {
          return { ...c, content: c.content.slice(0, 200) + '... [compacted]' };
        }
        return c;
      });
      const text = turn.content.map(p => {
        if (p.type === 'text') return p.text;
        if (p.type === 'reasoning') return p.text;
        if (p.type === 'tool_result') return p.content;
        if (p.type === 'tool_call') return p.arguments;
        return '';
      }).join('');
      turn.tokenEstimate = Math.ceil(text.length / 4);
    }
  }
}
