/**
 * safeQuery — wrapper padronizado para chamadas Supabase.
 *
 * Centraliza tratamento de erro, logging via `logger` e formato de retorno
 * `{ data, error }` consistente — elimina try/catch repetidos.
 *
 * @example
 * const { data, error } = await safeQuery(
 *   () => supabase.from('events').select('*').eq('id', id).single(),
 *   { context: { component: 'EventDetail', action: 'fetchEvent' } }
 * );
 */
import { logger } from "@/lib/logger";

interface SupabaseLike<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface SafeQueryOptions {
  context?: { component?: string; action?: string; [k: string]: unknown };
  /** Se true, lança erro em vez de retornar `{error}`. */
  throwOnError?: boolean;
  /** Mensagem customizada para o log. */
  errorMessage?: string;
}

export interface SafeQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export async function safeQuery<T>(
  fn: () => PromiseLike<SupabaseLike<T>>,
  options: SafeQueryOptions = {}
): Promise<SafeQueryResult<T>> {
  const { context, throwOnError = false, errorMessage } = options;
  try {
    const { data, error } = await fn();
    if (error) {
      const err = new Error(error.message);
      logger.error(errorMessage ?? `Supabase query failed: ${error.message}`, err, context);
      if (throwOnError) throw err;
      return { data: null, error: err };
    }
    return { data, error: null };
  } catch (caught) {
    const err = caught instanceof Error ? caught : new Error(String(caught));
    logger.error(errorMessage ?? `Unexpected error in safeQuery: ${err.message}`, err, context);
    if (throwOnError) throw err;
    return { data: null, error: err };
  }
}
