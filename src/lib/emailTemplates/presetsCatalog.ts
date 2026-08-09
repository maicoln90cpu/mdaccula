/**
 * Catálogo de presets de template (metadata para a galeria do editor).
 * Extraído de `blocks.ts` na Onda 26.
 */
import type { PresetKey } from './presetBuilders';

export type TemplateType =
  | 'event_new'
  | 'ticket_batch'
  | 'ticket_batch_multi'
  | 'weekly_digest'
  | 'weekend_agenda'
  | 'courtesy'
  | 'custom'
  | 'blog_digest'
  | 'promo';

export const TEMPLATE_PRESETS: Array<{
  key: PresetKey;
  name: string;
  description: string;
  subject_template: string;
  preheader_template: string;
  template_type: TemplateType;
}> = [
  {
    key: 'event_new',
    name: 'Novo evento',
    description:
      'Anúncio de evento novo confirmado — flyer, data, local, CTA de ingresso e resumo da matéria (se houver).',
    subject_template: '🎧 Novo evento: {{event_title}} — {{date_label}}',
    preheader_template: '{{event_title}} em {{venue_name}}, {{city_state}}. Ingressos abertos.',
    template_type: 'event_new',
  },
  {
    key: 'ticket_batch',
    name: 'Virada de lote',
    description:
      'Aviso de urgência para virada de lote (mesmo dia ou 1 dia antes). Inclui bloco de arte específica opcional.',
    subject_template: '⏰ Últimas horas do lote — {{event_title}}',
    preheader_template: 'O lote atual está acabando. Garanta antes da próxima virada de preço.',
    template_type: 'ticket_batch',
  },
  {
    key: 'ticket_batch_multi',
    name: 'Virada de lote — múltiplos eventos',
    description:
      'Um e-mail só cobrindo vários eventos que viram de lote no mesmo dia, em grid de 2 colunas — em vez de um e-mail por evento.',
    subject_template: '⏰ {{event_title}}',
    preheader_template: 'O lote atual está acabando em vários eventos. Garanta antes da próxima virada de preço.',
    template_type: 'ticket_batch_multi',
  },
  {
    key: 'weekly_digest',
    name: 'Resumo semanal',
    description: 'Newsletter semanal com destaques da agenda e matérias do blog.',
    subject_template: '📬 MDAccula desta semana',
    preheader_template: 'Eventos, matérias e novidades da cena eletrônica em São Paulo.',
    template_type: 'weekly_digest',
  },
  {
    key: 'weekly_digest_poster',
    name: 'Digest semanal — Cartaz da semana ⭐',
    description:
      'Recomendado. Hero de destaque + grade cartaz com toda a semana + últimos posts do blog + bloco Dedge. Ideal para o disparo de segunda-feira.',
    subject_template: '🎧 O cartaz da semana — {{week_range}}',
    preheader_template: 'Destaque da semana, agenda completa e as matérias mais quentes da cena.',
    template_type: 'weekly_digest',
  },
  {
    key: 'weekly_digest_editorial',
    name: 'Digest semanal — Editorial',
    description:
      'Estilo revista, minimalista. Título grande, timeline da semana e matérias em destaque. Sem bloco Dedge por padrão — foco editorial.',
    subject_template: '📖 A semana em São Paulo — {{week_range}}',
    preheader_template: 'Curadoria enxuta: shows, festas e as histórias que valem seu tempo.',
    template_type: 'weekly_digest',
  },
  {
    key: 'weekend_agenda_cartaz',
    name: 'Agenda do FDS — Cartaz digital ⭐',
    description:
      'Recomendado. Cards full-width com flyers grandes, badge do dia e bloco Dedge de encerramento em preto/branco.',
    subject_template: '🎧 Seu fds em São Paulo — {{weekend_range}}',
    preheader_template: 'Sexta, sábado e domingo — os destaques da cena eletrônica.',
    template_type: 'weekend_agenda',
  },
  {
    key: 'weekend_agenda_timeline',
    name: 'Agenda do FDS — Timeline por dia',
    description:
      'Layout compacto com barra colorida por dia e miniaturas. Bloco Dedge com botões coloridos ao final.',
    subject_template: '📅 Programação do fds — {{weekend_range}}',
    preheader_template: 'Do sunset de sexta ao after de domingo. Sua semana começa aqui.',
    template_type: 'weekend_agenda',
  },
  {
    key: 'blog_digest_cards',
    name: 'Blog news — Cards ⭐',
    description:
      'Novidades do blog em formato de cards. Ideal para o disparo dominical com as matérias da semana.',
    subject_template: '📰 Novidades do blog — {{range_label}}',
    preheader_template: 'As matérias mais lidas da semana no MDAccula.',
    template_type: 'blog_digest',
  },
  {
    key: 'blog_digest_editorial',
    name: 'Blog news — Editorial',
    description: 'Novidades do blog em formato editorial (estilo revista). Só posts, sem eventos.',
    subject_template: '📖 Leituras da semana — {{range_label}}',
    preheader_template: 'Uma curadoria editorial das matérias mais lidas em São Paulo.',
    template_type: 'blog_digest',
  },
  {
    key: 'courtesy',
    name: 'Cortesia — oportunidade (genérico)',
    description:
      "Convite genérico de cortesia com gatilho de escassez: mesma estrutura do 'Novo evento', mas com copy destacando que as vagas são limitadas e por ordem de chegada. Não personaliza por convidado — envio único para toda a lista.",
    subject_template: '🎟️ Cortesia liberada — {{event_title}} (poucas vagas)',
    preheader_template: 'Cortesias limitadas para {{event_title}}. Garanta a sua antes que acabe.',
    template_type: 'courtesy',
  },
  {
    key: 'event_promo',
    name: 'Promoção',
    description:
      'Promoção pontual de um evento específico (ex.: desconto só hoje). Traz contagem regressiva e ticker de urgência, com um bloco de texto livre para descrever a promoção.',
    subject_template: '🔥 Promoção relâmpago — {{event_title}}',
    preheader_template: 'Desconto especial por tempo limitado. Corre antes que acabe.',
    template_type: 'promo',
  },
];
