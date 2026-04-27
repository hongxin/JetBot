import type { Tool } from '../../types/tool';

export function createGetTime(): Tool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'get_time',
        description: 'Get the current date and time with timezone information. Returns formatted local time, UTC time, timezone offset, and day of week.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    permission: 'safe',
    async execute() {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -now.getTimezoneOffset() / 60;
      const tzStr = `UTC${offset >= 0 ? '+' : ''}${offset}`;
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return [
        `Local: ${now.toLocaleString()}`,
        `UTC: ${now.toISOString()}`,
        `Timezone: ${tz} (${tzStr})`,
        `Day: ${days[now.getDay()]}`,
        `Timestamp: ${now.getTime()} (${Math.floor(now.getTime() / 1000)} unix)`,
      ].join('\n');
    },
  };
}
