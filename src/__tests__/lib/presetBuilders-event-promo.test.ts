import { describe, it, expect } from 'vitest';
import {
  buildPresetBlocks,
  TEMPLATE_PRESETS,
  renderBlockedTemplate,
  type Block,
} from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

describe('preset "Promoção" (event_promo)', () => {
  it('TEMPLATE_PRESETS tem uma entrada event_promo apontando para template_type promo', () => {
    const preset = TEMPLATE_PRESETS.find((p) => p.key === 'event_promo');
    expect(preset).toBeDefined();
    expect(preset?.template_type).toBe('promo');
    expect(preset?.name).toContain('Promoção');
  });

  it('buildPresetBlocks monta cabeçalho, urgência (countdown/ticker), texto livre e CTA', () => {
    const blocks = buildPresetBlocks('event_promo');
    const kinds = blocks.map((b) => b.kind);

    expect(kinds).toEqual([
      'header',
      'hero_image',
      'eyebrow',
      'title',
      'event_meta',
      'countdown',
      'text',
      'ticker',
      'cta_button',
      'divider',
      'social_icons',
      'footer',
    ]);

    const textBlock = blocks.find((b) => b.kind === 'text') as Extract<Block, { kind: 'text' }>;
    expect(textBlock.html).toContain('promoção');

    const ctaBlock = blocks.find((b) => b.kind === 'cta_button') as Extract<
      Block,
      { kind: 'cta_button' }
    >;
    expect(ctaBlock.full_width).toBe(true);
    expect(ctaBlock.url_field).toBe('ticket_link');
  });

  it('renderiza sem erros e inclui a copy de urgência e o CTA', () => {
    const blocks = buildPresetBlocks('event_promo');
    const html = renderBlockedTemplate(blocks, MOCK_EVENT_DATA, null, null, { preview: true });

    expect(html).toContain('PROMOÇÃO RELÂMPAGO');
    expect(html).toContain('Aproveitar promoção');
    expect(html.toLowerCase()).toContain('desconto especial');
  });
});
