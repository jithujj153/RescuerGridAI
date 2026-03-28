type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "rescuegrid-ai",
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(formatEntry("debug", message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(formatEntry("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(formatEntry("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(formatEntry("error", message, meta));
  },
};
