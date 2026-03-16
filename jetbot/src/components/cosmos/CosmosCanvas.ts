import type { CosmosNode, CosmosEdge, Viewport } from './types';
import { getNodeHue } from './types';

// --- Force simulation types ---

interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  layer: number;
  alpha: number;
  twinkle: boolean;
}

interface EdgeParticle {
  edgeId: string;
  t: number;
}

// --- Constants ---

const PARALLAX = [0.1, 0.3, 0.6];
const MAX_PARTICLES = 50;

// Force simulation parameters
const REPULSION = 6000;
const EDGE_SPRING = 0.006;
const EDGE_REST_LENGTH = 160;
const CENTER_PULL = 0.0008;
const DAMPING = 0.82;
const MAX_VELOCITY = 12;
const COOLING_THRESHOLD = 0.05;
const CROSS_TURN_SPRING = 0.002;
const CROSS_TURN_REST_LENGTH = 280;

export class CosmosCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private animId = 0;

  private nodes: CosmosNode[] = [];
  private edges: CosmosEdge[] = [];
  private viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };

  // Force simulation state (owned by canvas, not store)
  private sim: Map<string, SimNode> = new Map();
  private simCooled = false;

  private stars: Star[] = [];
  private particles: EdgeParticle[] = [];
  private startTime = performance.now();

  // Drag line state
  public dragLine: { fromX: number; fromY: number; toX: number; toY: number } | null = null;

  // Hover node id (set externally by CosmosView)
  public hoverNodeId: string | null = null;

  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
    this.initStars();
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    this.resizeObserver.disconnect();
  }

  // --- Data setters ---

  setNodes(nodes: CosmosNode[]) {
    const newIds = new Set(nodes.map((n) => n.id));

    // Remove sim nodes that no longer exist
    for (const id of this.sim.keys()) {
      if (!newIds.has(id)) this.sim.delete(id);
    }

    // Add new sim nodes (preserve existing positions)
    for (const n of nodes) {
      if (!this.sim.has(n.id)) {
        this.sim.set(n.id, {
          x: n.x,
          y: n.y,
          vx: 0,
          vy: 0,
          radius: n.radius,
          pinned: false,
        });
        this.simCooled = false; // new node → reheat simulation
      }
    }

    this.nodes = nodes;
  }

  setEdges(edges: CosmosEdge[]) {
    this.edges = edges;
    this.simCooled = false; // new edge → reheat

    // Sync particles
    for (const e of edges) {
      const existing = this.particles.filter((p) => p.edgeId === e.id);
      if (existing.length === 0 && this.particles.length < MAX_PARTICLES) {
        const count = Math.min(4, MAX_PARTICLES - this.particles.length);
        for (let i = 0; i < count; i++) {
          this.particles.push({ edgeId: e.id, t: i / count });
        }
      }
    }
    const edgeIds = new Set(edges.map((e) => e.id));
    this.particles = this.particles.filter((p) => edgeIds.has(p.edgeId));
  }

  setViewport(vp: Viewport) {
    this.viewport = vp;
  }

  /** Get a node's current world position (from simulation) */
  getNodeWorldPos(id: string): { x: number; y: number } | null {
    const s = this.sim.get(id);
    return s ? { x: s.x, y: s.y } : null;
  }

  /** Pin a node at a given world position (for dragging) */
  pinNode(id: string, wx: number, wy: number) {
    const s = this.sim.get(id);
    if (s) {
      s.x = wx;
      s.y = wy;
      s.vx = 0;
      s.vy = 0;
      s.pinned = true;
    }
  }

  unpinNode(id: string) {
    const s = this.sim.get(id);
    if (s) s.pinned = false;
  }

  /** Fit all nodes in view */
  fitAll(): Viewport | null {
    if (this.sim.size === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of this.sim.values()) {
      minX = Math.min(minX, s.x - s.radius);
      maxX = Math.max(maxX, s.x + s.radius);
      minY = Math.min(minY, s.y - s.radius);
      maxY = Math.max(maxY, s.y + s.radius);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rangeX = maxX - minX + 100;
    const rangeY = maxY - minY + 100;
    const zoom = Math.min(1.5, Math.min(this.width / rangeX, this.height / rangeY));
    return { offsetX: -cx, offsetY: -cy, zoom };
  }

  // --- Coordinate transforms ---

  worldToScreen(wx: number, wy: number): [number, number] {
    const { offsetX, offsetY, zoom } = this.viewport;
    return [
      (wx + offsetX) * zoom + this.width / 2,
      (wy + offsetY) * zoom + this.height / 2,
    ];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    const { offsetX, offsetY, zoom } = this.viewport;
    return [
      (sx - this.width / 2) / zoom - offsetX,
      (sy - this.height / 2) / zoom - offsetY,
    ];
  }

  hitTest(sx: number, sy: number): CosmosNode | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const s = this.sim.get(n.id);
      if (!s) continue;
      const dx = wx - s.x;
      const dy = wy - s.y;
      if (dx * dx + dy * dy <= s.radius * s.radius) return n;
    }
    return null;
  }

  hitTestEdge(sx: number, sy: number): CosmosNode | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const s = this.sim.get(n.id);
      if (!s) continue;
      const dx = wx - s.x;
      const dy = wy - s.y;
      const dist2 = dx * dx + dy * dy;
      const inner = s.radius * 0.7;
      if (dist2 >= inner * inner && dist2 <= s.radius * s.radius) return n;
    }
    return null;
  }

  // --- Force-directed simulation ---

  private tickSimulation() {
    if (this.simCooled || this.sim.size < 2) return;

    const simArr = Array.from(this.sim.entries());
    let totalEnergy = 0;

    // Repulsion (all pairs)
    for (let i = 0; i < simArr.length; i++) {
      for (let j = i + 1; j < simArr.length; j++) {
        const [, a] = simArr[i];
        const [, b] = simArr[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 1; }

        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
        if (!b.pinned) { b.vx += fx; b.vy += fy; }
      }
    }

    // Edge spring attraction
    for (const edge of this.edges) {
      const a = this.sim.get(edge.fromId);
      const b = this.sim.get(edge.toId);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const spring = edge.type === 'cross-turn' ? CROSS_TURN_SPRING : EDGE_SPRING;
      const rest = edge.type === 'cross-turn' ? CROSS_TURN_REST_LENGTH : EDGE_REST_LENGTH;
      const force = spring * (dist - rest);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    }

    // Centering + damping + apply
    for (const [, s] of simArr) {
      if (s.pinned) continue;

      s.vx -= s.x * CENTER_PULL;
      s.vy -= s.y * CENTER_PULL;

      s.vx *= DAMPING;
      s.vy *= DAMPING;

      // Clamp velocity
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (speed > MAX_VELOCITY) {
        s.vx = (s.vx / speed) * MAX_VELOCITY;
        s.vy = (s.vy / speed) * MAX_VELOCITY;
      }

      s.x += s.vx;
      s.y += s.vy;

      totalEnergy += s.vx * s.vx + s.vy * s.vy;
    }

    if (totalEnergy < COOLING_THRESHOLD) {
      this.simCooled = true;
    }
  }

  // --- Internal rendering ---

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = window.devicePixelRatio || 1;
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private initStars() {
    this.stars = [];
    for (let i = 0; i < 300; i++) {
      this.stars.push({
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: Math.random() * 1.8 + 0.3,
        layer: Math.floor(Math.random() * 3),
        alpha: Math.random() * 0.6 + 0.2,
        twinkle: Math.random() < 0.1,
      });
    }
  }

  private loop = () => {
    this.tickSimulation();
    this.render();
    this.animId = requestAnimationFrame(this.loop);
  };

  private render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = performance.now();
    const time = (now - this.startTime) / 1000;

    // Background
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, 'hsl(230, 20%, 8%)');
    bg.addColorStop(1, 'hsl(230, 15%, 3%)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.renderStars(ctx, time);
    this.renderEdges(ctx);
    if (this.dragLine) this.renderDragLine(ctx);
    this.renderNodes(ctx, now);
  }

  private renderStars(ctx: CanvasRenderingContext2D, time: number) {
    const { offsetX, offsetY, zoom } = this.viewport;
    const w = this.width;
    const h = this.height;

    for (const star of this.stars) {
      const pf = PARALLAX[star.layer];
      const sx = (star.x + offsetX * pf) * zoom + w / 2;
      const sy = (star.y + offsetY * pf) * zoom + h / 2;
      if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) continue;

      let alpha = star.alpha;
      if (star.twinkle) {
        alpha *= 0.5 + 0.5 * Math.sin(time * 2 + star.x * 0.01);
      }

      ctx.beginPath();
      ctx.arc(sx, sy, star.size * zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
      ctx.fill();
    }
  }

  private getSimPos(id: string): { x: number; y: number } {
    const s = this.sim.get(id);
    return s ?? { x: 0, y: 0 };
  }

  private renderEdges(ctx: CanvasRenderingContext2D) {
    for (const edge of this.edges) {
      const fromPos = this.getSimPos(edge.fromId);
      const toPos = this.getSimPos(edge.toId);

      const [x1, y1] = this.worldToScreen(fromPos.x, fromPos.y);
      const [x2, y2] = this.worldToScreen(toPos.x, toPos.y);

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = len * 0.2;
      const cx = mx + nx * offset;
      const cy = my + ny * offset;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);

      if (edge.type === 'auto') {
        ctx.strokeStyle = 'hsla(200, 60%, 50%, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
      } else if (edge.type === 'cross-turn') {
        ctx.strokeStyle = 'hsla(200, 40%, 45%, 0.15)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 6]);
      } else {
        ctx.strokeStyle = 'hsla(45, 80%, 60%, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Flow particles
      const edgeParticles = this.particles.filter((p) => p.edgeId === edge.id);
      const particleSpeed = edge.type === 'cross-turn' ? 0.002 : 0.003;
      const particleAlpha = edge.type === 'cross-turn' ? 0.4 : 0.8;
      for (const p of edgeParticles) {
        p.t = (p.t + particleSpeed) % 1;
        const pt = this.bezierPt(x1, y1, cx, cy, x2, y2, p.t);
        const hue = edge.type === 'manual' ? 45 : 200;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${particleAlpha})`;
        ctx.fill();
      }
    }
  }

  private bezierPt(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
    const u = 1 - t;
    return { x: u * u * x1 + 2 * u * t * cx + t * t * x2, y: u * u * y1 + 2 * u * t * cy + t * t * y2 };
  }

  private renderDragLine(ctx: CanvasRenderingContext2D) {
    const dl = this.dragLine!;
    const mx = (dl.fromX + dl.toX) / 2;
    const my = (dl.fromY + dl.toY) / 2;
    const dx = dl.toX - dl.fromX;
    const dy = dl.toY - dl.fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = mx + (-dy / len) * len * 0.2;
    const cy = my + (dx / len) * len * 0.2;

    ctx.beginPath();
    ctx.moveTo(dl.fromX, dl.fromY);
    ctx.quadraticCurveTo(cx, cy, dl.toX, dl.toY);
    ctx.strokeStyle = 'hsla(45, 90%, 65%, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderNodes(ctx: CanvasRenderingContext2D, now: number) {
    const { zoom } = this.viewport;

    for (const node of this.nodes) {
      const simPos = this.getSimPos(node.id);
      const [sx, sy] = this.worldToScreen(simPos.x, simPos.y);

      // Off-screen culling
      const screenR = node.radius * zoom * 3;
      if (sx < -screenR || sx > this.width + screenR || sy < -screenR || sy > this.height + screenR) continue;

      const hue = getNodeHue(node);
      const age = now - node.birthTime;
      const birthProgress = Math.min(1, age / 1200);
      const eased = 1 - Math.pow(1 - birthProgress, 3);
      const r = node.radius * zoom * eased;
      if (r < 0.5) continue;

      const isHovered = this.hoverNodeId === node.id;

      // --- Outer glow ---
      const glowR = r * (isHovered ? 3.0 : 2.5);
      const glow = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, glowR);
      glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${isHovered ? 0.4 : 0.25})`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Birth pulse
      if (birthProgress < 1) {
        const pulseAlpha = Math.sin(birthProgress * Math.PI * 2) * 0.3;
        if (pulseAlpha > 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, r * (1 + birthProgress * 0.8), 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${pulseAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Running breathing
      if (node.status === 'running') {
        const breath = 1 + 0.08 * Math.sin(now / 500);
        ctx.beginPath();
        ctx.arc(sx, sy, r * breath * 1.3, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.2)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Error shake
      let drawX = sx;
      if (node.status === 'error' || node.isError) {
        drawX += Math.sin(now / 50) * 2;
      }

      const fillHue = (node.status === 'error' || node.isError) ? 0 : hue;

      // --- Inner circle ---
      ctx.beginPath();
      ctx.arc(drawX, sy, r, 0, Math.PI * 2);
      const alpha = node.kind === 'tool' ? 0.8 : 0.7;
      const lightness = node.kind === 'user' ? 55 : node.kind === 'assistant' ? 45 : 50;
      ctx.fillStyle = `hsla(${fillHue}, 65%, ${lightness}%, ${alpha})`;
      ctx.fill();

      // --- Border ring ---
      ctx.beginPath();
      ctx.arc(drawX, sy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${fillHue}, 90%, 70%, ${isHovered ? 1 : 0.7})`;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // --- Kind icon inside (small, centered) ---
      if (r > 8) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconSize = Math.max(10, r * 0.5);

        if (node.kind === 'user') {
          // User icon: small person silhouette → just use emoji-like char
          ctx.font = `${iconSize}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText('👤', drawX, sy - 1);
        } else if (node.kind === 'assistant') {
          ctx.font = `${iconSize}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText('✦', drawX, sy - 1);
        } else {
          // Tool: show a small gear-like dot
          ctx.font = `${iconSize * 0.8}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText('⚙', drawX, sy - 1);
        }
      }

      // --- Label below ---
      if (r > 10) {
        ctx.font = `${Math.max(9, 11 * zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';

        let label: string;
        if (node.kind === 'tool') {
          label = node.toolName;
        } else {
          // Show first ~18 chars of content
          label = node.content.slice(0, 18).replace(/\n/g, ' ');
          if (node.content.length > 18) label += '…';
        }
        ctx.fillText(label, drawX, sy + r + 5);
      }
    }
  }
}
