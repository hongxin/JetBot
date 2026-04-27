import type { Skill, LifecycleStage } from './types';
import { builtinSkills } from './builtins';
import { logger } from '../lib/logger';
import { initDB, put, getAll, del as dbDel } from '../lib/db';

const STORE_NAME = 'skills';

const log = logger.module('skills');

function calcQualityScore(useCount: number, lastUsedAt: string): number {
  let score = 0.3;
  if (useCount > 3) score += 0.2;
  if (useCount > 10) score += 0.2;
  if (useCount > 20) score += 0.15;
  if (lastUsedAt) {
    const daysSince = (Date.now() - new Date(lastUsedAt).getTime()) / 86400000;
    if (daysSince > 30) score -= 0.3;
    if (daysSince > 90) score -= 0.3;
  }
  return Math.max(0, Math.min(1, score));
}

function computeStage(useCount: number, qualityScore: number, lastUsedAt: string): LifecycleStage {
  if (lastUsedAt) {
    const daysSince = (Date.now() - new Date(lastUsedAt).getTime()) / 86400000;
    if (daysSince > 30) return 'stale';
  }
  if (useCount < 3) return 'new';
  if (useCount > 10 && qualityScore > 0.8) return 'stable';
  if (useCount >= 3) return 'active';
  return 'new';
}

function tokenizeForSimilarity(text: string): string[] {
  return text.toLowerCase()
    .split(/[\s,，、()（）\-_]+/)
    .filter(w => w.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private activeSkill: string | null = null;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = initDB()
      .then(() => this.loadFromDB())
      .then(() => {
        for (const skill of builtinSkills) {
          if (!this.skills.has(skill.name)) {
            const seeded: Skill = {
              ...skill,
              tools: [],
              version: 1,
              useCount: 0,
              lastUsedAt: '',
              qualityScore: 0.5,
              lifecycleStage: 'new',
              createdAt: new Date().toISOString(),
              originManual: true,
            };
            this.skills.set(seeded.name, seeded);
            this.persistSkill(seeded).catch(() => {});
          }
        }
        log.info('skill registry initialized', { count: this.skills.size });
      });
  }

  private async loadFromDB(): Promise<void> {
    try {
      const rows = await getAll<Skill>(STORE_NAME);
      for (const row of rows) {
        this.skills.set(row.name, row);
      }
      log.debug('skills loaded from DB', { count: rows.length });
    } catch {
      log.warn('failed to load skills from DB, using builtins only');
    }
  }

  private async persistSkill(skill: Skill): Promise<void> {
    try { await put(STORE_NAME, skill); } catch {}
  }

  async ready(): Promise<void> { return this.dbReady; }

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
    this.persistSkill(skill).catch(() => {});
  }

  activate(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    this.activeSkill = name;
    skill.useCount++;
    skill.lastUsedAt = new Date().toISOString();
    skill.qualityScore = calcQualityScore(skill.useCount, skill.lastUsedAt);
    skill.lifecycleStage = computeStage(skill.useCount, skill.qualityScore, skill.lastUsedAt);
    this.persistSkill(skill).catch(() => {});
    log.info('skill activated', { name });
    return true;
  }

  deactivate(): void {
    if (this.activeSkill) {
      log.info('skill deactivated', { name: this.activeSkill });
    }
    this.activeSkill = null;
  }

  getActive(): Skill | null {
    return this.activeSkill ? this.skills.get(this.activeSkill) ?? null : null;
  }

  getActiveName(): string | null { return this.activeSkill; }

  get(name: string): Skill | undefined { return this.skills.get(name); }

  addSkill(name: string, description: string, triggers: string[], tools: string[], instructions: string, originManual = false): Skill {
    const skill: Skill = {
      name, description,
      trigger: triggers.join(', '),
      instructions,
      tools,
      version: 1,
      useCount: 0,
      lastUsedAt: new Date().toISOString(),
      qualityScore: 0.5,
      lifecycleStage: 'new',
      createdAt: new Date().toISOString(),
      originManual,
    };
    this.skills.set(name, skill);
    this.persistSkill(skill).catch(() => {});
    log.info('skill added', { name });
    return skill;
  }

  findSimilar(candidateName: string, candidateTriggers: string[], candidateDesc: string): { name: string; score: number } | null {
    const candWords = new Set([
      ...tokenizeForSimilarity(candidateName),
      ...candidateTriggers.flatMap(t => tokenizeForSimilarity(t)),
      ...tokenizeForSimilarity(candidateDesc),
    ]);

    let best: { name: string; score: number } | null = null;

    for (const [name, skill] of this.skills) {
      const triggers = (skill.trigger || '').split(',');
      const skillWords = new Set([
        ...tokenizeForSimilarity(name),
        ...triggers.flatMap(t => tokenizeForSimilarity(t)),
        ...tokenizeForSimilarity(skill.description),
      ]);

      const intersection = [...candWords].filter(w => skillWords.has(w)).length;
      const union = new Set([...candWords, ...skillWords]).size;
      if (union === 0) continue;

      const jaccard = intersection / union;
      const nameDist = levenshteinDistance(candidateName, name);
      const nameScore = 1 - nameDist / Math.max(1, candidateName.length, name.length);
      const combined = jaccard * 0.5 + nameScore * 0.5;

      if (combined > 0.4 && (!best || combined > best.score)) {
        best = { name, score: combined };
      }
    }

    return best;
  }

  exportSkill(name: string): string | null {
    const skill = this.skills.get(name);
    if (!skill) return null;
    const toolsStr = (skill.tools ?? []).length > 0 ? `[${skill.tools!.join(', ')}]` : '[]';
    const triggerStr = skill.trigger || '';
    return [
      '---',
      `name: ${skill.name}`,
      `description: ${skill.description}`,
      `trigger: ${triggerStr}`,
      `tools: ${toolsStr}`,
      '---',
      '',
      skill.instructions,
    ].join('\n');
  }

  importSkill(content: string): Skill | null {
    const lines = content.split('\n');
    const fm: Record<string, string> = {};
    let inFM = false;
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (!inFM) { inFM = true; continue; }
        else { bodyStart = i + 1; break; }
      }
      if (inFM) {
        const colon = lines[i].indexOf(':');
        if (colon > 0) {
          fm[lines[i].slice(0, colon).trim()] = lines[i].slice(colon + 1).trim();
        }
      }
    }

    const name = fm['name'];
    if (!name) return null;

    const body = lines.slice(bodyStart).join('\n');
    const toolsStr = fm['tools'] || '[]';
    const tools = toolsStr.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);

    return this.addSkill(
      name,
      fm['description'] || name,
      (fm['trigger'] || '').split(',').map(s => s.trim()).filter(Boolean),
      tools,
      body.trim(),
      true,
    );
  }

  menuText(): string {
    const lines = [...this.skills.values()].map(s =>
      `- **${s.name}**: ${s.description}`
    );
    return `# Available Skills\nActivate with \`/skill <name>\`. Deactivate with \`/skill off\`.\n${lines.join('\n')}`;
  }

  list(): Array<{ name: string; description: string; active: boolean; lifecycleStage: LifecycleStage }> {
    return [...this.skills.values()].map(s => ({
      name: s.name,
      description: s.description,
      active: s.name === this.activeSkill,
      lifecycleStage: s.lifecycleStage,
    }));
  }

  async saveAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      try { await put(STORE_NAME, skill); } catch {}
    }
  }

  remove(name: string): boolean {
    const s = this.skills.get(name);
    if (!s || s.originManual) return false;
    this.skills.delete(name);
    if (this.activeSkill === name) this.activeSkill = null;
    dbDel(STORE_NAME, name).catch(() => {});
    return true;
  }

  countAll(): number { return this.skills.size; }

  usageStats(name: string): { useCount: number; qualityScore: number; stage: LifecycleStage } | null {
    const s = this.skills.get(name);
    if (!s) return null;
    return { useCount: s.useCount, qualityScore: s.qualityScore, stage: s.lifecycleStage };
  }
}
