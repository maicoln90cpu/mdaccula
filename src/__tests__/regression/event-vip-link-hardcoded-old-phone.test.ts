import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic imports keep Node builtins out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
});

/**
 * Regressão R-076 — o preset "Maicoln Douglas" do seletor "Link Camarote"
 * (formulário de evento + Templates de Eventos) tinha o número de WhatsApp
 * gravado como literal fixo no código (`5511999136884`). Quando o número foi
 * trocado em Configurações → Redes Sociais, 200+ eventos ativos e 2
 * templates continuaram enviando o botão "Reservas de Camarote"/"Comprar
 * Sem Taxa via Pix" pro número antigo, porque o preset nunca lia
 * `site_settings.whatsapp_number` — só existia esse literal.
 *
 * Guard estático: garante que nenhum dos dois arquivos volte a hardcodar um
 * número de telefone fixo pro preset "Maicoln", e que ambos leem o número
 * de `useSiteSettings()`.
 */

const OLD_PHONE = '5511999136884';

const FILES = [
  'src/components/events/eventForm/TicketAndCtaSection.tsx',
  'src/pages/admin/EventTemplates.tsx',
];

describe('Regressão R-076 — preset "Maicoln" do Link Camarote não hardcoda telefone', () => {
  for (const file of FILES) {
    it(`${file} não contém o número antigo fixo no código`, () => {
      const content = readFileSync(`${process.cwd()}/${file}`, 'utf-8');
      expect(content).not.toContain(OLD_PHONE);
    });

    it(`${file} usa useSiteSettings() para obter o número do WhatsApp`, () => {
      const content = readFileSync(`${process.cwd()}/${file}`, 'utf-8');
      expect(content).toContain('useSiteSettings');
      expect(content).toContain('whatsapp_number');
    });
  }
});
