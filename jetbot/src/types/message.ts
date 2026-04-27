export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface TextContent { type: 'text'; text: string }
export interface ReasoningContent { type: 'reasoning'; text: string }
export interface ToolCallContent { type: 'tool_call'; id: string; name: string; arguments: string }
export interface ToolResultContent { type: 'tool_result'; toolCallId: string; toolName?: string; content: string; isError: boolean }
export type ContentPart = TextContent | ReasoningContent | ToolCallContent | ToolResultContent;

export interface Turn {
  role: Role;
  content: ContentPart[];
  timestamp: number;
  tokenEstimate: number;
  masked: boolean;
}

export interface LLMMessage {
  role: Role;
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export type AgentEventType = 'loop:start' | 'loop:iteration' | 'loop:end'
  | 'llm:request' | 'llm:response' | 'llm:chunk' | 'llm:reasoning_chunk' | 'llm:reasoning'
  | 'tool:start' | 'tool:result' | 'tool:error'
  | 'permission:request' | 'error' | 'circuit_breaker';

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
  timestamp: number;
}
