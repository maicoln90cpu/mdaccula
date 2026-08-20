/**
 * Pendência (docs/PENDENCIAS.md) — "Símbolo estranho (tipo tofu/quadrado)
 * num dos chips de line-up no Outlook": no Gmail o e-mail sai perfeito, mas
 * no Outlook desktop aparece um ícone quebrado nos nomes de artista.
 *
 * Causa raiz: o nome do artista, extraído por IA de legenda do Instagram
 * (ou digitado manualmente no admin), às vezes vem com um emoji de bandeira
 * de país junto (ex.: "🇧🇷 DJ Fulano"). O Outlook desktop (motor Word) não
 * sabe compor os 2 codepoints "regional indicator symbol" de um emoji de
 * bandeira num glifo só — mostra 2 quadrados "tofu" no lugar. O Gmail
 * (fontes/motor próprio) renderiza a bandeira normalmente, por isso o bug
 * só aparecia no Outlook.
 *
 * Correção: `stripFlagEmoji` (emailBlocks/utils.ts) remove o emoji de
 * bandeira do nome do artista na hora de montar o e-mail (HTML e texto
 * simples), tanto pro bloco avulso `lineup` quanto pro line-up dentro do
 * card do grid — sem precisar sanitizar os pontos de entrada dos dados.
 */
import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

const FLAG_BR = '\u{1F1E7}\u{1F1F7}'; // 🇧🇷

describe('Pendência — bandeira de país no line-up quebra no Outlook (tofu)', () => {
  it('bloco "lineup" layout chips: remove a bandeira do nome do artista no HTML gerado', () => {
    const event = { ...MOCK_EVENT_DATA, lineup: [`${FLAG_BR} DJ Fulano`, 'DJ Beta'] };
    const blocks: Block[] = [{ id: 'l', kind: 'lineup', layout: 'chips' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).not.toContain(FLAG_BR);
    expect(html).toContain('DJ Fulano');
  });

  it('bloco "lineup" layout list: remove a bandeira do nome do artista', () => {
    const event = { ...MOCK_EVENT_DATA, lineup: [`${FLAG_BR} DJ Fulano`] };
    const blocks: Block[] = [{ id: 'l', kind: 'lineup', layout: 'list' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).not.toContain(FLAG_BR);
    expect(html).toContain('DJ Fulano');
  });

  it('bloco "lineup" layout 2 colunas (default): remove a bandeira do nome do artista', () => {
    const event = { ...MOCK_EVENT_DATA, lineup: [`${FLAG_BR} DJ Fulano`, 'DJ Beta'] };
    const blocks: Block[] = [{ id: 'l', kind: 'lineup', layout: 'columns' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).not.toContain(FLAG_BR);
    expect(html).toContain('DJ Fulano');
  });

  it('chips dentro do card do grid (event_grid) também removem a bandeira', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [{
        id: 'ev-1',
        title: 'Krush',
        dayLabel: 'Sex, 23/08',
        venue: 'Clube X',
        imageUrl: 'https://cdn.example.com/krush.jpg',
        eventUrl: 'https://mdaccula.com/eventos/krush',
        lineup: [`${FLAG_BR} DJ Fulano`],
      }],
    };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).not.toContain(FLAG_BR);
    expect(html).toContain('DJ Fulano');
  });

  it('não sobra espaço duplo no lugar da bandeira removida', () => {
    const event = { ...MOCK_EVENT_DATA, lineup: [`${FLAG_BR} DJ Fulano`] };
    const blocks: Block[] = [{ id: 'l', kind: 'lineup', layout: 'chips' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('>DJ Fulano<');
  });
});
