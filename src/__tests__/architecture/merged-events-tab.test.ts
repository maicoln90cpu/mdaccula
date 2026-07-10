import { describe, it, expect, beforeAll } from 'vitest';

let readFileSync: typeof import('fs').readFileSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
});

/**
 * Guard: a aba "Eventos Mesclados" deve ler os grupos a partir da tabela
 * `events` (via merged_into_id), NÃO exclusivamente de `application_logs`.
 *
 * Motivo: logs são apagados pelo cleanup_old_logs (7 dias) e mesclagens
 * antigas ficariam invisíveis, como aconteceu com o evento Nostalgia.
 */
describe('Architecture guard — MergedEventsTab', () => {
  it('consulta events com merged_into_id (fonte de verdade)', () => {
    const path = `${process.cwd()}/src/components/admin/MergedEventsTab.tsx`;
    const content = readFileSync(path, 'utf-8');

    expect(
      /\.from\(\s*["']events["']\s*\)/.test(content),
      'MergedEventsTab deve consultar a tabela events'
    ).toBe(true);

    expect(
      /merged_into_id/.test(content),
      'MergedEventsTab deve filtrar por merged_into_id'
    ).toBe(true);
  });

  it('não depende exclusivamente de application_logs para listar merges', () => {
    const path = `${process.cwd()}/src/components/admin/MergedEventsTab.tsx`;
    const content = readFileSync(path, 'utf-8');

    // application_logs pode ser consultado (para habilitar undo), mas o filtro
    // principal `action=merge_events` não pode ser a única fonte da lista.
    const fromEventsCount = (content.match(/\.from\(\s*["']events["']\s*\)/g) || []).length;
    expect(fromEventsCount).toBeGreaterThanOrEqual(1);
  });
});
