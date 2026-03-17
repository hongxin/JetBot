/**
 * Structured logging system for JetBot.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *   const log = logger.module('agent');
 *   log.info('handle', { input: '...' });
 *   log.error('llm failed', { code: 'TIMEOUT' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

type LogListener = (entry: LogEntry) => void;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #58a6ff',
  warn: 'color: #d29922',
  error: 'color: #f85149; font-weight: bold',
};

const MODULE_COLORS = [
  '#f97583', '#79c0ff', '#56d364', '#d2a8ff',
  '#ff7b72', '#7ee787', '#ffa657', '#a5d6ff',
];

function moduleColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return MODULE_COLORS[Math.abs(hash) % MODULE_COLORS.length];
}

class Logger {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private maxEntries = 2000;
  private minLevel: LogLevel = 'debug';
  private listeners = new Set<LogListener>();
  private consoleEnabled = true;

  /** Set minimum log level (entries below this are discarded). */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Enable/disable console output. */
  setConsole(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  /** Subscribe to new log entries. Returns unsubscribe function. */
  subscribe(fn: LogListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Get all buffered entries, optionally filtered. */
  getEntries(filter?: { level?: LogLevel; module?: string }): LogEntry[] {
    let result = this.entries;
    if (filter?.level) {
      const min = LEVEL_PRIORITY[filter.level];
      result = result.filter(e => LEVEL_PRIORITY[e.level] >= min);
    }
    if (filter?.module) {
      const mod = filter.module;
      result = result.filter(e => e.module === mod);
    }
    return result;
  }

  /** Get all unique module names seen so far. */
  getModules(): string[] {
    return [...new Set(this.entries.map(e => e.module))];
  }

  /** Clear buffered entries. */
  clear(): void {
    this.entries = [];
  }

  /** Create a module-scoped logger. */
  module(name: string): ModuleLogger {
    return new ModuleLogger(this, name);
  }

  /** Core write method. */
  write(level: LogLevel, mod: string, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      id: this.nextId++,
      timestamp: Date.now(),
      level,
      module: mod,
      message,
      data,
    };

    // Ring buffer
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console output
    if (this.consoleEnabled) {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
      const prefix = `%c${time} %c[${mod}] %c${level.toUpperCase()} %c${message}`;
      const styles = [
        'color: #666',
        `color: ${moduleColor(mod)}; font-weight: bold`,
        LEVEL_STYLE[level],
        'color: inherit',
      ];
      if (data && Object.keys(data).length > 0) {
        console[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](prefix, ...styles, data);
      } else {
        console[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](prefix, ...styles);
      }
    }

    // Notify listeners
    for (const fn of this.listeners) {
      try { fn(entry); } catch { /* listener errors don't break logging */ }
    }
  }
}

class ModuleLogger {
  private logger: Logger;
  private mod: string;
  constructor(logger: Logger, mod: string) {
    this.logger = logger;
    this.mod = mod;
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.logger.write('debug', this.mod, msg, data);
  }
  info(msg: string, data?: Record<string, unknown>): void {
    this.logger.write('info', this.mod, msg, data);
  }
  warn(msg: string, data?: Record<string, unknown>): void {
    this.logger.write('warn', this.mod, msg, data);
  }
  error(msg: string, data?: Record<string, unknown>): void {
    this.logger.write('error', this.mod, msg, data);
  }
}

/** Global singleton logger instance. */
export const logger = new Logger();
