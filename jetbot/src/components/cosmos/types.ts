export type CosmosNodeKind = 'user' | 'assistant' | 'tool' | 'memory' | 'skill';

export type MemoryCategory = 'preference' | 'project' | 'decision' | 'fact';

export interface CosmosNode {
  id: string;
  kind: CosmosNodeKind;
  content: string;                         // user/assistant text; tool result; memory content; skill description
  toolName: string;                        // only meaningful for tool nodes
  params: Record<string, unknown>;         // only meaningful for tool nodes
  isError: boolean;
  // 'archived' indicates a memory was removed from MemoryStore but kept as historical trace
  status: 'idle' | 'running' | 'done' | 'error' | 'archived';
  x: number;
  y: number;
  radius: number;
  turnId: number;                          // groups user→assistant→tools
  timestamp: number;
  birthTime: number;

  // memory-only
  memoryId?: number;
  memoryCategory?: MemoryCategory;

  // skill-only
  skillName?: string;
  skillDescription?: string;
  skillTriggers?: string[];
  skillTools?: string[];
  skillInstructions?: string;
}

export interface CosmosEdge {
  id: string;
  fromId: string;
  toId: string;
  type: 'auto' | 'cross-turn' | 'manual' | 'derives';
  manualPrompt?: string;
}

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number; // 0.1 ~ 5.0
}

// Tool → hue mapping
export const TOOL_HUE: Record<string, number> = {
  write_file: 160,
  read_file: 200,
  edit_file: 280,
  js_eval: 45,
  render_html: 320,
  shell_execute: 30,
  search_text: 180,
  http_get: 220,
  list_dir: 140,
  export_file: 100,
};

// Kind → hue
export const KIND_HUE: Record<string, number> = {
  user: 30,       // warm orange
  assistant: 260, // purple
  memory: 170,    // teal — sediment of facts
  skill: 42,      // amber — crystallized capability
};

export const DEFAULT_HUE = 210;

export function getNodeHue(node: CosmosNode): number {
  if (node.kind === 'tool') return TOOL_HUE[node.toolName] ?? DEFAULT_HUE;
  return KIND_HUE[node.kind] ?? DEFAULT_HUE;
}
