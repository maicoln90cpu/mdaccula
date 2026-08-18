/**
 * Regressão — o botão "Comprar Ingresso" de um evento com "um link por dia"
 * (tickets_per_day, seletor de dia) sumia inteiro quando o evento não tinha
 * um `ticket_link` único (caso normal de um card-vitrine criado pela
 * mesclagem não-destrutiva, ver R-075: o link fica null de propósito quando
 * cada dia tem seu próprio link). Achado durante verificação manual da
 * Fase 5 do redesenho de mesclagem, 18/08/2026.
 *
 * Causa: `TicketCard` só renderizava o botão dentro de `{ticketLink && (...)}`
 * — mesmo quando `useDayPicker` era true e o botão nem precisa de
 * `ticketLink` pra funcionar (ele abre um modal, não segue um link direto).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketCard } from '@/components/eventDetail/TicketCard';

describe('TicketCard — mostra o botão mesmo sem ticket_link quando usa seletor de dia', () => {
  it('renderiza o CTA quando ticketLink está vazio mas useDayPicker é true', () => {
    render(
      <TicketCard
        cardTitle="Ingressos"
        ticketLink=""
        ticketButtonText="Comprar Ingresso"
        useDayPicker={true}
        onOpenDayPicker={() => {}}
        pixWhatsAppLink={null}
        vipLink=""
      />
    );
    expect(screen.getByRole('button', { name: /comprar ingresso/i })).toBeInTheDocument();
  });

  it('não renderiza nenhum CTA quando não há ticketLink, vipLink, pix nem seletor de dia', () => {
    render(
      <TicketCard
        cardTitle="Ingressos"
        ticketLink=""
        ticketButtonText="Comprar Ingresso"
        useDayPicker={false}
        onOpenDayPicker={() => {}}
        pixWhatsAppLink={null}
        vipLink=""
      />
    );
    expect(screen.queryByRole('button', { name: /comprar ingresso/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /comprar ingresso/i })).not.toBeInTheDocument();
  });
});
