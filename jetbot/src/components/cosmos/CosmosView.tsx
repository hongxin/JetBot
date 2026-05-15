import { useRef, useEffect, useState, useCallback, useMemo, type PointerEvent as RPointerEvent } from 'react';
import { useCosmosStore } from '../../store/cosmosStore';
import { CosmosCanvas } from './CosmosCanvas';
import { InputBar } from '../InputBar';
import { useT, type TranslationKey } from '../../lib/i18n';
import { getNodeHue } from './types';
import type { CosmosNode } from './types';
import { marked } from 'marked';

export function CosmosView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CosmosCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const nodes = useCosmosStore((s) => s.nodes);
  const edges = useCosmosStore((s) => s.edges);
  const viewport = useCosmosStore((s) => s.viewport);
  const selectedNodeId = useCosmosStore((s) => s.selectedNodeId);
  const dragConnectFrom = useCosmosStore((s) => s.dragConnectFrom);

  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState<{ x: number; y: number } | null>(null);

  // Init canvas engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new CosmosCanvas(canvasRef.current);
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  // Sync data to engine
  useEffect(() => { engineRef.current?.setNodes(nodes); }, [nodes]);
  useEffect(() => { engineRef.current?.setEdges(edges); }, [edges]);
  useEffect(() => { engineRef.current?.setViewport(viewport); }, [viewport]);
  useEffect(() => { if (engineRef.current) engineRef.current.hoverNodeId = hoverNodeId; }, [hoverNodeId]);

  // Track card position from canvas simulation (rAF loop)
  useEffect(() => {
    if (!selectedNodeId || !engineRef.current) {
      setCardPos(null);
      return;
    }
    let running = true;
    const update = () => {
      if (!running || !engineRef.current) return;
      const pos = engineRef.current.getNodeWorldPos(selectedNodeId);
      if (pos) {
        const [sx, sy] = engineRef.current.worldToScreen(pos.x, pos.y);
        setCardPos({ x: sx, y: sy });
      }
      requestAnimationFrame(update);
    };
    update();
    return () => { running = false; };
  }, [selectedNodeId, viewport]);

  // --- Mouse handlers ---
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const isDraggingEdge = useRef(false);
  const isDraggingNode = useRef<string | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Edge-ring hit → drag-connect
    const edgeHit = engine.hitTestEdge(sx, sy);
    if (edgeHit) {
      isDraggingEdge.current = true;
      useCosmosStore.getState().setDragConnectFrom(edgeHit.id);
      const pos = engine.getNodeWorldPos(edgeHit.id);
      if (pos) {
        const [fromSx, fromSy] = engine.worldToScreen(pos.x, pos.y);
        engine.dragLine = { fromX: fromSx, fromY: fromSy, toX: sx, toY: sy };
      }
      return;
    }

    // Node center hit → select + start drag
    const hit = engine.hitTest(sx, sy);
    if (hit) {
      useCosmosStore.getState().selectNode(hit.id);
      isDraggingNode.current = hit.id;
      const [wx, wy] = engine.screenToWorld(sx, sy);
      engine.pinNode(hit.id, wx, wy);
      return;
    }

    // Empty → pan
    useCosmosStore.getState().selectNode(null);
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Drag-connect line
    if (isDraggingEdge.current && engine.dragLine) {
      engine.dragLine.toX = sx;
      engine.dragLine.toY = sy;
      return;
    }

    // Drag node
    if (isDraggingNode.current) {
      const [wx, wy] = engine.screenToWorld(sx, sy);
      engine.pinNode(isDraggingNode.current, wx, wy);
      return;
    }

    // Pan
    if (isPanning.current) {
      const vp = useCosmosStore.getState().viewport;
      const dx = (e.clientX - panStart.current.x) / vp.zoom;
      const dy = (e.clientY - panStart.current.y) / vp.zoom;
      useCosmosStore.getState().setViewport({
        offsetX: vp.offsetX + dx,
        offsetY: vp.offsetY + dy,
      });
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover
    const hit = engine.hitTest(sx, sy);
    setHoverNodeId(hit?.id ?? null);
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;

    // End drag-connect
    if (isDraggingEdge.current && engine) {
      isDraggingEdge.current = false;
      engine.dragLine = null;
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = engine.hitTest(sx, sy);
      if (hit) {
        useCosmosStore.getState().completeDragConnect(hit.id);
      } else {
        useCosmosStore.getState().setDragConnectFrom(null);
      }
      return;
    }

    // End node drag
    if (isDraggingNode.current && engine) {
      engine.unpinNode(isDraggingNode.current);
      isDraggingNode.current = null;
      return;
    }

    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const vp = useCosmosStore.getState().viewport;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, vp.zoom * factor));

    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const wxBefore = (mx - w / 2) / vp.zoom - vp.offsetX;
    const wyBefore = (my - h / 2) / vp.zoom - vp.offsetY;
    const newOffsetX = (mx - w / 2) / newZoom - wxBefore;
    const newOffsetY = (my - h / 2) / newZoom - wyBefore;

    useCosmosStore.getState().setViewport({ zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY });
  }, []);

  // Touch support
  const touchRef = useRef<{ x: number; y: number; dist: number }>({ x: 0, y: 0, dist: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isPanning.current = true;
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      touchRef.current = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
      };
      isPanning.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning.current) {
      const t0 = e.touches[0];
      const vp = useCosmosStore.getState().viewport;
      const dx = (t0.clientX - panStart.current.x) / vp.zoom;
      const dy = (t0.clientY - panStart.current.y) / vp.zoom;
      useCosmosStore.getState().setViewport({ offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy });
      panStart.current = { x: t0.clientX, y: t0.clientY };
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = dist / touchRef.current.dist;
      const vp = useCosmosStore.getState().viewport;
      useCosmosStore.getState().setViewport({ zoom: Math.max(0.1, Math.min(5, vp.zoom * scale)) });
      touchRef.current.dist = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => { isPanning.current = false; }, []);

  // Fit all
  const handleFitAll = useCallback(() => {
    const vp = engineRef.current?.fitAll();
    if (vp) useCosmosStore.getState().setViewport(vp);
  }, []);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const cursorStyle = isDraggingNode.current ? 'cursor-grabbing' : hoverNodeId ? 'cursor-pointer' : dragConnectFrom ? 'cursor-crosshair' : 'cursor-grab';

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 relative">
      <div
        className={`flex-1 min-h-0 relative ${cursorStyle}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-[hsl(var(--muted-foreground))] animate-pulse">
              <div className="text-4xl mb-4">✦</div>
              <p>{t('cosmos.empty' as TranslationKey)}</p>
            </div>
          </div>
        )}

        {/* Fit all */}
        {nodes.length > 0 && (
          <button
            onClick={handleFitAll}
            className="absolute top-3 right-3 px-2 py-1 text-xs rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            ⊞ Fit
          </button>
        )}

        {/* Floating detail card */}
        {selectedNode && cardPos && (
          <NodeCard
            node={selectedNode}
            x={cardPos.x}
            y={cardPos.y}
            containerHeight={containerRef.current?.clientHeight ?? 600}
            onClose={() => useCosmosStore.getState().selectNode(null)}
          />
        )}
      </div>

      <InputBar />
    </div>
  );
}

// --- Floating detail card ---

const MIN_CARD_W = 240;
const MAX_CARD_W = 800;
const MIN_CARD_H = 120;
const MAX_CARD_H = 600;
const DEFAULT_CARD_W = 340;

const DEFAULT_CARD_H: Record<string, number> = {
  user: 180, assistant: 220, tool: 280, memory: 220, skill: 320,
};

const MEMORY_CAT_HUE: Record<string, number> = {
  preference: 30, project: 200, decision: 280, fact: 170,
};

function NodeCard({
  node,
  x,
  y,
  containerHeight,
  onClose,
}: {
  node: CosmosNode;
  x: number;
  y: number;
  containerHeight: number;
  onClose: () => void;
}) {
  const hue = getNodeHue(node);
  const [size, setSize] = useState({ w: DEFAULT_CARD_W, h: DEFAULT_CARD_H[node.kind] ?? 200 });
  const resizing = useRef<{ edge: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const showBelow = y + 50 + size.h < containerHeight;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: Math.max(8, Math.min(x - size.w / 2, window.innerWidth - size.w - 8)),
    top: showBelow ? y + 45 : y - size.h - 15,
    width: size.w,
    height: size.h,
    borderColor: `hsla(${hue}, 70%, 50%, 0.5)`,
  };

  const onResizeStart = useCallback((edge: string, e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { edge, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [size]);

  const onResizeMove = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    if (!resizing.current) return;
    const { edge, startX, startY, startW, startH } = resizing.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let w = startW, h = startH;
    if (edge.includes('r')) w = startW + dx;
    if (edge.includes('l')) w = startW - dx;
    if (edge.includes('b')) h = startH + dy;
    if (edge.includes('t')) h = startH - dy;
    setSize({
      w: Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, w)),
      h: Math.max(MIN_CARD_H, Math.min(MAX_CARD_H, h)),
    });
  }, []);

  const onResizeEnd = useCallback(() => { resizing.current = null; }, []);

  const kindLabel =
    node.kind === 'user' ? '👤 User' :
    node.kind === 'assistant' ? '✦ Assistant' :
    node.kind === 'tool' ? `⚙ ${node.toolName}` :
    node.kind === 'memory' ? `💧 Memory` :
    node.kind === 'skill' ? `◈ Skill` : node.kind;
  const statusIcon =
    node.status === 'done' ? '✓' :
    node.status === 'error' ? '✗' :
    node.status === 'running' ? '⟳' :
    node.status === 'archived' ? '⊘' : '';
  const statusColor =
    node.status === 'done' ? 'text-green-400' :
    node.status === 'error' ? 'text-red-400' :
    node.status === 'running' ? 'text-yellow-400' :
    node.status === 'archived' ? 'text-white/40' : '';

  // Shared props for resize handles
  const handleProps = (edge: string, cursor: string, pos: React.CSSProperties) => ({
    style: { position: 'absolute' as const, cursor, ...pos },
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => onResizeStart(edge, e),
    onPointerMove: onResizeMove,
    onPointerUp: onResizeEnd,
  });

  return (
    <div
      style={style}
      className="rounded-lg border bg-[hsl(230,20%,12%)] shadow-xl backdrop-blur-sm z-10 text-sm flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }} />
          <span className="font-medium text-white/90">{kindLabel}</span>
          {statusIcon && <span className={statusColor}>{statusIcon}</span>}
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-lg leading-none">×</button>
      </div>

      {/* Content — kind-specific rendering */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {node.kind === 'tool' ? (
          <>
            <div className="px-3 py-2 border-b border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Params</div>
              <pre className="text-xs font-mono text-white/60 whitespace-pre-wrap break-all">
                {JSON.stringify(node.params, null, 2)}
              </pre>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Result</div>
              <pre className={`text-xs font-mono whitespace-pre-wrap break-all ${node.isError ? 'text-red-400' : 'text-green-400/80'}`}>
                {node.content || (node.status === 'running' ? 'Running...' : '—')}
              </pre>
            </div>
          </>
        ) : node.kind === 'memory' ? (
          <MemoryCardBody node={node} />
        ) : node.kind === 'skill' ? (
          <SkillCardBody node={node} />
        ) : (
          <MarkdownContent content={node.content || '...'} />
        )}
      </div>

      {/* Resize handles — edges */}
      <div {...handleProps('r', 'ew-resize', { top: 0, right: -3, bottom: 0, width: 6 })} />
      <div {...handleProps('l', 'ew-resize', { top: 0, left: -3, bottom: 0, width: 6 })} />
      <div {...handleProps('b', 'ns-resize', { bottom: -3, left: 0, right: 0, height: 6 })} />
      <div {...handleProps('t', 'ns-resize', { top: -3, left: 0, right: 0, height: 6 })} />
      {/* Resize handles — corners */}
      <div {...handleProps('rb', 'nwse-resize', { bottom: -4, right: -4, width: 10, height: 10 })} />
      <div {...handleProps('lb', 'nesw-resize', { bottom: -4, left: -4, width: 10, height: 10 })} />
      <div {...handleProps('rt', 'nesw-resize', { top: -4, right: -4, width: 10, height: 10 })} />
      <div {...handleProps('lt', 'nwse-resize', { top: -4, left: -4, width: 10, height: 10 })} />
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content, { async: false }) as string, [content]);
  return (
    <div
      className="cosmos-md px-3 py-2 text-xs text-white/70"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MemoryCardBody({ node }: { node: CosmosNode }) {
  const cat = node.memoryCategory ?? 'fact';
  const catHue = MEMORY_CAT_HUE[cat] ?? 170;
  const archived = node.status === 'archived';
  return (
    <div className={`px-3 py-2 space-y-2 ${archived ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `hsla(${catHue}, 60%, 40%, 0.3)`, color: `hsl(${catHue}, 80%, 75%)` }}
        >
          {cat}
        </span>
        <span className="text-[10px] text-white/40">
          {new Date(node.timestamp).toLocaleString()}
        </span>
        {archived && <span className="text-[10px] text-white/40 ml-auto">archived</span>}
      </div>
      <MarkdownContent content={node.content || '...'} />
    </div>
  );
}

function SkillCardBody({ node }: { node: CosmosNode }) {
  const [expanded, setExpanded] = useState(false);
  const triggers = node.skillTriggers ?? [];
  const tools = node.skillTools ?? [];
  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono text-amber-300/90">{node.skillName ?? '—'}</code>
      </div>
      {node.skillDescription && (
        <p className="text-xs text-white/75 leading-relaxed">{node.skillDescription}</p>
      )}
      {triggers.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Triggers</span>
          {triggers.map(t => (
            <code key={t} className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/80">{t}</code>
          ))}
        </div>
      )}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Tools</span>
          {tools.map(t => (
            <code key={t} className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/80">{t}</code>
          ))}
        </div>
      )}
      {node.skillInstructions && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] uppercase tracking-wider text-white/50 hover:text-white/80"
          >
            {expanded ? '▾ Instructions' : '▸ Instructions'}
          </button>
          {expanded && <MarkdownContent content={node.skillInstructions} />}
        </div>
      )}
    </div>
  );
}
