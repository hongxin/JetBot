import type { LLMMessage } from './message';

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface CompletionRequest {
  model: string;
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
  stream?: boolean;
}

export interface CompletionResponse {
  content: string;
  reasoningContent?: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  finishReason: string | null;
}

export interface LLMClient {
  complete(req: CompletionRequest, onStream?: (chunk: string) => void, onReasoningStream?: (chunk: string) => void): Promise<CompletionResponse>;
  model(): string;
}

export class LLMError extends Error {
  code: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'SERVER' | 'TIMEOUT';
  retryable: boolean;

  constructor(message: string, code: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'SERVER' | 'TIMEOUT', retryable = false) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.retryable = retryable;
  }
}
