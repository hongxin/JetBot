import type { RuntimeProfile } from '../env/types';
import { profileToPrompt } from '../env/RuntimeDetector';
import type { VirtualFS } from '../tools/VirtualFS';
import defaultSoulMd from './jetbot.md?raw';
import { logger } from '../lib/logger';

const log = logger.module('prompt');

/** Path of the soul file in VirtualFS — user-editable at runtime */
export const SOUL_FILE_PATH = '/jetbot.md';

interface Section {
  key: string;
  priority: number;
  content: string;
}

export class SystemPromptBuilder {
  private sections: Map<string, Section> = new Map();

  constructor() {
    // Minimal fallback identity — will be replaced by loadSoulFile()
    this.setSection('identity', 10,
      'You are JetBot, a browser-based AI coding assistant running entirely inside the user\'s browser tab.'
    );
  }

  /**
   * Load the soul file (jetbot.md) with hybrid strategy:
   *   1. Try VirtualFS (user may have edited it)
   *   2. If not found, seed the default into VirtualFS and use it
   *
   * This makes jetbot.md user-editable via the agent's own edit_file tool,
   * while always having a sensible out-of-the-box default.
   */
  async loadSoulFile(fs: VirtualFS): Promise<void> {
    try {
      await fs.init();
      let content: string;

      if (await fs.exists(SOUL_FILE_PATH)) {
        content = await fs.readFile(SOUL_FILE_PATH);
        log.debug('soul file loaded from VirtualFS');
      } else {
        // First run — seed default into VirtualFS
        await fs.writeFile(SOUL_FILE_PATH, defaultSoulMd);
        content = defaultSoulMd;
        log.info('soul file seeded into VirtualFS', { path: SOUL_FILE_PATH, size: content.length });
      }

      this.setSection('identity', 10, content);
    } catch (err: any) {
      // Fallback to compiled-in default if VirtualFS fails
      log.warn('soul file load failed, using built-in default', { error: err.message });
      this.setSection('identity', 10, defaultSoulMd);
    }
  }

  setSection(key: string, priority: number, content: string): void {
    this.sections.set(key, { key, priority, content });
  }

  removeSection(key: string): void {
    this.sections.delete(key);
  }

  build(): string {
    const sorted = [...this.sections.values()].sort((a, b) => a.priority - b.priority);
    return sorted.map(s => s.content).join('\n\n');
  }

  /**
   * Inject a full runtime environment profile into the prompt.
   * This replaces the old minimal "Environment: Browser" line with
   * a rich, structured description of capabilities and limitations.
   */
  setEnvironmentFromProfile(profile: RuntimeProfile): void {
    this.setSection('environment', 20, profileToPrompt(profile));
  }

  /** Legacy fallback — prefer setEnvironmentFromProfile. */
  setEnvironment(): void {
    const now = new Date().toISOString();
    const info = [
      `Current time: ${now}`,
      `Working directory: /workspace`,
      `Environment: Browser`,
    ];
    this.setSection('environment', 20, `# Environment\n${info.join('\n')}`);
  }

  setToolDescriptions(tools: Array<{ name: string; description: string }>): void {
    if (tools.length === 0) return;
    const list = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n');
    this.setSection('tools', 30, `# Available Tools\n${list}`);
  }

  setSkillMenu(skills: Array<{ name: string; description: string }>): void {
    if (skills.length === 0) return;
    const list = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    this.setSection('skills', 40, `<available_skills>\n${list}\n</available_skills>`);
  }
}
