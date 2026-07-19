/**
 * Helper de IndexNow — notifica motores de busca (Bing/Yandex) que uma URL
 * mudou. Falha em silêncio: nunca quebra o fluxo do usuário.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

const SITE_ORIGIN = 'https://mdaccula.com';

/**
 * Dispara notificação de IndexNow para os caminhos informados.
 * Aceita paths relativos ("/eventos/foo") ou URLs absolutas.
 * Sempre inclui o site root e a listagem pai para acelerar reindexação.
 */
export async function notifyIndexNow(paths: string[]): Promise<void> {
  try {
    const normalized = Array.from(
      new Set(
        paths
          .filter((p): p is string => typeof p === 'string' && p.length > 0)
          .map((p) => (p.startsWith('http') ? p : `${SITE_ORIGIN}${p}`))
      )
    );

    if (normalized.length === 0) return;

    const { error } = await supabase.functions.invoke('indexnow-notify', {
      body: { urls: normalized },
    });

    if (error) {
      console.warn('[indexnow] falha (ignorada):', error.message);
    } else {
      logger.debug('[indexnow] notificadas:', { count: normalized.length });
    }
  } catch (err) {
    console.warn('[indexnow] erro (ignorado):', err);
  }
}

/** Notifica criação/edição de um evento publicado. */
export function notifyEventChange(slug: string | null | undefined) {
  if (!slug) return;
  void notifyIndexNow([`/eventos/${slug}`, '/eventos', '/']);
}

/** Notifica criação/edição de um post publicado. */
export function notifyBlogChange(slug: string | null | undefined) {
  if (!slug) return;
  void notifyIndexNow([`/blog/${slug}`, '/blog', '/']);
}
