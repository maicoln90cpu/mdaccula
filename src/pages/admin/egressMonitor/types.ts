export type Period = '7d' | '30d' | '90d' | 'lifetime';

export interface EgressRow {
  id: string;
  period_start: string;
  api_path: string;
  source: string;
  egress_bytes: number;
  cache_hits: number;
  cache_misses: number;
  created_at: string;
}

export interface SupabaseUsageResp {
  apiCounts: {
    totals: { auth: number; rest: number; storage: number; realtime: number };
    series: Array<{
      timestamp: string;
      auth: number;
      rest: number;
      storage: number;
      realtime: number;
    }>;
    totalRequests: number;
  };
  health: Array<{ name: string; healthy: boolean; status: string }>;
  auth: { totalUsers: number };
  storage: {
    buckets: Array<{ bucket: string; bytes: number; files: number }>;
    totalBytes: number;
    totalFiles: number;
  };
  tables: Record<string, number>;
  db?: { sizeBytes: number };
  edgeFunctions?: { totalInvocations: number; source?: string; windowDays?: number | null };
  fetchedAt: string;
}

export interface BunnyResp {
  window: { dateFrom: string; dateTo: string; days: number; mode?: string };
  chunks?: { ok: number; errors: number; stopReason?: string };
  estimatedCostUSD?: number;
  pullZone: {
    bandwidthBytes: number;
    originBytes: number;
    requests: number;
    cacheHitRate: number;
    avgOriginResponseMs: number;
    errors: { err3xx: number; err4xx: number; err5xx: number };
    charts: Record<string, Array<{ t: string; v: number }>>;
    geo: Record<string, number>;
  };
  storage: {
    bytesUsed: number;
    files: number;
    region: string;
    charts: {
      storageUsed: Array<{ t: string; v: number }>;
      fileCount: Array<{ t: string; v: number }>;
    };
  };
  fetchedAt: string;
}

export interface SnapshotRow {
  day: string;
  supabase: {
    requests?: { total: number };
    storage?: { totalBytes: number; totalFiles: number };
    users?: number;
  };
  bunny: {
    lifetime?: { bandwidthBytes: number; requests: number; cacheHitRate: number };
    storage?: { bytesUsed: number; files: number };
  };
  captured_at: string;
}
