import { useEffect, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useT } from '../lib/i18n';
import { Modal } from './shared/Modal';

/** Format tool params for display — code-heavy tools get special treatment */
function formatParams(_toolName: string, params: Record<string, unknown>) {
  const { code, ...rest } = params as { code?: string; [k: string]: unknown };
  const hasCode = typeof code === 'string';
  const hasRest = Object.keys(rest).length > 0;

  return (
    <>
      {hasRest && (
        <pre className="whitespace-pre-wrap text-[hsl(var(--muted-foreground))] mb-1">
          {Object.entries(rest).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}
        </pre>
      )}
      {hasCode ? (
        <pre className="whitespace-pre-wrap text-[hsl(var(--foreground))] leading-relaxed">{code}</pre>
      ) : !hasRest ? (
        <pre className="whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">{JSON.stringify(params, null, 2)}</pre>
      ) : null}
    </>
  );
}

export function PermissionDialog() {
  const pending = useChatStore(s => s.pendingPermission);
  const setPending = useChatStore(s => s.setPendingPermission);
  const t = useT();

  const handleAllow = useCallback(() => {
    if (!pending) return;
    pending.resolve('allow');
    setPending(null);
  }, [pending, setPending]);

  const handleDeny = useCallback(() => {
    if (!pending) return;
    pending.resolve('deny');
    setPending(null);
  }, [pending, setPending]);

  const handleAlways = useCallback(() => {
    if (!pending) return;
    pending.resolve('always');
    setPending(null);
  }, [pending, setPending]);

  // Keyboard shortcuts: Y=allow, N=deny, A=always
  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); handleAllow(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleDeny(); }
      if ((e.key === 'a' || e.key === 'A') && !pending.isDangerous) { e.preventDefault(); handleAlways(); }
      if (e.key === 'Escape') { e.preventDefault(); handleDeny(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, handleAllow, handleDeny, handleAlways]);

  if (!pending) return null;

  return (
    <Modal open={!!pending} maxWidth="max-w-md" title={t('permission.title')}>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
          {t('permission.allow_tool')} <strong className="text-[hsl(var(--foreground))]">{pending.toolName}</strong>?
        </p>
        <div className="bg-[hsl(var(--muted))] rounded-lg p-3 mb-4 text-xs font-mono overflow-x-auto max-h-40">
          {formatParams(pending.toolName, pending.params)}
        </div>

        <div className="flex gap-2 justify-end items-center">
          {/* Always allow — only for non-dangerous tools */}
          {!pending.isDangerous && (
            <button
              onClick={handleAlways}
              className="px-3 py-2 text-sm rounded-lg border border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors mr-auto"
              title={t('permission.always_hint')}
            >
              {t('permission.always')}
            </button>
          )}

          <button
            onClick={handleDeny}
            className="px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            {t('permission.deny')}
          </button>
          <button
            onClick={handleAllow}
            className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            {t('permission.allow')}
          </button>
        </div>
    </Modal>
  );
}
