import { useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useConfigStore } from '../store/configStore';
import { useAgentStore } from '../store/agentStore';
import { useCosmosStore } from '../store/cosmosStore';
import { SettingsDialog } from './SettingsDialog';
import { TaskPanel } from './TaskPanel';
import { LogPanel } from './LogPanel';
import { useT, type TranslationKey } from '../lib/i18n';

const STATUS_COLOR: Record<string, string> = {
  idle: 'bg-green-500',
  thinking: 'bg-yellow-500 animate-pulse',
  executing_tool: 'bg-blue-500 animate-pulse',
  waiting_permission: 'bg-orange-500 animate-pulse',
  error: 'bg-red-500',
};

const STATUS_KEY: Record<string, TranslationKey> = {
  idle: 'status.ready',
  thinking: 'status.thinking',
  executing_tool: 'status.executing_tool',
  waiting_permission: 'status.waiting_permission',
  error: 'status.error',
};

export function StatusBar() {
  const status = useChatStore(s => s.status);
  const iteration = useChatStore(s => s.currentIteration);
  const model = useConfigStore(s => s.model);
  const locale = useConfigStore(s => s.locale);
  const setLocale = useConfigStore(s => s.setLocale);
  const autoMode = useAgentStore(s => s.autoMode);
  const taskCount = useAgentStore(s => s.taskCount);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const activeView = useCosmosStore(s => s.activeView);
  const toggleView = useCosmosStore(s => s.toggleView);
  const t = useT();

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs">
        <span className="px-2 py-0.5 rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] font-mono">
          {model}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
          <span className="text-[hsl(var(--muted-foreground))]">{t(STATUS_KEY[status])}</span>
          {iteration > 0 && status !== 'idle' && (
            <span className="text-[hsl(var(--muted-foreground))]">({iteration})</span>
          )}
          {autoMode && (
            <span className="flex items-center gap-1 ml-2 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Auto
            </span>
          )}
          {taskCount > 0 && (
            <button
              onClick={() => setTaskPanelOpen(true)}
              className="ml-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleView}
            className={`px-1.5 py-0.5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors ${activeView === 'cosmos' ? 'bg-indigo-500/20 text-indigo-300' : ''}`}
          >
            {activeView === 'chat' ? '✦ Cosmos' : '◻ Chat'}
          </button>
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>
          <button
            onClick={() => setLogPanelOpen(true)}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {t('status.logs')}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {t('status.settings')}
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TaskPanel open={taskPanelOpen} onClose={() => setTaskPanelOpen(false)} />
      <LogPanel open={logPanelOpen} onClose={() => setLogPanelOpen(false)} />
    </>
  );
}
