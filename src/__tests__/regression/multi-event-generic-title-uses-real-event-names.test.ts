/**
 * Regressão R-046 — Assunto/H1 de campanha multi-evento sempre mostrava a
 * frase genérica "N eventos com novo lote hoje" em vez dos nomes reais dos
 * eventos selecionados (templates "Virada de lote" e "FDS sem taxa —
 * múltiplos eventos"), mesmo sem nenhum override manual configurado.
 *
 * Causa: `buildMultiEventAnnouncementData()` só sabia a CONTAGEM de eventos
 * (`count`), nunca lia `event.title` dos eventos selecionados pra compor o
 * `eventTitle` (usado tanto no bloco H1 quanto no placeholder {{event_title}}
 * do assunto/preheader).
 *
 * Correção (2 partes, porque assunto e H1 têm restrições diferentes):
 * - Assunto/preheader (`composeAutoMultiEventTitle()`, testado aqui): junta
 *   os títulos reais em pt-BR ("A", "A e B", "A, B e C") quando cabem numa
 *   linha (~60 chars); se não couberem, cai DIRETO na frase genérica — sem
 *   etapa intermediária tipo "Primeiro e mais N eventos" (esse meio-termo
 *   foi tentado e descartado por ficar com leitura estranha quando o
 *   primeiro título já vem longo).
 * - H1 (bloco "Título", testado em `blocks-title-multi-event-list.test.ts`):
 *   lista TODOS os eventos, um por linha, já que ali uma lista de verdade é
 *   possível (diferente do assunto, que é uma única linha na caixa de
 *   entrada).
 */
import { describe, it, expect } from 'vitest';
import { buildMultiEventAnnouncementData, type EmailEventRow } from '@shared/emailComposer.ts';

const event = (id: string, title: string): EmailEventRow => ({
  id,
  title,
  subtitle: null,
  slug: id,
  date: '2026-08-23',
  time: '22:00:00',
  venue: 'Clube X',
  location_city: 'São Paulo',
  location_state: 'SP',
  image_url: 'https://cdn.mdaccula.com/x.webp',
  description: null,
  ticket_link: null,
  vip_link: null,
  cta_type: null,
  lineup: null,
  latitude: null,
  longitude: null,
  venue_lat: null,
  venue_lng: null,
});

describe('Regressão R-046 — título automático multi-evento usa nomes reais, não a frase genérica', () => {
  it('mostra os nomes reais dos eventos quando não há override manual', () => {
    const result = buildMultiEventAnnouncementData([event('a', 'Krush'), event('b', 'Nostalgia')]);
    expect(result.eventTitle).toBe('Krush e Nostalgia');
    expect(result.eventTitle).not.toBe('2 eventos com novo lote hoje');
  });

  it('cai na frase genérica só como último fallback, quando nem os nomes truncados cabem no assunto', () => {
    const hugeTitle = 'Um Título de Evento Absurdamente Longo Que Nunca Caberia Em Um Assunto de E-mail Decente';
    const result = buildMultiEventAnnouncementData([event('a', hugeTitle), event('b', 'Outro Evento')]);
    expect(result.eventTitle).toBe('2 eventos com novo lote hoje');
  });
});
