## Fase 6.1 — concluída

Refino de texto e bug fix no `MergeEventsDialog`:
- Texto da confirmação final agora é **condicional ao toggle**: explica corretamente o comportamento de "link único" vs "modal por dia".
- Bug "precisa atualizar a página" mitigado: modal trava (`onOpenChange` ignorado) enquanto `merging=true`, e `onSuccess()` aguarda antes de fechar.
- Logs `[merge] step N` em cada etapa para diagnóstico futuro.

## Fase 6.2 — pendente

Soft-delete: nova coluna `events.status` + `merged_into_id`, filtros em todas as listagens, redirect 301 do slug inativo para o principal, `handleMerge` UPDATE em vez de DELETE, `handleUndo` simplificado (sem INSERT).

## Fase 6.3 — pendente

Checkbox "Mostrar mesclados" no `EventsManager` + botão Reativar por evento.

## Fase 5 — concluída

Toggle "Um link de venda por dia" para eventos multi-dia (festival), aplicado em `EventForm`, `MergeEventsDialog` e `EventDetail` (com `TicketDayPickerModal`). `/links` intocado.

## Fase 4 — concluída

Realtime unificado em `/admin/links-manager`, auto-recovery de chunk obsoleto no `ErrorBoundary`, e janela de desfazer mesclagem cobre até a data do evento.
