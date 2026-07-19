/**
 * Backfill único de variantes (thumb/medium) para imagens de eventos que já
 * existiam antes da feature de variantes de tamanho. Escopo deliberadamente
 * restrito a conteúdo com tráfego real:
 * - eventos com data futura (ou end_date futuro, ex: festivais multi-dia)
 * - configs de evento recorrente (a imagem é reaproveitada por toda
 *   instância gerada, passada ou futura, então uma única variante nova
 *   já cobre todas de uma vez)
 * Eventos passados avulsos ficam de fora (tráfego é só admin, não vale o custo).
 */
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImageUrl, BUNNY_CDN_HOST } from '@/lib/imageUtils';
import { convertToWebP } from '@/lib/webpConverter';
import { uploadImageToBunny } from '@/lib/bunnyUploader';

const BUNNY_FILE_REGEX = /^https:\/\/mdaccula\.b-cdn\.net\/([^/]+)\/([^/]+)\.([a-zA-Z0-9]+)$/;

interface BunnyFileParts {
  bucket: string;
  baseName: string;
  ext: string;
}

function extractBunnyFileParts(url: string): BunnyFileParts | null {
  const optimized = getOptimizedImageUrl(url);
  const match = optimized.match(BUNNY_FILE_REGEX);
  if (!match) return null;
  return { bucket: match[1], baseName: match[2], ext: match[3] };
}

async function variantExists(parts: BunnyFileParts, variant: 'thumb' | 'medium'): Promise<boolean> {
  try {
    const resp = await fetch(
      `${BUNNY_CDN_HOST}/${parts.bucket}/${parts.baseName}-${variant}.${parts.ext}`,
      {
        method: 'HEAD',
      }
    );
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * URLs únicas de imagem de eventos ativos + configs recorrentes.
 */
export async function getActiveEventImageUrls(): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [eventsRes, configsRes] = await Promise.all([
    supabase
      .from('events')
      .select('image_url')
      .not('image_url', 'is', null)
      .or(`date.gte.${today},end_date.gte.${today}`),
    supabase.from('recurring_event_configs').select('image_url').not('image_url', 'is', null),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (configsRes.error) throw configsRes.error;

  const urls = new Set<string>();
  for (const row of eventsRes.data || []) {
    if (row.image_url) urls.add(row.image_url);
  }
  for (const row of (configsRes.data || []) as { image_url: string | null }[]) {
    if (row.image_url) urls.add(row.image_url);
  }
  return Array.from(urls);
}

export interface BackfillResult {
  url: string;
  status: 'uploaded' | 'skipped' | 'unsupported' | 'error';
  detail?: string;
}

/**
 * Gera (se ainda não existirem) as variantes thumb/medium pra uma URL de
 * imagem já publicada. Idempotente — checa existência via HEAD antes de
 * baixar/reprocessar, então pode ser rodado mais de uma vez sem duplicar.
 */
export async function backfillVariantsForUrl(url: string): Promise<BackfillResult> {
  const parts = extractBunnyFileParts(url);
  if (!parts) {
    return {
      url,
      status: 'unsupported',
      detail: 'URL fora do padrão do Bunny CDN (ex: ainda no Supabase)',
    };
  }

  const [hasThumb, hasMedium] = await Promise.all([
    variantExists(parts, 'thumb'),
    variantExists(parts, 'medium'),
  ]);
  if (hasThumb && hasMedium) {
    return { url, status: 'skipped', detail: 'variantes já existem' };
  }

  try {
    const sourceResp = await fetch(getOptimizedImageUrl(url));
    if (!sourceResp.ok)
      throw new Error(`download da imagem original falhou (HTTP ${sourceResp.status})`);
    const sourceBlob = await sourceResp.blob();

    const uploads: Promise<unknown>[] = [];
    if (!hasThumb) {
      uploads.push(
        convertToWebP(sourceBlob, 0.08, 400).then((thumb) =>
          uploadImageToBunny(thumb, parts.bucket, { baseName: parts.baseName, variant: 'thumb' })
        )
      );
    }
    if (!hasMedium) {
      uploads.push(
        convertToWebP(sourceBlob, 0.25, 800).then((medium) =>
          uploadImageToBunny(medium, parts.bucket, { baseName: parts.baseName, variant: 'medium' })
        )
      );
    }
    await Promise.all(uploads);
    return { url, status: 'uploaded' };
  } catch (err) {
    return { url, status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Roda o backfill pra todas as URLs candidatas, sequencialmente (evita
 * sobrecarregar a edge function/Bunny com uploads em paralelo). Reporta
 * progresso via callback pra UI.
 */
export async function runEventImageBackfill(
  onProgress?: (done: number, total: number, result: BackfillResult) => void
): Promise<BackfillResult[]> {
  const urls = await getActiveEventImageUrls();
  const results: BackfillResult[] = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await backfillVariantsForUrl(urls[i]);
    results.push(result);
    onProgress?.(i + 1, urls.length, result);
  }
  return results;
}
