import type { Tool } from '../../types/tool';

export function createGetSysinfo(): Tool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'get_sysinfo',
        description: 'Get system environment information including browser, platform, screen size, memory, language, and online status.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    permission: 'safe',
    async execute() {
      const nav = navigator;
      const info: string[] = [
        `User Agent: ${nav.userAgent}`,
        `Platform: ${nav.platform}`,
        `Language: ${nav.language}`,
        `Online: ${nav.onLine}`,
        `Cookies: ${nav.cookieEnabled}`,
      ];

      if ('hardwareConcurrency' in nav) {
        info.push(`CPU Cores: ${nav.hardwareConcurrency}`);
      }

      if ('deviceMemory' in nav) {
        info.push(`Device Memory: ${(nav as any).deviceMemory} GB`);
      }

      if (screen) {
        info.push(`Screen: ${screen.width}x${screen.height} @ ${screen.colorDepth}bit`);
      }

      if (innerWidth) {
        info.push(`Viewport: ${innerWidth}x${innerHeight}`);
      }

      // Storage estimates
      if ('storage' in nav && (nav as any).storage?.estimate) {
        try {
          const est = await (nav as any).storage.estimate();
          if (est.quota) {
            info.push(`Storage Quota: ${(est.quota / 1e9).toFixed(1)} GB`);
          }
          if (est.usage) {
            info.push(`Storage Usage: ${(est.usage / 1e6).toFixed(1)} MB`);
          }
        } catch { /* not supported */ }
      }

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      info.push(`Timezone: ${tz}`);

      return info.join('\n');
    },
  };
}
