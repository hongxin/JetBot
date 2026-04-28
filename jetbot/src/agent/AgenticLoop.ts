import type { LLMClient, CompletionRequest, CompletionResponse } from '../types/llm';
import type { AgentEvent, AgentEventType } from '../types/message';
import type { ContextManager } from './ContextManager';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type { PermissionManager } from '../tools/Permission';
import { logger } from '../lib/logger';

const log = logger.module('loop');

export interface LoopStats {
  iterations: number;
  toolCalls: number;
  totalTokens: number;
  duration: number;
}

type EventCallback = (event: AgentEvent) => void;

export class AgenticLoop {
  private abortController: AbortController | null = null;
  private maxIterations = 100;

  // Three-level failure classification (inspired by GoodConsole)
  private readonly FATAL_LIMIT = 3;      // Hard limit: circuit breaker
  private readonly RECOVERABLE_LIMIT = 6; // Soft limit: inject strategy hint

  /** Track recent tool errors to detect repeat-failure patterns */
  private recentToolErrors: Array<{ name: string; error: string }> = [];

  private isFatalError(name: string, msg: string): boolean {
    if (name === 'unknown' || msg.includes('Unknown tool')) return true;
    if (msg.includes('Malformed JSON')) return true;
    return false;
  }

  async run(
    llm: LLMClient,
    tools: ToolRegistry,
    context: ContextManager,
    systemPrompt: string,
    onEvent: EventCallback,
    permissionChecker?: PermissionManager,
    onStream?: (chunk: string) => void,
  ): Promise<{ finalResponse: string; stats: LoopStats }> {
    this.abortController = new AbortController();
    const startTime = Date.now();
    let iterations = 0;
    let totalToolCalls = 0;
    let totalTokens = 0;
    let fatalFailures = 0;
    let recoverableFailures = 0;

    this.recentToolErrors = [];
    this.emit(onEvent, 'loop:start', {});
    log.info('loop start', { model: llm.model() });

    const bumpFatal = (): void => {
      fatalFailures++;
      recoverableFailures = 0;
    };
    const bumpRecoverable = (): void => {
      recoverableFailures++;
      fatalFailures = 0;
    };
    const resetCounters = (): void => {
      fatalFailures = 0;
      recoverableFailures = 0;
    };

    // Cache tool schemas — they don't change during a loop run
    const toolSchemas = tools.schemas();
    const modelId = llm.model();

    while (iterations < this.maxIterations) {
      if (this.abortController.signal.aborted) {
        return this.result('Aborted.', iterations, totalToolCalls, totalTokens, startTime);
      }

      iterations++;
      this.emit(onEvent, 'loop:iteration', { iteration: iterations });
      this.emit(onEvent, 'llm:request', { iteration: iterations });

      let response: CompletionResponse;
      try {
        const req: CompletionRequest = {
          model: modelId,
          messages: context.toMessages(systemPrompt),
          tools: toolSchemas,
          tool_choice: 'auto',
          stream: !!onStream,
        };
        response = await llm.complete(req, onStream, (reasoningChunk) => {
          this.emit(onEvent, 'llm:reasoning_chunk', { chunk: reasoningChunk });
        });
        log.debug('llm response', { contentLength: response.content.length, reasoningLength: response.reasoningContent?.length ?? 0, toolCalls: response.toolCalls.length, finishReason: response.finishReason });
      } catch (err: any) {
        log.error('llm error', { message: err.message, code: err.code });
        this.emit(onEvent, 'error', { message: err.message, code: err.code });
        bumpFatal();
        if (fatalFailures >= this.FATAL_LIMIT) {
          this.emit(onEvent, 'circuit_breaker', { fatalFailures, recoverableFailures });
          return this.result(`Circuit breaker: ${fatalFailures} consecutive fatal failures. Last error: ${err.message}`, iterations, totalToolCalls, totalTokens, startTime);
        }
        // Don't add assistant messages for API validation errors — they pollute context
        // and make retries worse. Circuit breaker will handle it if persistent.
        if (!(err.message.includes('Invalid assistant message') || err.message.includes('invalid_request_error'))) {
          context.addAssistantMessage(`Error calling LLM: ${err.message}`);
        }
        continue;
      }

      if (response.usage) {
        totalTokens += (response.usage.prompt_tokens + response.usage.completion_tokens);
      }

      if (response.reasoningContent) {
        this.emit(onEvent, 'llm:reasoning', { content: response.reasoningContent });
      }

      this.emit(onEvent, 'llm:response', {
        content: response.content,
        toolCalls: response.toolCalls,
        finishReason: response.finishReason,
        reasoningContent: response.reasoningContent,
      });

      context.addAssistantMessage(response.content, response.reasoningContent, response.toolCalls.length > 0 ? response.toolCalls : undefined);

      // No tool calls → final response
      if (response.toolCalls.length === 0) {
        this.emit(onEvent, 'loop:end', { reason: 'complete' });
        return this.result(response.content, iterations, totalToolCalls, totalTokens, startTime);
      }

      // Execute tool calls
      for (const tc of response.toolCalls) {
        if (this.abortController.signal.aborted) break;

        totalToolCalls++;
        let params: Record<string, unknown>;
        try {
          params = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          // Malformed arguments — tell the LLM so it can fix the call
          log.warn('malformed tool arguments', { name: tc.name, args: tc.arguments?.slice(0, 100) });
          const errMsg = `Error: Could not parse tool arguments as JSON. You sent: ${(tc.arguments || '').slice(0, 200)}. Please provide valid JSON parameters.`;
          context.addToolResult(tc.id, errMsg, true, tc.name);
          this.emit(onEvent, 'tool:error', { id: tc.id, name: tc.name, error: 'Malformed JSON arguments' });
          bumpFatal();
          if (fatalFailures >= this.FATAL_LIMIT) {
            this.emit(onEvent, 'circuit_breaker', { fatalFailures, recoverableFailures });
            this.emit(onEvent, 'loop:end', { reason: 'circuit_breaker' });
            return this.result(`Circuit breaker triggered after ${fatalFailures} consecutive fatal failures.`, iterations, totalToolCalls, totalTokens, startTime);
          }
          continue;
        }

        log.info('tool call', { name: tc.name, id: tc.id });
        this.emit(onEvent, 'tool:start', { id: tc.id, name: tc.name, params });

        // Permission check
        if (permissionChecker) {
          this.emit(onEvent, 'permission:request', { name: tc.name, params });
          const allowed = await permissionChecker.check(tc.name, params);
          if (!allowed) {
            context.addToolResult(tc.id, 'Permission denied by user.', true, tc.name);
            this.emit(onEvent, 'tool:result', { id: tc.id, name: tc.name, result: 'Permission denied', isError: true });
            bumpRecoverable();
            if (recoverableFailures >= this.RECOVERABLE_LIMIT) {
              context.addAssistantMessage('Hint: You have been denied permission many times. Consider switching to a different approach that does not require these tools.');
              recoverableFailures = 0;
            }
            continue;
          }
        }

        try {
          let result = await tools.execute(tc.name, params);
          if (result.length > 3072) {
            result = result.slice(0, 3072) + '\n... [truncated]';
          }
          log.debug('tool result', { name: tc.name, resultLength: result.length });
          context.addToolResult(tc.id, result, false, tc.name);
          this.emit(onEvent, 'tool:result', { id: tc.id, name: tc.name, result, isError: false });
          resetCounters();
        } catch (err: any) {
          // Detect repeat-failure pattern: same tool + same error seen before
          const errorKey = `${tc.name}:${err.message}`;
          const repeatCount = this.recentToolErrors.filter(e => `${e.name}:${e.error}` === errorKey).length;
          this.recentToolErrors.push({ name: tc.name, error: err.message });

          let errMsg = `Error: ${err.message}`;
          if (repeatCount > 0) {
            errMsg += `\n\n⚠ This is the same error you got before (${repeatCount + 1}x). Do NOT retry with the same parameters. Either fix the parameters, use a different approach, or skip this step entirely.`;
            log.warn('repeat tool failure detected', { name: tc.name, repeatCount: repeatCount + 1 });
          }

          log.error('tool error', { name: tc.name, error: err.message });
          context.addToolResult(tc.id, errMsg, true, tc.name);
          this.emit(onEvent, 'tool:error', { id: tc.id, name: tc.name, error: err.message });

          if (this.isFatalError(tc.name, err.message)) {
            bumpFatal();
            if (fatalFailures >= this.FATAL_LIMIT) {
              this.emit(onEvent, 'circuit_breaker', { fatalFailures, recoverableFailures });
              this.emit(onEvent, 'loop:end', { reason: 'circuit_breaker' });
              return this.result(`Circuit breaker triggered after ${fatalFailures} consecutive fatal failures.`, iterations, totalToolCalls, totalTokens, startTime);
            }
          } else {
            bumpRecoverable();
            if (recoverableFailures >= this.RECOVERABLE_LIMIT) {
              context.addAssistantMessage('Hint: You have encountered many recoverable errors. Consider switching your exploration strategy or using a different approach.');
              recoverableFailures = 0;
            }
          }
        }
      }
    }

    this.emit(onEvent, 'loop:end', { reason: 'max_iterations' });
    return this.result('Reached maximum iterations.', iterations, totalToolCalls, totalTokens, startTime);
  }

  abort(): void {
    this.abortController?.abort();
  }

  private emit(cb: EventCallback, type: AgentEventType, data: Record<string, unknown>): void {
    cb({ type, data, timestamp: Date.now() });
  }

  private result(finalResponse: string, iterations: number, toolCalls: number, totalTokens: number, startTime: number): { finalResponse: string; stats: LoopStats } {
    return {
      finalResponse,
      stats: { iterations, toolCalls, totalTokens, duration: Date.now() - startTime },
    };
  }
}
