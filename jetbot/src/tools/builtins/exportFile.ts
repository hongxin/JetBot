import type { Tool } from '../../types/tool';
import type { VirtualFS } from '../VirtualFS';

/**
 * Export a file from VirtualFS to the user's real filesystem via browser download.
 */
export function createExportFile(fs: VirtualFS): Tool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'export_file',
        description:
          'Download a file from the virtual filesystem to the user\'s real filesystem. ' +
          'Triggers a browser download. Use this when the user wants to save their work locally.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path of the file in VirtualFS to export (e.g. "/workspace/main.py").',
            },
            filename: {
              type: 'string',
              description: 'Optional download filename. Defaults to the basename of the path.',
            },
          },
          required: ['path'],
        },
      },
    },
    permission: 'safe',
    requires: ['dom'],

    async execute(params) {
      const path = params.path as string | undefined;
      if (!path || typeof path !== 'string' || path.trim().length === 0) {
        throw new Error('Missing required parameter "path". Provide the VirtualFS file path to export.');
      }

      const content = await fs.readFile(path);
      const basename = (params.filename as string) || path.split('/').pop() || 'download.txt';

      // Dispatch event for UI layer to handle the actual download
      const event = new CustomEvent('jetbot:export', {
        detail: { content, filename: basename, path },
      });
      document.dispatchEvent(event);

      return `Exported "${basename}" (${content.length} bytes). The browser download has been triggered.`;
    },
  };
}
