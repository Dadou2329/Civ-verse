export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  time: number;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
  stack?: string;
}

type LogSink = (entry: LogEntry) => void;

/**
 * Central diagnostics log. Keeps a bounded ring buffer that the debug overlay and the Studio
 * console display, and forwards to the browser console. Errors are never silently dropped.
 */
export class LogHub {
  private buffer: LogEntry[] = [];
  private sinks = new Set<LogSink>();
  constructor(
    private readonly capacity = 500,
    private readonly echoToConsole = true,
  ) {}

  push(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) this.buffer.splice(0, this.buffer.length - this.capacity);
    if (this.echoToConsole) {
      const line = `[${entry.source}] ${entry.message}`;
      if (entry.level === 'error') console.error(line, entry.data ?? '', entry.stack ?? '');
      else if (entry.level === 'warn') console.warn(line, entry.data ?? '');
      else if (entry.level === 'info') console.info(line, entry.data ?? '');
      else console.debug(line, entry.data ?? '');
    }
    for (const s of this.sinks) s(entry);
  }

  subscribe(sink: LogSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  entries(): readonly LogEntry[] {
    return this.buffer;
  }

  errors(): LogEntry[] {
    return this.buffer.filter((e) => e.level === 'error');
  }

  clear(): void {
    this.buffer = [];
  }

  logger(source: string): Logger {
    return new Logger(this, source);
  }
}

export class Logger {
  constructor(
    private readonly hub: LogHub,
    readonly source: string,
  ) {}

  debug(message: string, data?: unknown): void {
    this.hub.push({ time: Date.now(), level: 'debug', source: this.source, message, data });
  }
  info(message: string, data?: unknown): void {
    this.hub.push({ time: Date.now(), level: 'info', source: this.source, message, data });
  }
  warn(message: string, data?: unknown): void {
    this.hub.push({ time: Date.now(), level: 'warn', source: this.source, message, data });
  }
  error(message: string, err?: unknown): void {
    const stack = err instanceof Error ? err.stack : undefined;
    const data = err instanceof Error ? err.message : err;
    this.hub.push({ time: Date.now(), level: 'error', source: this.source, message, data, stack });
  }
  child(name: string): Logger {
    return new Logger(this.hub, `${this.source}:${name}`);
  }
}
