import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useAgentStore } from '../store/agentStore';
import { useChatStore } from '../store/chatStore';
import { useCosmosStore } from '../store/cosmosStore';
import { useT } from '../lib/i18n';
import { ImportButton } from './FileBridge';

export function InputBar() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useAgentStore(s => s.sendMessage);
  const abort = useAgentStore(s => s.abort);
  const status = useChatStore(s => s.status);
  const t = useT();
  const breakNext = useCosmosStore(s => s.breakNext);
  const activeView = useCosmosStore(s => s.activeView);
  const setBreakNext = useCosmosStore(s => s.setBreakNext);
  const isRunning = status !== 'idle' && status !== 'error';

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isRunning) return;
    setText('');
    sendMessage(trimmed);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isRunning, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="sticky bottom-0 bg-[hsl(var(--background))] border-t border-[hsl(var(--border))] p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
        <ImportButton />
        {activeView === 'cosmos' && (
          <button
            onClick={() => setBreakNext(!breakNext)}
            title={t(breakNext ? 'cosmos.breakActive' : 'cosmos.breakHint')}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
              breakNext
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {breakNext ? '✂' : '⛓'}
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? t('input.thinking') : t('input.placeholder')}
          disabled={isRunning}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50"
        />
        {isRunning ? (
          <button
            onClick={abort}
            className="rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-600 transition-colors shrink-0"
          >
            {t('input.stop')}
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 shrink-0"
          >
            {t('input.send')}
          </button>
        )}
      </div>
    </div>
  );
}
