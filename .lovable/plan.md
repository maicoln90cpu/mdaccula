## Fase 6.2 — concluída

Soft-delete de eventos mesclados:
- Migration adicionou colunas `status`, `merged_into_id`, `merged_at` em `events` + índices.
- `MergeEventsDialog.handleMerge`: passo 7 agora faz UPDATE `status='merged_inactive'` em vez de DELETE.
- Textos do modal atualizados ("inativar" em vez de "deletar", "ação reversível").
- `EventDetail`: se o slug aberto for de um evento `merged_inactive`, busca o `merged_into_id` e exibe o principal (redirect via `navigate replace`).
- Filtros `.eq("status","active")` aplicados em: `useEvents`, `EventsManager`, `EventsDashboard`, `MultiEventArticleModal`, `EventDetail.relatedEvents`, `Analytics` (topEvents + totalViews), `LinksAnalytics`, edge function `sitemap`.
- `UndoMergeDialog`: detecta soft-deleted (UPDATE status=active) vs legado (INSERT) — mantém compatibilidade com mesclagens antigas.

## Fase 6.3 — pendente

Checkbox "Mostrar mesclados (inativos)" no `EventsManager` + botão Reativar individual (alternativa à aba "Eventos Mesclados" que já funciona via UndoMergeDialog).

## Fase 6.1 — concluída
Texto condicional + bug fix `onSuccess await` no MergeEventsDialog.

## Fase 5 — concluída
Toggle "Um link de venda por dia" + `TicketDayPickerModal`.

## Fase 4 — concluída
Realtime unificado, auto-recovery de chunk obsoleto, janela de desfazer até data do evento.
