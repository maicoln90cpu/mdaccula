/**
 * Sistema de blocos para templates de e-mail.
 *
 * Este arquivo é um **barrel enxuto**:
 *   - Reexporta o renderer canônico compartilhado com as Edge Functions
 *     (`_shared/emailBlocks.ts`), garantindo paridade 1:1 entre preview
 *     admin e envio real.
 *   - Reexporta os presets e o gerador de IDs extraídos em módulos
 *     dedicados (`presetBuilders.ts`, `presetsCatalog.ts`, `blockIds.ts`)
 *     na Onda 26 para manter este arquivo abaixo de 600 linhas.
 *   - Mantém aqui apenas o que é exclusivo do admin e cabe em poucas
 *     linhas: tipo `Template`, rótulos e lista de blocos disponíveis.
 */

// Reexport da fonte da verdade (renderer canônico do Edge)
export type {
  SocialNetwork,
  Align,
  Block,
  GlobalBlock,
  ArticleSummary,
  RenderContext,
} from '@shared/emailBlocks.ts';

export {
  expandGlobalRefs,
  proxyForEmail,
  renderBlockedTemplate,
  computePreheader,
} from '@shared/emailBlocks.ts';

import type { Block } from '@shared/emailBlocks.ts';

// Reexports dos módulos extraídos na Onda 26
export { newBlockId } from './blockIds';
export { buildPresetBlocks, type PresetKey } from './presetBuilders';
export { TEMPLATE_PRESETS } from './presetsCatalog';

// Tipo exclusivo do admin
export type Template = {
  id?: string;
  name: string;
  type:
    | 'event_new'
    | 'ticket_batch'
    | 'ticket_batch_multi'
    | 'weekly_digest'
    | 'weekly_digest_editorial'
    | 'weekend_agenda'
    | 'courtesy'
    | 'custom'
    | 'blog_digest';
  blocks: Block[];
  is_default?: boolean;
  subject_template?: string | null;
  preheader_template?: string | null;
};

// Rótulos / lista disponível (editor)
export const BLOCK_LABELS: Record<Block['kind'], string> = {
  header: 'Cabeçalho (logo)',
  hero_image: 'Flyer do evento',
  eyebrow: 'Etiqueta (texto pequeno)',
  title: 'Título do evento',
  subtitle: 'Subtítulo do evento',
  event_meta: 'Data, hora e local',
  description: 'Descrição do evento',
  article_summary: 'Resumo da matéria (se houver)',
  lineup: 'Line-up do evento',
  countdown: 'Contagem regressiva',
  ticker: 'Ticker de urgência (barra)',
  static_map: 'Mapa estático do local',
  cta_button: 'Botão CTA (ingresso)',
  pix_button: 'Botão Pix sem taxa',
  secondary_link: 'Link secundário',
  image_with_link: 'Imagem com link',
  divider: 'Divisor',
  text: 'Bloco de texto livre',
  social_icons: 'Redes sociais',
  weekend_grid: 'Agenda do fim de semana',
  event_grid: 'Grid de eventos (2 colunas)',
  weekly_hero: 'Destaque da semana (hero)',
  blog_posts_list: 'Últimos posts do blog',
  dedge_block: 'Bloco Dedge (residência)',
  global_ref: 'Bloco global (biblioteca)',
  footer: 'Rodapé + descadastrar',
};

// Ordem alfabética pelo texto exibido (BLOCK_LABELS) — facilita achar o bloco no dropdown.
export const AVAILABLE_BLOCKS: Block['kind'][] = [
  'weekend_grid', // Agenda do fim de semana
  'text', // Bloco de texto livre
  'dedge_block', // Bloco Dedge (residência)
  'cta_button', // Botão CTA (ingresso)
  'pix_button', // Botão Pix sem taxa
  'header', // Cabeçalho (logo)
  'countdown', // Contagem regressiva
  'event_meta', // Data, hora e local
  'description', // Descrição do evento
  'weekly_hero', // Destaque da semana (hero)
  'divider', // Divisor
  'eyebrow', // Etiqueta (texto pequeno)
  'hero_image', // Flyer do evento
  'event_grid', // Grid de eventos (2 colunas)
  'image_with_link', // Imagem com link
  'lineup', // Line-up do evento
  'secondary_link', // Link secundário
  'static_map', // Mapa estático do local
  'social_icons', // Redes sociais
  'article_summary', // Resumo da matéria (se houver)
  'footer', // Rodapé + descadastrar
  'subtitle', // Subtítulo do evento
  'ticker', // Ticker de urgência (barra)
  'title', // Título do evento
  'blog_posts_list', // Últimos posts do blog
];
