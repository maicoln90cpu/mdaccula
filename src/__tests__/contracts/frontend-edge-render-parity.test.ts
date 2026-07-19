/**
 * Etapa 2.6 — Contrato de paridade frontend ↔ edge.
 *
 * Após a Etapa 2.4/2.5, `@/lib/emailTemplates/blocks` reexporta o renderer
 * canônico de `@shared/emailBlocks.ts`. Este teste garante em compile-time e
 * em runtime que:
 *   1) as funções são a **mesma referência** (impossível divergir).
 *   2) o HTML gerado é **byte-idêntico** para o mesmo input, cobrindo os
 *      principais tipos de bloco.
 *
 * Se algum dia o frontend voltar a ter um renderer próprio, este teste falha
 * imediatamente — barreira de regressão.
 */
import { describe, it, expect } from 'vitest';
import * as frontend from '@/lib/emailTemplates/blocks';
import * as edge from '@shared/emailBlocks.ts';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';
import type { Block } from '@shared/emailBlocks.ts';

describe('Contrato de paridade — renderer frontend vs edge', () => {
  it('renderBlockedTemplate é a mesma referência de função', () => {
    expect(frontend.renderBlockedTemplate).toBe(edge.renderBlockedTemplate);
  });

  it('computePreheader é a mesma referência de função', () => {
    expect(frontend.computePreheader).toBe(edge.computePreheader);
  });

  it('proxyForEmail e expandGlobalRefs são a mesma referência', () => {
    expect(frontend.proxyForEmail).toBe(edge.proxyForEmail);
    expect(frontend.expandGlobalRefs).toBe(edge.expandGlobalRefs);
  });

  const cases: Array<{ name: string; blocks: Block[] }> = [
    {
      name: 'header + hero + title + cta',
      blocks: [
        { id: 'h', kind: 'header', align: 'center' },
        { id: 'i', kind: 'hero_image', max_width: 552, border_radius: 12 },
        { id: 'e', kind: 'eyebrow', text: 'NOVO EVENTO', align: 'center' },
        { id: 't', kind: 'title', align: 'center' },
        { id: 's', kind: 'subtitle', align: 'center' },
        { id: 'd', kind: 'description' },
        { id: 'c', kind: 'cta_button', label: 'Garantir' },
      ] as Block[],
    },
    {
      name: 'weekend_grid + blog_posts_list + dedge_block',
      blocks: [
        { id: 'wg', kind: 'weekend_grid' },
        { id: 'bp', kind: 'blog_posts_list' },
        { id: 'dd', kind: 'dedge_block' },
      ] as Block[],
    },
    {
      name: 'countdown + lineup + static_map + footer',
      blocks: [
        { id: 'cd', kind: 'countdown' },
        { id: 'lu', kind: 'lineup' },
        { id: 'sm', kind: 'static_map' },
        { id: 'ft', kind: 'footer' },
      ] as Block[],
    },
  ];

  for (const c of cases) {
    it(`HTML byte-idêntico — ${c.name}`, () => {
      const htmlFE = frontend.renderBlockedTemplate(c.blocks, MOCK_EVENT_DATA, null, null, {
        preview: true,
      });
      const htmlED = edge.renderBlockedTemplate(c.blocks, MOCK_EVENT_DATA, null, null, {
        preview: true,
      });
      expect(htmlFE).toBe(htmlED);
      expect(htmlFE.length).toBeGreaterThan(0);
    });
  }

  it('computePreheader retorna string idêntica para o mock', () => {
    expect(frontend.computePreheader(MOCK_EVENT_DATA)).toBe(edge.computePreheader(MOCK_EVENT_DATA));
  });
});
