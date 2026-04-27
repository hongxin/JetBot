// src/agent/MemoryStore.ts — Persistent memory store in IndexedDB

import { ensureStore, put, getAll, del, clearStore } from '../lib/db';
import { logger } from '../lib/logger';

const DB_NAME = 'jetbot';
const STORE_NAME = 'memory';
const DB_VERSION = 2;

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
    this.dbReady = ensureStore(DB_NAME, DB_VERSION, STORE_NAME, 'id')
      .then(() => this.loadFromDB());
  }

  async ready(): Promise<void> { return this.dbReady; }

  private async loadFromDB(): Promise<void> {
    try {
      const rows = await getAll<MemoryEntry>(DB_NAME, STORE_NAME);
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
    try { await put(DB_NAME, STORE_NAME, entry, String(entry.id)); } catch {}
    return entry;
  }

  async remove(id: number): Promise<boolean> {
    await this.dbReady;
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    try { await del(DB_NAME, STORE_NAME, String(id)); } catch {}
    return true;
  }

  async clear(): Promise<void> {
    await this.dbReady;
    this.entries = [];
    try { await clearStore(DB_NAME, STORE_NAME); } catch {}
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
