// src/agent/SessionIndex.ts — Pure-JS inverted index with TF-IDF scoring

import { initDB, put, getAll, del as dbDel } from '../lib/db';
import { logger } from '../lib/logger';

const INDEX_STORE = 'session_index';

const log = logger.module('search');

interface IndexEntry {
  key: string;
  sessionId: string;
  turnIndex: number;
  role: 'user' | 'assistant';
  snippet: string;
}

export interface SearchResult {
  sessionId: string;
  turnIndex: number;
  role: 'user' | 'assistant';
  snippet: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .split(/[^a-zA-Z0-9一-鿿぀-ゟ゠-ヿ_\-]+/)
    .filter(w => w.length >= 2);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

export class SessionIndex {
  private inverted = new Map<string, number[]>();
  private entries: IndexEntry[] = [];
  private docFreq = new Map<string, number>();
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = initDB().then(() => this.loadFromDB());
  }

  async ready(): Promise<void> { return this.dbReady; }

  private async loadFromDB(): Promise<void> {
    try {
      this.entries = await getAll<IndexEntry>(INDEX_STORE);
      this.rebuildInverted();
      log.debug('search index loaded', { entries: this.entries.length });
    } catch {}
  }

  private rebuildInverted(): void {
    this.inverted.clear();
    this.docFreq.clear();
    const seen = new Set<string>();
    for (let i = 0; i < this.entries.length; i++) {
      seen.clear();
      const words = tokenize(this.entries[i].snippet);
      for (const w of words) {
        const list = this.inverted.get(w) || [];
        list.push(i);
        this.inverted.set(w, list);
        if (!seen.has(w)) {
          seen.add(w);
          this.docFreq.set(w, (this.docFreq.get(w) || 0) + 1);
        }
      }
    }
  }

  async indexSession(sessionId: string, turns: Array<{ role: 'user' | 'assistant'; content: string; index: number }>): Promise<number> {
    await this.dbReady;

    this.entries = this.entries.filter(e => e.sessionId !== sessionId);
    const allDb = await getAll<IndexEntry>(INDEX_STORE);
    for (const e of allDb) {
      if (e.sessionId === sessionId) await dbDel(INDEX_STORE, e.key);
    }

    let count = 0;
    for (const turn of turns) {
      if (!turn.content) continue;
      const entry: IndexEntry = {
        key: `${sessionId}:${turn.index}`,
        sessionId,
        turnIndex: turn.index,
        role: turn.role,
        snippet: truncate(turn.content, 200),
      };
      this.entries.push(entry);
      try { await put(INDEX_STORE, entry); } catch {}
      count++;
    }

    this.rebuildInverted();
    log.debug('session indexed', { sessionId, entries: count });
    return count;
  }

  search(query: string, limit = 10): SearchResult[] {
    const terms = tokenize(query);
    if (terms.length === 0) return [];

    const totalDocs = this.entries.length || 1;
    const scores = new Map<number, number>();

    for (const term of terms) {
      for (const [key, indices] of this.inverted) {
        if (!key.startsWith(term)) continue;
        const df = this.docFreq.get(key) || 1;
        const idf = Math.log((totalDocs + 1) / (df + 0.5));
        for (const idx of indices) {
          const entry = this.entries[idx];
          if (!entry) continue;
          const entryWords = tokenize(entry.snippet);
          const tf = entryWords.filter(w => w.startsWith(term)).length / Math.max(1, entryWords.length);
          scores.set(idx, (scores.get(idx) || 0) + tf * idf);
        }
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([idx, score]) => ({
        sessionId: this.entries[idx].sessionId,
        turnIndex: this.entries[idx].turnIndex,
        role: this.entries[idx].role,
        snippet: this.entries[idx].snippet,
        score,
      }));
  }

  recallContext(query: string, maxChars = 1500): string {
    const results = this.search(query, 5);
    if (results.length === 0) return '';

    let ctx = '<session_recall>\n';
    let remaining = maxChars - 20;

    const bySession = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = bySession.get(r.sessionId) || [];
      list.push(r);
      bySession.set(r.sessionId, list);
    }

    for (const [sid, items] of bySession) {
      const header = `[${sid.slice(0, 16)}] ${items.length}\n`;
      if (header.length > remaining) break;
      remaining -= header.length;
      ctx += header;

      for (const r of items) {
        const line = `  #${r.turnIndex} (${r.role}): ${r.snippet}\n`;
        if (line.length > remaining) break;
        remaining -= line.length;
        ctx += line;
      }
    }

    ctx += '</session_recall>';
    return ctx;
  }

  stats(): { sessionCount: number; entryCount: number } {
    const sessions = new Set(this.entries.map(e => e.sessionId));
    return { sessionCount: sessions.size, entryCount: this.entries.length };
  }
}
