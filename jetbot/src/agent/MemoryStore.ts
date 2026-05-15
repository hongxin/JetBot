// src/agent/MemoryStore.ts — Persistent memory store in IndexedDB

import { initDB, put, getAll, del as dbDel, clearStore } from '../lib/db';
import { logger } from '../lib/logger';

const STORE_NAME = 'memory';

const log = logger.module('memory');

export type MemoryCategory = 'preference' | 'project' | 'decision' | 'fact';

export interface MemoryEntry {
  id: number;
  timestamp: string;
  category: MemoryCategory;
  content: string;
}

export class MemoryStore {
  private entries: MemoryEntry[] = [];
  private nextId = 1;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = initDB().then(() => this.loadFromDB());
  }

  async ready(): Promise<void> { return this.dbReady; }

  private async loadFromDB(): Promise<void> {
    try {
      const rows = await getAll<MemoryEntry>(STORE_NAME);
      this.entries = rows;
      this.nextId = this.entries.length > 0
        ? Math.max(...this.entries.map(e => e.id)) + 1
        : 1;
      log.debug('memory loaded', { count: this.entries.length });
    } catch {}
  }

  async add(category: MemoryCategory, content: string): Promise<MemoryEntry> {
    await this.dbReady;
    const entry: MemoryEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      category,
      content,
    };
    this.entries.push(entry);
    try { await put(STORE_NAME, entry); } catch {}
    // Notify subscribers (CosmosStore via agentStore) that a memory was added.
    // Decoupled via DOM CustomEvent to avoid circular store↔agent imports.
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('jetbot:memory:added', { detail: { entry } }));
    }
    return entry;
  }

  async remove(id: number): Promise<boolean> {
    await this.dbReady;
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    try { await dbDel(STORE_NAME, String(id)); } catch {}
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('jetbot:memory:removed', { detail: { id } }));
    }
    return true;
  }

  async clear(): Promise<void> {
    await this.dbReady;
    this.entries = [];
    try { await clearStore(STORE_NAME); } catch {}
  }

  list(): MemoryEntry[] {
    return [...this.entries];
  }

  count(): number {
    return this.entries.length;
  }

  recentContext(maxChars = 2000): string {
    if (this.entries.length === 0) return '';

    let result = '<memory>\n';
    let remaining = maxChars - 20;
    const sorted = [...this.entries].reverse();

    for (const entry of sorted) {
      const line = `[${entry.category}] ${entry.timestamp.slice(0, 16)}: ${entry.content}\n`;
      if (line.length > remaining) break;
      remaining -= line.length;
      result += line;
    }

    result += '</memory>';
    return result;
  }
}
