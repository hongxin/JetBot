import { create } from 'zustand';
import { setLocale, type Locale } from '../lib/i18n';

export interface ProviderPreset {
  provider: string;
  baseUrl: string;
  model: string;
}

export type ThinkingMode = 'non-thinking' | 'thinking' | 'thinking_max';

// Legacy model names that auto-map to V4 equivalents (until 2026-07-24)
const V4_LEGACY_MAP: Record<string, string> = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
};

const PRESETS: Record<string, ProviderPreset> = {
  openai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  deepseek: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
  zhipu: { provider: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5' },
  ollama: { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen3.5:27b' },
  custom: { provider: 'custom', baseUrl: '', model: '' },
};

// Providers that don't require an API key
const KEY_OPTIONAL_PROVIDERS = new Set(['ollama']);

/** Detect if the given model ID is a DeepSeek V4 family model */
export function isDeepSeekV4(model: string): boolean {
  return model.startsWith('deepseek-v4-');
}

/** Resolve legacy model names to their V4 equivalents */
export function resolveLegacyModel(model: string): string {
  return V4_LEGACY_MAP[model] ?? model;
}

interface ConfigState {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  proxyUrl: string;
  locale: Locale;
  thinkingMode: ThinkingMode;
  setProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setBaseUrl: (url: string) => void;
  setProxyUrl: (url: string) => void;
  setLocale: (locale: Locale) => void;
  setThinkingMode: (mode: ThinkingMode) => void;
  applyPreset: (provider: string) => void;
  validate: () => { valid: boolean; errors: string[] };
}

function loadConfig(): Partial<ConfigState> {
  try {
    const saved = localStorage.getItem('jetbot-config');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveConfig(state: Partial<ConfigState>): void {
  try {
    const { provider, apiKey, model, baseUrl, proxyUrl, locale, thinkingMode } = state as ConfigState;
    localStorage.setItem('jetbot-config', JSON.stringify({ provider, apiKey, model, baseUrl, proxyUrl, locale, thinkingMode }));
  } catch { /* private browsing */ }
}

const saved = loadConfig();
const initLocale = (saved.locale as Locale) || (navigator.language.startsWith('zh') ? 'zh' : 'en');
setLocale(initLocale);

export const useConfigStore = create<ConfigState>((set, get) => ({
  provider: saved.provider || 'openai',
  apiKey: saved.apiKey || '',
  model: saved.model || 'gpt-4o',
  baseUrl: saved.baseUrl || 'https://api.openai.com/v1',
  // Default proxy: only in dev, where the Vite dev server provides a /proxy
  // endpoint. In production (e.g. GitHub Pages static hosting) there is no
  // such endpoint — defaulting to origin would POST to a static host and get
  // 405. Production defaults to empty (direct API call); users needing a
  // proxy set it explicitly in Settings.
  proxyUrl: (saved.proxyUrl ?? (import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : '')).trim(),
  locale: initLocale,
  thinkingMode: (saved.thinkingMode as ThinkingMode) || 'non-thinking',

  setProvider: (provider) => set(s => { const n = { ...s, provider }; saveConfig(n); return n; }),
  setApiKey: (apiKey) => set(s => { const n = { ...s, apiKey }; saveConfig(n); return n; }),
  setModel: (model) => set(s => { const n = { ...s, model }; saveConfig(n); return n; }),
  setBaseUrl: (baseUrl) => set(s => { const n = { ...s, baseUrl }; saveConfig(n); return n; }),
  setProxyUrl: (proxyUrl) => set(s => { const n = { ...s, proxyUrl }; saveConfig(n); return n; }),
  setLocale: (locale) => set(s => { setLocale(locale); const n = { ...s, locale }; saveConfig(n); return n; }),
  setThinkingMode: (thinkingMode) => set(s => { const n = { ...s, thinkingMode }; saveConfig(n); return n; }),

  applyPreset: (provider) => {
    const preset = PRESETS[provider] ?? PRESETS.custom;
    set(s => {
      const n = { ...s, provider: preset.provider, baseUrl: preset.baseUrl, model: preset.model };
      saveConfig(n);
      return n;
    });
  },

  validate: () => {
    const state = get();
    const errors: string[] = [];
    if (!state.apiKey && !KEY_OPTIONAL_PROVIDERS.has(state.provider)) errors.push('API Key is required');
    if (!state.baseUrl) errors.push('Base URL is required');
    if (!state.model) errors.push('Model is required');
    return { valid: errors.length === 0, errors };
  },
}));
