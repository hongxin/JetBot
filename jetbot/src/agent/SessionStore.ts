// src/agent/SessionStore.ts — Session persistence in IndexedDB with crash recovery

import { ensureStore, put, get, getAll, del } from '../lib/db';
import type { Turn } from '../types/message';
import { logger } from '../lib/logger';

const DB_NAME = 'jetbot';
const SESSION_META_STORE = 'session_meta';
const SESSION_TURN_STORE = 'session_turns';
const DB_VERSION = 2;

const log = logger.module('session');

export interface SessionMeta {
  id: string;
  provider: string;
  model: string;
  startedAt: string;
  turnCount: number;
  ended: boolean;
}

interface StoredTurn {
  id: string;
  sessionId: string;
  turnIndex: number;
  turnJson: string;
}

export class SessionStore {
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = Promise.all([
      ensureStore(DB_NAME, DB_VERSION, SESSION_META_STORE, 'id'),
      ensureStore(DB_NAME, DB_VERSION, SESSION_TURN_STORE, 'id'),
    ]).then(() => {});
  }

  async ready(): Promise<void> { return this.dbReady; }

  async start(provider: string, model: string): Promise<void> {
    await this.dbReady;
    const meta: SessionMeta = {
      id: 'current',
      provider,
      model,
      startedAt: new Date().toISOString(),
      turnCount: 0,
      ended: false,
    };
    await this.clearTurns('current');
    await put(DB_NAME, SESSION_META_STORE, meta, 'current');
  }

  async appendTurn(turn: Turn): Promise<void> {
    await this.dbReady;
    const meta = await get<SessionMeta>(DB_NAME, SESSION_META_STORE, 'current');
    if (!meta || meta.ended) return;

    const idx = meta.turnCount;
    const stored: StoredTurn = {
      id: `current:${idx}`,
      sessionId: 'current',
      turnIndex: idx,
      turnJson: JSON.stringify(turn),
    };
    await put(DB_NAME, SESSION_TURN_STORE, stored, stored.id);

    meta.turnCount = idx + 1;
    await put(DB_NAME, SESSION_META_STORE, meta, 'current');
  }

  async hasCrashedSession(): Promise<boolean> {
    await this.dbReady;
    const meta = await get<SessionMeta>(DB_NAME, SESSION_META_STORE, 'current');
    return !!(meta && !meta.ended && meta.turnCount > 0);
  }

  async getCrashedMeta(): Promise<SessionMeta | null> {
    await this.dbReady;
    const meta = await get<SessionMeta>(DB_NAME, SESSION_META_STORE, 'current');
    if (meta && !meta.ended && meta.turnCount > 0) return meta;
    return null;
  }

  async recoverTurns(): Promise<Turn[]> {
    await this.dbReady;
    const turns = await getAll<StoredTurn>(DB_NAME, SESSION_TURN_STORE);
    return turns
      .filter(t => t.sessionId === 'current')
      .sort((a, b) => a.turnIndex - b.turnIndex)
      .map(t => {
        try { return JSON.parse(t.turnJson) as Turn; }
        catch { return null; }
      })
      .filter((t): t is Turn => t !== null);
  }

  async end(): Promise<void> {
    await this.dbReady;
    const meta = await get<SessionMeta>(DB_NAME, SESSION_META_STORE, 'current');
    if (!meta) return;
    meta.ended = true;

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = this.hashStr(ts + meta.startedAt + String(meta.turnCount));
    const archiveId = `archived-${ts}-${hash}`;

    meta.id = archiveId;
    await put(DB_NAME, SESSION_META_STORE, meta, archiveId);

    const turns = await this.recoverTurns();
    for (let i = 0; i < turns.length; i++) {
      const st: StoredTurn = {
        id: `${archiveId}:${i}`,
        sessionId: archiveId,
        turnIndex: i,
        turnJson: JSON.stringify(turns[i]),
      };
      await put(DB_NAME, SESSION_TURN_STORE, st, st.id);
    }

    await this.clearTurns('current');
    await del(DB_NAME, SESSION_META_STORE, 'current');

    log.info('session archived', { id: archiveId, turns: turns.length });
  }

  async listArchived(): Promise<SessionMeta[]> {
    await this.dbReady;
    const all = await getAll<SessionMeta>(DB_NAME, SESSION_META_STORE);
    return all
      .filter(m => m.id !== 'current')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async readArchived(sessionId: string): Promise<Turn[]> {
    await this.dbReady;
    const all = await getAll<StoredTurn>(DB_NAME, SESSION_TURN_STORE);
    return all
      .filter(t => t.sessionId === sessionId)
      .sort((a, b) => a.turnIndex - b.turnIndex)
      .map(t => {
        try { return JSON.parse(t.turnJson) as Turn; }
        catch { return null; }
      })
      .filter((t): t is Turn => t !== null);
  }

  async pruneArchived(days: number): Promise<number> {
    await this.dbReady;
    const cutoff = Date.now() - days * 86400000;
    const archived = await this.listArchived();
    let count = 0;
    for (const m of archived) {
      if (new Date(m.startedAt).getTime() < cutoff) {
        await del(DB_NAME, SESSION_META_STORE, m.id);
        const allTurns = await getAll<StoredTurn>(DB_NAME, SESSION_TURN_STORE);
        for (const t of allTurns) {
          if (t.sessionId === m.id) await del(DB_NAME, SESSION_TURN_STORE, t.id);
        }
        count++;
      }
    }
    return count;
  }

  private async clearTurns(sessionId: string): Promise<void> {
    const all = await getAll<StoredTurn>(DB_NAME, SESSION_TURN_STORE);
    for (const t of all) {
      if (t.sessionId === sessionId) await del(DB_NAME, SESSION_TURN_STORE, t.id);
    }
  }

  private hashStr(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return (hash & 0xFFFF).toString(16).padStart(4, '0');
  }
}
