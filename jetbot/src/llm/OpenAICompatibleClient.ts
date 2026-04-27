import type { LLMClient, CompletionRequest, CompletionResponse } from '../types/llm';
import { LLMError } from '../types/llm';
import { resolveProxyUrl } from '../lib/cors';
import { logger } from '../lib/logger';

const log = logger.module('llm');

export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  timeout?: number;
  proxyUrl?: string;
  thinkingMode?: 'non-thinking' | 'thinking' | 'thinking_max';
  provider?: string;
}

const DEEPSEEK_THINKING_TIMEOUT = 300_000;
const DEFAULT_TIMEOUT = 120_000;

export class OpenAICompatibleClient implements LLMClient {
  private config: Required<ClientConfig>;

  constructor(config: ClientConfig) {
    const isThinkingMode = config.thinkingMode && config.thinkingMode !== 'non-thinking';
    const defaultTimeout = isThinkingMode ? DEEPSEEK_THINKING_TIMEOUT : DEFAULT_TIMEOUT;
    this.config = {
      ...config,
      timeout: config.timeout ?? defaultTimeout,
      proxyUrl: config.proxyUrl ?? '',
      thinkingMode: config.thinkingMode ?? 'non-thinking',
      provider: config.provider ?? '',
    };
  }

  model(): string {
    return this.config.modelId;
  }

  async complete(req: CompletionRequest, onStream?: (chunk: string) => void, onReasoningStream?: (chunk: string) => void): Promise<CompletionResponse> {
    const url = resolveProxyUrl(`${this.config.baseUrl}/chat/completions`, this.config.proxyUrl?.trim());
    log.debug('resolved url', { url: url.substring(0, 100) });
    const body: Record<string, unknown> = {
      model: this.config.modelId,
      messages: req.messages,
      stream: !!onStream,
    };

    // DeepSeek V4 recommended sampling parameters
    if (this.isDeepSeek()) {
      body.temperature = 1.0;
      body.top_p = 1.0;

      if (this.config.thinkingMode !== 'non-thinking') {
        body.thinking = { type: 'enabled' };
      }
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      body.tool_choice = req.tool_choice ?? 'auto';
    }

    log.debug('request', { model: this.config.modelId, messages: req.messages.length, tools: req.tools?.length ?? 0, stream: !!onStream, thinking: this.config.thinkingMode });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    let response: Response;
    let retries = 0;
    const maxRetries = 3;

    while (true) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        break;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new LLMError('Request timed out', 'TIMEOUT', true);
        }
        if (retries < maxRetries) {
          retries++;
          const delay = 500 * Math.pow(2, retries);
          log.warn('retrying request', { attempt: retries, delay, error: err.message });
          await this.delay(delay);
          continue;
        }
        throw new LLMError(`Network error: ${err.message}`, 'NETWORK', true);
      }
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      log.error('http error', { status: response.status, body: errorBody.slice(0, 200) });
      if (response.status === 401 || response.status === 403) {
        throw new LLMError(`Authentication failed: ${errorBody}`, 'AUTH');
      }
      if (response.status === 429) {
        throw new LLMError(`Rate limited: ${errorBody}`, 'RATE_LIMIT', true);
      }
      if (response.status >= 500) {
        throw new LLMError(`Server error ${response.status}: ${errorBody}`, 'SERVER', true);
      }
      throw new LLMError(`HTTP ${response.status}: ${errorBody}`, 'SERVER');
    }

    if (onStream && body.stream) {
      if (!response.body) {
        log.error('response.body is null — falling back to non-stream');
        const json = await response.json();
        return this.parseResponse(json);
      }
      return this.handleStream(response, onStream, onReasoningStream, controller.signal);
    }

    const json = await response.json();
    return this.parseResponse(json);
  }

  private parseResponse(json: any): CompletionResponse {
    const choice = json.choices?.[0];
    if (!choice) {
      throw new LLMError('No choices in response', 'SERVER');
    }
    const msg = choice.message;
    return {
      content: msg?.content ?? '',
      reasoningContent: msg?.reasoning_content ?? undefined,
      toolCalls: (msg?.tool_calls ?? []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      usage: json.usage ? {
        prompt_tokens: json.usage.prompt_tokens,
        completion_tokens: json.usage.completion_tokens,
      } : undefined,
      finishReason: choice.finish_reason ?? null,
    };
  }

  private async handleStream(response: Response, onStream: (chunk: string) => void, onReasoningStream?: (chunk: string) => void, _signal?: AbortSignal): Promise<CompletionResponse> {
    // Safety net: wrap everything so a stream crash doesn't hang the Promise
    try {
      return await this._handleStream(response, onStream, onReasoningStream, _signal);
    } catch (err: any) {
      log.error('stream fatal error', { message: err.message, stack: err.stack?.slice(0, 300) });
      throw err;
    }
  }

  private async _handleStream(response: Response, onStream: (chunk: string) => void, onReasoningStream?: (chunk: string) => void, _signal?: AbortSignal): Promise<CompletionResponse> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const contentChunks: string[] = [];
    const reasoningChunks: string[] = [];
    const toolCallMap = new Map<number, { id: string; name: string; argChunks: string[] }>();
    let finishReason: string | null = null;
    let usage: { prompt_tokens: number; completion_tokens: number } | undefined;

    const STREAM_IDLE_TIMEOUT = 30_000;

    const readWithTimeout = (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      return Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('stream_idle_timeout')), STREAM_IDLE_TIMEOUT);
        }),
      ]);
    };

    log.debug('stream started');
    try {
      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await readWithTimeout();
        } catch (err: any) {
          if (err.message === 'stream_idle_timeout') {
            log.warn('stream idle timeout — aborting read', { chunks: contentChunks.length, reasoningChunks: reasoningChunks.length });
          } else {
            log.warn('stream read interrupted', { error: err.message, chunks: contentChunks.length, reasoningChunks: reasoningChunks.length });
          }
          reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = readResult;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let streamDone = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'data: [DONE]') {
            streamDone = true;
            break;
          }
          if (!trimmed.startsWith('data: ')) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed.slice(6));
          } catch {
            continue;
          }

          const delta = parsed.choices?.[0]?.delta;

          // Reasoning content delta (DeepSeek V4 thinking mode)
          if (delta?.reasoning_content) {
            reasoningChunks.push(delta.reasoning_content);
            if (onReasoningStream) onReasoningStream(delta.reasoning_content);
          }

          // Content delta
          if (delta?.content) {
            contentChunks.push(delta.content);
            onStream(delta.content);
          }

          // Tool call deltas
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallMap.has(idx)) {
                toolCallMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', argChunks: [] });
              }
              const entry = toolCallMap.get(idx)!;
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              if (tc.function?.arguments) entry.argChunks.push(tc.function.arguments);
            }
          }

          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
          if (parsed.usage) {
            usage = { prompt_tokens: parsed.usage.prompt_tokens, completion_tokens: parsed.usage.completion_tokens };
          }

          if (finishReason) {
            streamDone = true;
            break;
          }
        }
        if (streamDone) break;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    const content = contentChunks.join('');
    const reasoningContent = reasoningChunks.length > 0 ? reasoningChunks.join('') : undefined;
    log.debug('stream complete', { contentLength: content.length, reasoningLength: reasoningContent?.length ?? 0, toolCalls: toolCallMap.size, finishReason });

    return {
      content,
      reasoningContent,
      toolCalls: [...toolCallMap.values()].map(tc => ({ id: tc.id, name: tc.name, arguments: tc.argChunks.join('') })),
      usage,
      finishReason,
    };
  }

  private isDeepSeek(): boolean {
    return this.config.provider === 'deepseek' || this.config.modelId.startsWith('deepseek');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
