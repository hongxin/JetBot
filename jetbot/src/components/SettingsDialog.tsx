import { useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useAgentStore } from '../store/agentStore';
import { useT } from '../lib/i18n';
import { Modal } from './shared/Modal';
import { SkillsPanel } from './SkillsPanel';

const PROVIDER_LABELS: Record<string, Record<string, string>> = {
  openai: { en: 'OpenAI', zh: 'OpenAI' },
  deepseek: { en: 'DeepSeek', zh: 'DeepSeek' },
  zhipu: { en: 'Zhipu', zh: '智谱' },
  ollama: { en: 'Ollama', zh: 'Ollama' },
  custom: { en: 'Custom', zh: '自定义' },
};

type TabId = 'provider' | 'skills';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const config = useConfigStore();
  const { initAgent, destroyAgent } = useAgentStore();
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<TabId>('provider');
  const t = useT();

  const handleSave = () => {
    const { valid, errors } = config.validate();
    if (!valid) {
      alert(errors.join('\n'));
      return;
    }
    destroyAgent();
    initAgent();
    onClose();
  };

  const tabs: { id: TabId; label: { en: string; zh: string } }[] = [
    { id: 'provider', label: { en: 'Provider', zh: '提供商' } },
    { id: 'skills', label: { en: 'Skills', zh: '技能' } },
  ];

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl" title={t('settings.title')}>
        <div className="flex gap-1 mb-4">
          {tabs.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                tab === tabItem.id
                  ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {tabItem.label[config.locale] ?? tabItem.label.en}
            </button>
          ))}
        </div>

        {tab === 'provider' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.language')}</label>
            <div className="flex gap-2">
              {(['en', 'zh'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => config.setLocale(l)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.locale === l
                      ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                  }`}
                >
                  {l === 'en' ? 'English' : '中文'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.provider')}</label>
            <div className="flex gap-2">
              {['openai', 'deepseek', 'zhipu', 'ollama', 'custom'].map(p => (
                <button
                  key={p}
                  onClick={() => config.applyPreset(p)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.provider === p
                      ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                  }`}
                >
                  {PROVIDER_LABELS[p]?.[config.locale] ?? p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.apiKey')}</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={e => config.setApiKey(e.target.value)}
                className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                placeholder="sk-..."
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                {showKey ? t('welcome.hide') : t('welcome.show')}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.model')}</label>
            {config.provider === 'deepseek' ? (
              <select
                value={config.model}
                onChange={e => config.setModel(e.target.value)}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                <option value="deepseek-v4-pro">deepseek-v4-pro</option>
              </select>
            ) : (
              <input
                type="text"
                value={config.model}
                onChange={e => config.setModel(e.target.value)}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            )}
          </div>

          {config.provider === 'deepseek' && (
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.thinkingMode')}</label>
              <div className="flex gap-2">
                {(['non-thinking', 'thinking', 'thinking_max'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => config.setThinkingMode(mode)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      config.thinkingMode === mode
                        ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                        : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                    }`}
                  >
                    {mode === 'non-thinking' ? t('settings.thinking.non') :
                     mode === 'thinking' ? t('settings.thinking.thinking') :
                     t('settings.thinking.thinking_max')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.baseUrl')}</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={e => config.setBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('settings.proxyUrl')}</label>
            <input
              type="text"
              value={config.proxyUrl}
              onChange={e => config.setProxyUrl(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              placeholder="https://your-worker.workers.dev"
            />
          </div>
        </div>
        )}

        {tab === 'skills' && <SkillsPanel />}

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors">{t('settings.cancel')}</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">{t('settings.save')}</button>
        </div>
    </Modal>
  );
}
