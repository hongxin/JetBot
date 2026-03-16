export interface CosmosNode {
  id: string;
  kind: 'user' | 'assistant' | 'tool';
  content: string;                         // user/assistant text; tool result
  toolName: string;                        // only meaningful for tool nodes
  params: Record<string, unknown>;         // only meaningful for tool nodes
  isError: boolean;
  status: 'idle' | 'running' | 'done' | 'error';
  x: number;
  y: number;
  radius: number;
  turnId: number;                          // groups user→assistant→tools
  timestamp: number;
  birthTime: number;
}

export interface CosmosEdge {
  id: string;
  fromId: string;
  toId: string;
  type: 'auto' | 'cross-turn' | 'manual';
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
};

export const DEFAULT_HUE = 210;

export function getNodeHue(node: CosmosNode): number {
  if (node.kind === 'tool') return TOOL_HUE[node.toolName] ?? DEFAULT_HUE;
  return KIND_HUE[node.kind] ?? DEFAULT_HUE;
}
