import type { Capability, RuntimeProfile, RuntimeType } from './types';
import { logger } from '../lib/logger';

const log = logger.module('runtime');

/**
 * Probes the current runtime environment and returns a structured profile.
 *
 * This is the "self-awareness" layer — the agent uses the resulting profile
 * to understand what it can and cannot do, so it picks tools precisely.
 */
export function detectRuntime(): RuntimeProfile {
  const capabilities = new Set<Capability>();
  const limitations: string[] = [];

  // --- Determine runtime type ---
  const type: RuntimeType = detectRuntimeType();

  if (type === 'browser') {
    // --- Probe browser APIs one by one ---
    probe(capabilities, 'indexeddb', () => !!globalThis.indexedDB);
    probe(capabilities, 'fetch', () => typeof globalThis.fetch === 'function');
    probe(capabilities, 'clipboard', () => !!navigator.clipboard);
    probe(capabilities, 'notifications', () => 'Notification' in globalThis);
    probe(capabilities, 'canvas', () => {
      const c = document.createElement('canvas');
      return !!c.getContext('2d');
    });
    probe(capabilities, 'web-worker', () => typeof Worker !== 'undefined');
    probe(capabilities, 'service-worker', () => 'serviceWorker' in navigator);
    probe(capabilities, 'webrtc', () => typeof RTCPeerConnection !== 'undefined');
    probe(capabilities, 'geolocation', () => 'geolocation' in navigator);
    probe(capabilities, 'speech', () => 'speechSynthesis' in globalThis);
    probe(capabilities, 'local-storage', () => {
      try { localStorage.setItem('__probe__', '1'); localStorage.removeItem('__probe__'); return true; }
      catch { return false; }
    });
    probe(capabilities, 'session-storage', () => {
      try { sessionStorage.setItem('__probe__', '1'); sessionStorage.removeItem('__probe__'); return true; }
      catch { return false; }
    });
    probe(capabilities, 'media-devices', () => !!navigator.mediaDevices);
    probe(capabilities, 'visibility', () => 'visibilityState' in document);
    probe(capabilities, 'crypto', () => !!globalThis.crypto?.subtle);

    // Always available in browser
    capabilities.add('js-eval');
    capabilities.add('dom');
    capabilities.add('css');

    // Known browser limitations (vs Node/OS)
    limitations.push(
      'No real filesystem access — files live in a virtual IndexedDB-backed filesystem',
      'No native shell or OS process execution — shell commands are simulated',
      'Network requests are subject to CORS restrictions',
      'No TCP/UDP socket access',
      'Cannot install or run native binaries',
      'Background execution pauses when the tab is inactive',
      'Total memory is limited by the browser (typically 1-4 GB)',
    );
  }

  // --- Memory ---
  let memoryMB: number | null = null;
  if (type === 'browser' && (performance as any).memory) {
    memoryMB = Math.round((performance as any).memory.jsHeapSizeLimit / 1_048_576);
  }

  // --- Mobile detection ---
  const mobile = type === 'browser' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // --- Screen ---
  const screen = type === 'browser'
    ? { width: globalThis.screen?.width ?? 0, height: globalThis.screen?.height ?? 0 }
    : null;

  const profile: RuntimeProfile = {
    type,
    userAgent: type === 'browser' ? navigator.userAgent : 'N/A',
    capabilities,
    limitations,
    memoryMB,
    mobile,
    visible: type === 'browser' ? document.visibilityState === 'visible' : true,
    screen,
  };

  log.info('runtime detected', {
    type: profile.type,
    capabilities: [...profile.capabilities].sort(),
    mobile: profile.mobile,
    memoryMB: profile.memoryMB,
  });

  return profile;
}

/**
 * Render the profile as a human-readable block for the system prompt.
 */
export function profileToPrompt(profile: RuntimeProfile): string {
  const lines: string[] = [
    '# Runtime Environment',
    '',
    `Type: ${profile.type}`,
    `Platform: ${profile.mobile ? 'Mobile' : 'Desktop'}`,
    `Current time: ${new Date().toISOString()}`,
    `Working directory: /workspace (virtual filesystem)`,
  ];

  if (profile.screen) {
    lines.push(`Screen: ${profile.screen.width}×${profile.screen.height}`);
  }
  if (profile.memoryMB) {
    lines.push(`Memory limit: ~${profile.memoryMB} MB`);
  }

  lines.push('');
  lines.push('## Available Capabilities');
  const capList = [...profile.capabilities].sort();
  for (const cap of capList) {
    lines.push(`- ${capabilityLabel(cap)}`);
  }

  if (profile.limitations.length > 0) {
    lines.push('');
    lines.push('## Limitations');
    for (const lim of profile.limitations) {
      lines.push(`- ${lim}`);
    }
  }

  lines.push('');
  lines.push('## Guidance');
  lines.push('You are running inside a browser tab. Leverage browser-native capabilities:');
  lines.push('- Use `js_eval` to compute, transform data, test algorithms — it is your REPL');
  lines.push('- Use `render_html` to create visual output (charts, diagrams, styled content)');
  lines.push('- File operations work on a virtual filesystem persisted in IndexedDB');
  lines.push('- Network requests go through fetch (CORS restrictions apply)');
  lines.push('- Do NOT attempt to run Node.js, pip, or native OS commands');

  return lines.join('\n');
}

// --- Helpers ---

function detectRuntimeType(): RuntimeType {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return 'browser';
  if (typeof (globalThis as Record<string, unknown>).WorkerGlobalScope !== 'undefined') return 'worker';
  const g = globalThis as Record<string, unknown>;
  if (typeof g.process !== 'undefined' && (g.process as { versions?: { node?: string } })?.versions?.node) return 'node';
  return 'unknown';
}

function probe(set: Set<Capability>, cap: Capability, test: () => boolean): void {
  try {
    if (test()) {
      set.add(cap);
    }
  } catch {
    // Probe failed — capability not available
  }
}

function capabilityLabel(cap: Capability): string {
  const labels: Record<Capability, string> = {
    'indexeddb': 'IndexedDB — persistent key-value storage',
    'fetch': 'Fetch API — HTTP requests (CORS-bound)',
    'clipboard': 'Clipboard — read/write system clipboard',
    'notifications': 'Notifications — browser push notifications',
    'canvas': 'Canvas 2D — drawing, charts, image manipulation',
    'web-worker': 'Web Workers — background thread computation',
    'service-worker': 'Service Worker — offline / caching',
    'webrtc': 'WebRTC — peer-to-peer communication',
    'geolocation': 'Geolocation — GPS / location data',
    'speech': 'Speech Synthesis — text-to-speech',
    'local-storage': 'localStorage — synchronous key-value (5 MB limit)',
    'session-storage': 'sessionStorage — per-tab key-value',
    'js-eval': 'JavaScript Execution — run code directly in the browser',
    'dom': 'DOM — create and manipulate HTML elements',
    'css': 'CSS / CSSOM — styling and layout',
    'media-devices': 'Media Devices — camera and microphone access',
    'visibility': 'Page Visibility — detect tab active/hidden',
    'crypto': 'Web Crypto — hashing, encryption, key generation',
  };
  return labels[cap] ?? cap;
}
