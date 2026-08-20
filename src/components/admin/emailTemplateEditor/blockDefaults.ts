/**
 * blockDefaults — configurações iniciais para cada tipo de bloco de e-mail.
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de valores.
 */
import { type Block, newBlockId } from '@/lib/emailTemplates/blocks';

export const defaultForKind = (kind: Block['kind']): Block => {
  const id = newBlockId();
  switch (kind) {
    case 'header':
      return { id, kind, logo_height: 64, align: 'center', padding_y: 32 };
    case 'hero_image':
      return { id, kind, max_width: 552, border_radius: 12 };
    case 'eyebrow':
      return { id, kind, text: '', align: 'left' };
    case 'title':
      return { id, kind, align: 'left', font_size: 28 };
    case 'subtitle':
      return { id, kind, align: 'left' };
    case 'event_meta':
      return { id, kind, layout: 'columns' };
    case 'description':
      return { id, kind, align: 'left' };
    case 'article_summary':
      return { id, kind, show_image: true };
    case 'pix_button':
      return { id, kind, align: 'center', full_width: true };
    case 'cta_button':
      return {
        id,
        kind,
        label: 'Garantir ingresso',
        url_field: 'ticket_link',
        align: 'center',
        full_width: true,
        bg_style: 'gradient',
      };
    case 'secondary_link':
      return { id, kind, label: 'Ver agenda completa', url_field: 'agenda_url', align: 'center' };
    case 'image_with_link':
      return {
        id,
        kind,
        image_url: '',
        link_url: '',
        alt: '',
        max_width: 552,
        align: 'center',
        border_radius: 8,
      };
    case 'divider':
      return { id, kind, thickness: 1 };
    case 'spacing':
      return { id, kind, height: 24 };
    case 'text':
      return { id, kind, html: '<p>Texto livre — suporta HTML básico.</p>', align: 'left' };
    case 'social_icons':
      return {
        id,
        kind,
        style: 'text',
        align: 'center',
        networks: [
          {
            id: 'instagram',
            label: 'Instagram',
            url: 'https://instagram.com/mdaccula',
            enabled: true,
          },
          { id: 'youtube', label: 'YouTube', url: 'https://youtube.com/@mdaccula', enabled: true },
          { id: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/@mdaccula', enabled: false },
          { id: 'soundcloud', label: 'SoundCloud', url: '', enabled: false },
          { id: 'spotify', label: 'Spotify', url: '', enabled: false },
          { id: 'linktree', label: 'Linktree', url: '', enabled: false },
        ],
      };
    case 'lineup':
      return { id, kind, title: 'Line-up', layout: 'chips', align: 'center' };
    case 'countdown':
      return {
        id,
        kind,
        label: 'Lote atual encerra em',
        deadline_source: 'today_2359',
        bg_style: 'gradient',
        align: 'center',
        size: 'large',
      };
    case 'ticker':
      return {
        id,
        kind,
        messages: ['Últimas horas', 'Ingressos limitados', 'Restam poucos'],
        animation: 'fade',
        align: 'center',
        icon: 'clock',
      };
    case 'static_map':
      return {
        id,
        kind,
        zoom: 15,
        height: 300,
        map_style: 'roadmap',
        show_address_label: true,
        border_radius: 12,
      };
    case 'event_grid':
      return { id, kind, title: '', eyebrow: '', align: 'left', columns: 2, link_target: 'ticket_link' };
    case 'weekend_grid':
      return {
        id,
        kind,
        layout: 'cartaz',
        title: '',
        eyebrow: '',
        show_article_link: true,
        align: 'left',
        columns: 2,
        link_target: 'ticket_link',
      };
    case 'weekly_hero':
      return {
        id,
        kind,
        source: 'first_weekend',
        eyebrow: 'DESTAQUE DA SEMANA',
        cta_label: 'Garantir ingresso',
        show_venue: true,
        show_cta: true,
        overlay_intensity: 'strong',
        align: 'left',
      };
    case 'blog_posts_list':
      return {
        id,
        kind,
        title: 'Do blog nesta semana',
        eyebrow: 'MATÉRIAS',
        max_items: 3,
        layout: 'list',
        show_excerpt: true,
        show_category: true,
        align: 'left',
      };
    case 'dedge_block':
      return { id, kind, button_style: 'dark', override_content: false };
    case 'footer':
      return { id, kind, include_unsubscribe: true, align: 'center' };
    default:
      return { id, kind } as Block;
  }
};
