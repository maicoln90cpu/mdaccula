/**
 * Histórico das últimas execuções de cada automação (Digest semanal,
 * Agenda FDS, Blog news, Lembrete de evento) — antes só o último resultado
 * ficava visível (`*LastResult`); uma falha desaparecia assim que a
 * próxima execução rodava, dificultando notar um padrão (ex.: "falha toda
 * sexta"). Guardado em site_settings como JSON, mesmo padrão de
 * persistência já usado por `*_last_result`.
 */
import { supabase } from '@/integrations/supabase/client';

export type RunHistoryEntry = { at: string; ok: boolean; summary: string };

const MAX_HISTORY = 10;

export function runHistoryKey(job: string): string {
  return `${job}_run_history`;
}

export function parseRunHistory(raw: string | undefined): RunHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Empilha a nova entrada (mais recente primeiro) e persiste, capado em MAX_HISTORY. */
export async function appendRunHistory(
  job: string,
  current: RunHistoryEntry[],
  entry: Omit<RunHistoryEntry, 'at'>
): Promise<RunHistoryEntry[]> {
  const next = [{ ...entry, at: new Date().toISOString() }, ...current].slice(0, MAX_HISTORY);
  try {
    await supabase
      .from('site_settings')
      .upsert({ key: runHistoryKey(job), value: JSON.stringify(next) }, { onConflict: 'key' });
  } catch (e) {
    console.warn(`[automationRunHistory] falha ao persistir histórico de ${job}:`, e);
  }
  return next;
}
