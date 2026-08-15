/**
 * Bug latente (documentado em docs/PENDENCIAS.md antes desta correção, achado
 * como efeito colateral do R-057): `send-event-reminder-campaigns`,
 * `weekly-digest-draft`, `blog-digest-draft` e `weekend-agenda-draft` tinham
 * cada uma sua PRÓPRIA cópia local de `egoiRequest`, sem `AbortSignal.timeout`
 * — a mesma classe de falha que o R-057 corrigiu no `_shared/egoiClient.ts`
 * (usado só pra `sendEgoiCampaign` nesses 4 arquivos, nunca pra criar a
 * campanha). Um `fetch()` sem timeout pode travar a Edge Function inteira até
 * o runtime matar o isolate sem nenhum catch rodar. Corrigido (R-062)
 * eliminando as 4 cópias locais e importando `egoiRequest` do módulo
 * compartilhado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

const FILES = [
  'supabase/functions/send-event-reminder-campaigns/index.ts',
  'supabase/functions/weekly-digest-draft/index.ts',
  'supabase/functions/blog-digest-draft/index.ts',
  'supabase/functions/weekend-agenda-draft/index.ts',
];

describe('Regressão — as 4 automações de e-mail usam o egoiRequest compartilhado (com timeout), não uma cópia local', () => {
  for (const file of FILES) {
    it(`${file}: não define egoiRequest localmente e importa do _shared/egoiClient.ts`, () => {
      const src = read(file);
      expect(
        src,
        `${file} ainda define uma função egoiRequest local — precisa ser removida e substituída pelo import compartilhado.`
      ).not.toMatch(/async function egoiRequest/);
      expect(
        src,
        `${file} precisa importar egoiRequest de _shared/egoiClient.ts (que tem AbortSignal.timeout, ver R-057).`
      ).toMatch(/import\s*\{[^}]*\begoiRequest\b[^}]*\}\s*from\s*['"]\.\.\/_shared\/egoiClient\.ts['"]/);
    });
  }
});
