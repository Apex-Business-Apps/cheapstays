import fs from "node:fs";
import path from "node:path";

let logFilePath: string | null = null;

export function initLogger(userDataDir: string): void {
  const dir = path.join(userDataDir, "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  logFilePath = path.join(dir, "app.log");
}

function write(level: string, message: string, meta?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${
    meta !== undefined ? " " + safeStringify(meta) : ""
  }\n`;
  // Always echo to the console (visible in dev / DevTools), and persist to
  // disk when a log directory has been configured.
  // eslint-disable-next-line no-console
  console[level === "ERROR" ? "error" : "log"](line.trim());
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, line);
    } catch {
      // Logging must never crash the app.
    }
  }
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => write("INFO", message, meta),
  warn: (message: string, meta?: unknown) => write("WARN", message, meta),
  error: (message: string, meta?: unknown) => write("ERROR", message, meta),
};

export function getLogFilePath(): string | null {
  return logFilePath;
}
