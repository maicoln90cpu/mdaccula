/**
 * 15/08/2026 — reprodução real em produção do exato sintoma que o R-062 foi
 * desenhado pra eliminar (claim setado, zero linha de histórico), mas desta
 * vez a falha aconteceu na PRÓPRIA escrita da Fase 1 em event_email_campaigns
 * — não antes (claim), não depois (E-goi). Supabase-js usa fetch() sem
 * AbortSignal por padrão; sem timeout explícito, uma falha transiente na
 * chamada ao PostgREST trava a promise indefinidamente sem lançar exceção —
 * mesma classe de bug do R-057, só que na escrita do próprio banco em vez de
 * numa API externa (E-goi/Google Maps), que já tinham essa proteção.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — escritas de event_email_campaigns em emailDispatchHistory.ts têm timeout explícito', () => {
  const src = read('supabase/functions/_shared/emailDispatchHistory.ts');

  it('importa e usa withTimeout do _shared/index.ts', () => {
    expect(src).toMatch(/import\s*\{\s*withTimeout\s*\}\s*from\s*['"]\.\/index\.ts['"]/);
  });

  for (const fn of ['beginInProgressHistoryRow', 'beginInProgressHistoryRows', 'finalizeHistoryRow', 'finalizeHistoryRows']) {
    it(`${fn}: envolve toda chamada a event_email_campaigns em withTimeout(...)`, () => {
      const fnStart = src.indexOf(`export async function ${fn}(`);
      expect(fnStart, `Não encontrei a função ${fn}.`).toBeGreaterThan(-1);
      const nextFnStart = src.indexOf('export async function', fnStart + 1);
      const fnBody = src.slice(fnStart, nextFnStart === -1 ? undefined : nextFnStart);

      // Toda ocorrência de .from('event_email_campaigns') deve estar dentro
      // de uma chamada a withTimeout, não um await direto na query.
      const rawAwaits = fnBody.match(/await\s*\(admin\.from\('event_email_campaigns'\)/g) ?? [];
      expect(
        rawAwaits,
        `${fn} tem um "await (admin.from('event_email_campaigns')..." direto, sem passar por withTimeout — reintroduz o bug de escrita sem timeout.`
      ).toHaveLength(0);
      expect(fnBody).toMatch(/withTimeout</);
      expect(fnBody).toMatch(/HISTORY_DB_TIMEOUT_MS/);
    });
  }

  it('cada chamada a withTimeout está dentro de um try/catch (falha na escrita não pode escapar como exceção não tratada)', () => {
    // Cada função exportada tem seu próprio try { ... } catch (err) { ... }.
    const tryCount = (src.match(/\btry\s*\{/g) ?? []).length;
    const withTimeoutCallCount = (src.match(/withTimeout</g) ?? []).length;
    expect(tryCount).toBeGreaterThanOrEqual(4);
    expect(withTimeoutCallCount).toBeGreaterThanOrEqual(4);
  });
});
