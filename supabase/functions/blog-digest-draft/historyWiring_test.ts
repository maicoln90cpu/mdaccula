// Regressão: blog-digest-draft nunca gravava em event_email_campaigns —
// não existia nenhum insert nesse arquivo, então a automação "Blog news"
// era completamente invisível no Dashboard de e-mails, mesmo quando o
// e-mail era criado/enviado de verdade na E-goi. Achado em 2026-08-09.
//
// Teste estático (sem render/rede): garante que a chamada de
// writeDigestCampaignHistory continua presente nos 3 pontos de saída
// (falha ao criar, falha ao enviar, sucesso) — mesmo padrão já coberto
// para weekly-digest-draft/weekend-agenda-draft.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('blog-digest-draft importa e chama writeDigestCampaignHistory com campaign_type blog_digest', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  assertEquals(
    src.includes("import { writeDigestCampaignHistory } from '../_shared/digestCampaignHistory.ts';"),
    true,
  );
  const calls = src.match(/writeDigestCampaignHistory\(admin, \[\], \{/g) ?? [];
  assertEquals(
    calls.length >= 3,
    true,
    `Esperava pelo menos 3 chamadas (falha criar, falha enviar, sucesso), achou ${calls.length}`,
  );
  const campaignTypeMatches = src.match(/campaignType: 'blog_digest'/g) ?? [];
  assertEquals(campaignTypeMatches.length >= 3, true);
});
