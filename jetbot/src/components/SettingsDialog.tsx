import { useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useAgentStore } from '../store/agentStore';
import { useT } from '../lib/i18n';
import { Modal } from './shared/Modal';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', deepseek: 'DeepSeek', zhipu: 'ZhipuAI', ollama: 'Ollama', custom: 'Custom',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const config = useConfigStore();
  const { initAgent, destroyAgent } = useAgentStore();
  const [showKey, setShowKey] = useState(false);
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

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md" title={t('settings.title')}>
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
                  {PROVIDER_LABELS[p] ?? p}
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
            <input
              type="text"
              value={config.model}
              onChange={e => config.setModel(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

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

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors">{t('settings.cancel')}</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">{t('settings.save')}</button>
        </div>
    </Modal>
  );
}
