/**
 * Centralized logging system for MDAccula
 * Provides consistent logging with context, levels, and remote persistence
 *
 * Features:
 * - Structured logs with context
 * - Log levels (debug, info, warn, error)
 * - Performance tracking
 * - Query monitoring for N+1 detection
 * - In-memory log storage for debugging
 * - Scoped loggers for components
 * - Remote persistence for errors/warnings (via Edge Function)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  duration?: number;
  queryCount?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  context?: LogContext;
}

interface QueryMetric {
  table: string;
  operation: string;
  duration: number;
  timestamp: string;
}

// Configuration
const LOG_CONFIG = {
  enableConsole: true,
  enableRemote: false, // Disabled - was causing hundreds of unnecessary edge function calls
  minLevel: (import.meta.env.DEV ? 'debug' : 'info') as LogLevel,
  maxStoredLogs: 100,
  maxStoredMetrics: 50,
  slowQueryThreshold: 500, // ms
  n1DetectionThreshold: 3, // queries in same context
  persistBatchSize: 10, // Send logs in batches
  persistIntervalMs: 30000, // Send every 30 seconds
};

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// In-memory stores
const logStore: LogEntry[] = [];
const performanceStore: PerformanceMetric[] = [];
const queryStore: QueryMetric[] = [];
const queryContextMap = new Map<string, number>();
const pendingLogs: LogEntry[] = [];
const pendingMetrics: PerformanceMetric[] = [];

// Session ID for tracking
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Persist logs to backend
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const persistLogs = async () => {
  if (pendingLogs.length === 0 && pendingMetrics.length === 0) return;
  if (!LOG_CONFIG.enableRemote) return;

  const logsToSend = [...pendingLogs];
  const metricsToSend = [...pendingMetrics];

  // Clear pending before sending (optimistic)
  pendingLogs.length = 0;
  pendingMetrics.length = 0;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) return;

    await fetch(`${supabaseUrl}/functions/v1/persist-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        logs: logsToSend.map((l) => ({
          ...l,
          error: l.error?.message,
        })),
        metrics: metricsToSend,
        sessionId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
  } catch (error) {
    // Silently fail - don't want logging to break the app
    // eslint-disable-next-line no-console -- internal to logger impl, can't call logger.* recursively
    console.debug('Failed to persist logs:', error);
    // Re-add logs to pending (best effort)
    pendingLogs.push(...logsToSend.slice(0, 20));
    pendingMetrics.push(...metricsToSend.slice(0, 10));
  }
};

const schedulePersist = () => {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistLogs();
  }, LOG_CONFIG.persistIntervalMs);
};

// Persist on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pendingLogs.length > 0 || pendingMetrics.length > 0) {
      // Use sendBeacon for reliable delivery on unload
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        navigator.sendBeacon?.(
          `${supabaseUrl}/functions/v1/persist-logs`,
          JSON.stringify({
            logs: pendingLogs.map((l) => ({ ...l, error: l.error?.message })),
            metrics: pendingMetrics,
            sessionId,
          })
        );
      }
    }
  });
}

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_CONFIG.minLevel];
};

const formatLogMessage = (entry: LogEntry): string => {
  const contextStr = entry.context
    ? ` [${Object.entries(entry.context)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(', ')}]`
    : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}]${contextStr} ${entry.message}`;
};

const storeLog = (entry: LogEntry): void => {
  logStore.push(entry);
  if (logStore.length > LOG_CONFIG.maxStoredLogs) {
    logStore.shift();
  }
};

const storeMetric = (metric: PerformanceMetric): void => {
  performanceStore.push(metric);
  if (performanceStore.length > LOG_CONFIG.maxStoredMetrics) {
    performanceStore.shift();
  }
};

const storeQuery = (metric: QueryMetric): void => {
  queryStore.push(metric);
  if (queryStore.length > LOG_CONFIG.maxStoredMetrics) {
    queryStore.shift();
  }
};

const createLogEntry = (
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry => ({
  level,
  message,
  context,
  error,
  timestamp: new Date().toISOString(),
});

// Detect potential N+1 queries
const checkN1Query = (table: string, operation: string): void => {
  const key = `${table}:${operation}`;
  const currentCount = (queryContextMap.get(key) || 0) + 1;
  queryContextMap.set(key, currentCount);

  // Reset after a short delay (simulating request context)
  setTimeout(() => {
    const count = queryContextMap.get(key) || 0;
    if (count > 0) {
      queryContextMap.set(key, count - 1);
    }
  }, 100);

  if (currentCount >= LOG_CONFIG.n1DetectionThreshold) {
    logger.warn(
      `Potential N+1 query detected: ${table}.${operation} called ${currentCount} times`,
      {
        component: 'QueryMonitor',
        action: 'n1_detection',
        queryCount: currentCount,
      }
    );
  }
};

// Main logger object
export const logger = {
  debug: (message: string, context?: LogContext): void => {
    const entry = createLogEntry('debug', message, context);
    if (shouldLog('debug')) {
      storeLog(entry);
      if (LOG_CONFIG.enableConsole) {
        // eslint-disable-next-line no-console -- internal to logger impl, can't call logger.* recursively
        console.debug(formatLogMessage(entry));
      }
    }
  },

  info: (message: string, context?: LogContext): void => {
    const entry = createLogEntry('info', message, context);
    if (shouldLog('info')) {
      storeLog(entry);
      if (LOG_CONFIG.enableConsole) {
        // eslint-disable-next-line no-console -- internal to logger impl, can't call logger.* recursively
        console.info(formatLogMessage(entry));
      }
    }
  },

  warn: (message: string, context?: LogContext): void => {
    const entry = createLogEntry('warn', message, context);
    if (shouldLog('warn')) {
      storeLog(entry);
      if (LOG_CONFIG.enableConsole) {
        console.warn(formatLogMessage(entry));
      }
      // Queue for remote persistence
      if (LOG_CONFIG.enableRemote) {
        pendingLogs.push(entry);
        schedulePersist();
      }
    }
  },

  error: (message: string, error?: Error | unknown, context?: LogContext): void => {
    const err = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, context, err);

    if (shouldLog('error')) {
      storeLog(entry);
      if (LOG_CONFIG.enableConsole) {
        console.error(formatLogMessage(entry), err || error);
      }
      // Queue for remote persistence (high priority)
      if (LOG_CONFIG.enableRemote) {
        pendingLogs.push(entry);
        schedulePersist();
      }
    }
  },

  // Performance tracking
  time: (name: string, context?: LogContext): (() => void) => {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      const metric: PerformanceMetric = {
        name,
        duration,
        timestamp: new Date().toISOString(),
        context,
      };
      storeMetric(metric);

      if (duration > LOG_CONFIG.slowQueryThreshold) {
        logger.warn(`Slow operation: ${name} took ${duration}ms`, {
          ...context,
          duration,
          action: 'slow_operation',
        });
        // Queue slow metrics for remote persistence
        if (LOG_CONFIG.enableRemote) {
          pendingMetrics.push(metric);
          schedulePersist();
        }
      } else if (import.meta.env.DEV) {
        logger.debug(`${name} completed in ${duration}ms`, { ...context, duration });
      }
    };
  },

  // Track database query
  trackQuery: (table: string, operation: string, duration?: number): void => {
    storeQuery({
      table,
      operation,
      duration: duration || 0,
      timestamp: new Date().toISOString(),
    });
    checkN1Query(table, operation);
  },

  // Get stored logs for debugging
  getLogs: (): LogEntry[] => [...logStore],

  // Get performance metrics
  getMetrics: (): PerformanceMetric[] => [...performanceStore],

  // Get query metrics
  getQueries: (): QueryMetric[] => [...queryStore],

  // Get aggregated stats
  getStats: () => ({
    totalLogs: logStore.length,
    errorCount: logStore.filter((l) => l.level === 'error').length,
    warnCount: logStore.filter((l) => l.level === 'warn').length,
    avgQueryTime:
      queryStore.length > 0
        ? Math.round(queryStore.reduce((sum, q) => sum + q.duration, 0) / queryStore.length)
        : 0,
    slowQueries: performanceStore.filter((m) => m.duration > LOG_CONFIG.slowQueryThreshold).length,
  }),

  // Clear stored logs
  clearLogs: (): void => {
    logStore.length = 0;
  },

  // Clear all stores
  clearAll: (): void => {
    logStore.length = 0;
    performanceStore.length = 0;
    queryStore.length = 0;
    queryContextMap.clear();
    pendingLogs.length = 0;
    pendingMetrics.length = 0;
  },

  // Force flush pending logs to backend
  flush: (): Promise<void> => {
    return persistLogs();
  },

  // Get session ID
  getSessionId: (): string => sessionId,

  // Create a scoped logger with preset context
  scope: (defaultContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logger.error(message, error, { ...defaultContext, ...context }),
    time: (name: string, context?: LogContext) =>
      logger.time(name, { ...defaultContext, ...context }),
    trackQuery: (table: string, operation: string, duration?: number) => {
      logger.trackQuery(table, operation, duration);
    },
  }),
};

// Hook for React components
export const useLogger = (component: string) => {
  return logger.scope({ component });
};

// Utility to wrap async functions with timing
export const withTiming = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string,
  context?: LogContext
): T => {
  return (async (...args: Parameters<T>) => {
    const end = logger.time(name, context);
    try {
      const result = await fn(...args);
      end();
      return result;
    } catch (error) {
      end();
      throw error;
    }
  }) as T;
};

export type { LogLevel, LogContext, LogEntry, PerformanceMetric, QueryMetric };
