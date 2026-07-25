export type CompressionPreset = 'sutil' | 'media' | 'severa';

export interface BunnyDiagnosis {
  bunny_config?: {
    auth_ok?: boolean;
    hint?: string;
    storage_host?: string;
    storage_zone?: string;
    hostname_secret_configured?: boolean;
  };
  key_diagnostics?: {
    rawLength?: number;
    lengthAfterSanitize?: number;
    startsWithQuote?: boolean;
    endsWithQuote?: boolean;
    containsNonPrintable?: boolean;
    firstCharCode?: number;
  };
  curl_test?: string;
  region_detection?: {
    detected?: boolean;
    correct_region?: string;
    correct_host?: string;
    action_needed?: string;
    all_results?: { host: string; region: string; status: number }[];
  };
  supabase_buckets?: Record<string, number>;
  supabase_bucket_sizes?: Record<string, { sizeMB?: string }>;
  bunny_buckets?: Record<string, number>;
  bunny_bucket_sizes?: Record<string, { sizeMB?: string; count?: number }>;
  unmigrated_urls?: Record<string, number>;
  url_dedup?: { total_urls?: number; unique_files?: number; duplicate_references?: number };
}

export interface MigrateFilesResult {
  error?: string;
  credential_hint?: string;
  nextOffset?: number;
  totalMigrated?: number;
  hint?: string;
  results?: Record<
    string,
    { migrated?: number; skipped?: number; total?: number; hasMore?: boolean; errors?: string[] }
  >;
}

export interface CleanupResult {
  results?: Record<string, { deleted?: number; kept?: number; errors?: string[] }>;
}

export interface CheckResult {
  totalFiles?: number;
  totalImages?: number;
  bunnyImages?: number;
  totalMB?: number;
  avgMB?: number;
  bucketDetails?: Record<string, { images?: number; sizeMB?: number; bunnyCount?: number }>;
  breakdown?: Record<string, { label?: string; count?: number }>;
}

export interface ConvertResult {
  preset?: { label?: string };
  buckets?: string[];
  summary?: { processed?: number; skipped?: number; errors?: number; totalSavedMB?: number };
  details?: { processed?: string[]; errors?: string[] };
}

export const PRESET_LABELS: Record<
  CompressionPreset,
  { label: string; desc: string; details: string }
> = {
  sutil: {
    label: 'Sutil',
    desc: 'Qualidade alta, resize leve',
    details: 'WebP 85% · max 1920px · ~60-70% menor que PNG (~300KB → ~100KB)',
  },
  media: {
    label: 'Média',
    desc: 'Equilíbrio qualidade/tamanho',
    details: 'WebP 70% · max 1280px · ~75-85% menor (~300KB → ~55KB)',
  },
  severa: {
    label: 'Severa',
    desc: 'Máxima compressão',
    details: 'WebP 50% · max 1024px · ~85-92% menor (~300KB → ~30KB)',
  },
};
