/**
 * Regressão R-074 — imagem de um evento em /links não acompanhava a troca
 * da imagem do evento em /eventos.
 *
 * Bug original (achado em auditoria, agosto/2026):
 *   `custom_links.thumbnail_url` é uma cópia própria da imagem, separada de
 *   `events.image_url`. A única sincronização existente rodava em código de
 *   front-end (`useEventFormSubmit.tsx`), só disparava quando um arquivo
 *   NOVO era enviado naquele mesmo salvamento, e falhava calada (só log) se
 *   não achasse nenhum `custom_links` com aquele `event_id`. Confirmado ao
 *   vivo em produção: o evento "Universo Paralello 2026" estava com
 *   `thumbnail_url` divergente de `events.image_url`.
 *
 * Correção:
 *   Migration supabase/migrations/*_sync_custom_links_thumbnail_from_event_image.sql
 *   cria um gatilho `AFTER UPDATE OF image_url ON events` que sempre
 *   propaga a nova imagem pra todos os `custom_links` daquele evento — não
 *   depende mais de nenhuma condição no código do formulário — e fez o
 *   backfill retroativo dos casos já divergentes.
 *
 * Este teste é estático (sem rede): garante que a migration mais recente
 * continua definindo o gatilho.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function latestSyncTriggerDefinition(): string | null {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let last: string | null = null;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    if (/CREATE TRIGGER\s+sync_custom_links_thumbnail_trigger/i.test(sql)) {
      last = sql;
    }
  }
  return last;
}

describe('Regressão R-074 — imagem de /links precisa acompanhar a imagem do evento', () => {
  it('existe uma migration definindo o gatilho de sincronização em events.image_url', () => {
    const def = latestSyncTriggerDefinition();
    expect(
      def,
      'Nenhuma migration define o gatilho sync_custom_links_thumbnail_trigger. Sem ele, ' +
        'trocar a imagem de um evento volta a não refletir em /links de forma confiável. ' +
        'Veja docs/TESTING.md → Regressões cobertas → R-074.'
    ).toBeTruthy();

    expect(def).toMatch(/AFTER UPDATE OF image_url ON public\.events/i);
    expect(def).toMatch(/UPDATE public\.custom_links/i);
    expect(def).toMatch(/SET\s+thumbnail_url\s*=\s*NEW\.image_url/i);
  });
});
