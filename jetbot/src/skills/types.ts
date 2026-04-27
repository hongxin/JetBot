// jetbot/src/skills/types.ts

export type LifecycleStage = 'new' | 'active' | 'stable' | 'stale' | 'deprecated';

export interface Skill {
  /** Unique identifier, e.g. 'code-review' */
  name: string;
  /** One-line description for the skill menu */
  description: string;
  /** Triggers to auto-suggest this skill (comma-separated or string array) */
  trigger?: string;
  /** Full instructions injected into system prompt when active */
  instructions: string;
  /** Tools this skill typically uses */
  tools?: string[];

  // ── Lifecycle fields ──
  version: number;
  useCount: number;
  lastUsedAt: string;       // ISO date
  qualityScore: number;     // 0.0–1.0
  lifecycleStage: LifecycleStage;
  createdAt: string;
  originManual: boolean;    // true = built-in or user-imported, false = distilled
}
