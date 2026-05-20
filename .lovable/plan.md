## Fase 5 — concluída

Toggle "Um link de venda por dia" para eventos multi-dia (festival).

- Coluna `events.tickets_per_day boolean default false` (migração aplicada).
- `EventForm`: Switch visível apenas quando `end_date > date`; salva no campo novo.
- `EventDetail` (`/eventos/{slug}`): se `tickets_per_day = true` E multi-dia, o botão "Comprar Ingresso" (mobile + desktop) abre `TicketDayPickerModal`, que lê o `schedule` cruzado com `custom_links` (por `event_id` + `override_date`). Fallback: `ticket_link` principal.
- `MergeEventsDialog`: avisa quando os eventos selecionados têm `ticket_link` distintos, recomendando ativar o toggle após mesclar.
- `/links` (Linktree): intocado.

## Fase 4 — concluída

Realtime unificado em `/admin/links-manager` (`useAdminRealtime` com array), auto-recovery de chunk obsoleto via listener global + `ErrorBoundary`, e janela de desfazer mesclagem cobre até a data do evento.
