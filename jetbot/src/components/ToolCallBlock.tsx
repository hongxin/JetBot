import { useState, useEffect } from 'react';
import type { UIToolCallBlock } from '../store/chatStore';
import { BrailleSpinner } from './shared/Spinner';

const STATUS_ICON: Record<string, string> = {
  done: '✓',
  error: '✗',
};

/** Extract the single most important param as a compact hint */
function paramHint(_name: string, params: Record<string, unknown>): string {
  // Pick the most meaningful param based on tool name
  const key = params.path ?? params.pattern ?? params.command ?? params.code ?? params.content;
  if (!key) {
    const first = Object.values(params)[0];
    if (!first) return '';
    const s = typeof first === 'string' ? first : JSON.stringify(first);
    return s.length > 50 ? s.slice(0, 47) + '...' : s;
  }
  const s = typeof key === 'string' ? key : JSON.stringify(key);
  return s.length > 50 ? s.slice(0, 47) + '...' : s;
}

/** Short result summary — one line, dimmed */
function resultHint(result: string): string {
  const line = result.split('\n').find(l => l.trim()) ?? result;
  return line.length > 60 ? line.slice(0, 57) + '...' : line;
}

interface Props {
  block: UIToolCallBlock;
}

export function ToolCallBlock({ block }: Props) {
  const isRunning = block.status === 'running';
  const isError = block.status === 'error';
  const [expanded, setExpanded] = useState(isError || isRunning);

  useEffect(() => {
    if (block.status === 'done') setExpanded(false);
    if (block.status === 'error') setExpanded(true);
  }, [block.status]);

  const hint = paramHint(block.name, block.params);
  const hasResult = !!block.result;

  return (
    <div className={`ml-4 my-1 text-xs font-mono rounded-lg transition-colors ${
      isRunning ? 'bg-yellow-500/5' : isError ? 'bg-red-500/5' : 'bg-transparent hover:bg-[hsl(var(--muted))]/50'
    }`}>
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-2.5 py-1.5 group"
      >
        {/* Line 1: status + name + param hint */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <BrailleSpinner className="text-yellow-400" />
          ) : (
            <span className={`shrink-0 ${isError ? 'text-red-400' : 'text-green-400'}`}>
              {STATUS_ICON[block.status] ?? '?'}
            </span>
          )}

          <span className={`font-semibold shrink-0 ${isRunning ? 'text-yellow-300' : 'text-[hsl(var(--foreground))]'}`}>
            {block.name}
          </span>

          {!expanded && hint && (
            <span className="text-[hsl(var(--muted-foreground))] truncate opacity-70">
              {hint}
            </span>
          )}

          <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {expanded ? '▼' : '▶'}
          </span>
        </div>

        {/* Line 2: result hint — only when collapsed, on its own line, dimmed */}
        {!expanded && hasResult && (
          <div className={`mt-0.5 pl-5 truncate text-[11px] opacity-50 ${
            isError ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]'
          }`}>
            ↳ {resultHint(block.result!)}
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5">
          <div className="bg-[hsl(var(--muted))] rounded px-2.5 py-1.5 overflow-x-auto text-[11px] whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">
            {JSON.stringify(block.params, null, 2)}
          </div>
          {block.result && (
            <ResultBlock result={block.result} isError={!!block.isError} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultBlock({ result, isError }: { result: string; isError: boolean }) {
  const isLong = result.length > 300;
  const [showFull, setShowFull] = useState(!isLong);
  const displayed = showFull ? result : result.slice(0, 300);

  return (
    <div className={`rounded px-2.5 py-1.5 overflow-x-auto text-[11px] whitespace-pre-wrap ${
      isError
        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
        : 'bg-green-500/8 text-green-700 dark:text-green-400'
    }`}>
      {displayed}
      {isLong && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="ml-1 text-[10px] underline opacity-70 hover:opacity-100"
        >
          {showFull ? '← collapse' : `... +${result.length - 300} chars`}
        </button>
      )}
    </div>
  );
}
