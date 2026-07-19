import { describe, expect, it } from 'vitest';
import {
  buildEmailMeta,
  injectEmailPreheader,
  resolveEmailPlaceholders,
} from '@/lib/emailTemplates/emailMeta';

const data = {
  eventTitle: 'SOLOMUN SP',
  dateLabel: 'domingo, 01 de novembro',
  timeLabel: '14:00',
  venueName: 'Parque Villa-Lobos',
  cityState: 'São Paulo-SP',
  weekendRange: '01 → 03 nov',
  weekRange: '28 out → 03 nov',
  eventsCount: 7,
};

describe('emailMeta', () => {
  it('resolve placeholders com ponto e underline', () => {
    expect(resolveEmailPlaceholders('{{event.title}} — {{event.date_label}}', data)).toBe(
      'SOLOMUN SP — domingo, 01 de novembro'
    );
    expect(
      resolveEmailPlaceholders('{{event_title}} em {{venue_name}}, {{city_state}}', data)
    ).toBe('SOLOMUN SP em Parque Villa-Lobos, São Paulo-SP');
  });

  it('monta assunto e preheader a partir do template salvo', () => {
    expect(
      buildEmailMeta(
        '{{event.title}} — {{event.date_label}}',
        '{{event.venue}}, {{event.city_state}}',
        data
      )
    ).toEqual({
      subject: 'SOLOMUN SP — domingo, 01 de novembro',
      preheader: 'Parque Villa-Lobos, São Paulo-SP',
    });
  });

  it('injeta o preheader salvo no HTML escondido', () => {
    const html =
      '<body><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">antigo</div><h1>Evento</h1></body>';
    expect(injectEmailPreheader(html, 'novo preheader')).toContain(
      '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">novo preheader</div>'
    );
  });
});
