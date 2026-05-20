## Plano — Fase 5 (próxima)

Implementar o **toggle de link único vs link por dia** em eventos mesclados.

### Problema
Quando mesclamos um evento que tem 1 link por dia (ex: Fire Up com 4 dias, 4 links de venda diferentes), o botão "Comprar Ingresso" em `/eventos/{slug}` usa apenas `ticket_link` do evento principal — os outros 3 links viram "links órfãos" (continuam em `custom_links`, aparecem no `/links`, mas o CTA do evento ignora).

### Solução
1. Coluna nova em `events`: `tickets_per_day boolean default false`.
2. Toggle no `EventForm` quando `end_date > date` (multi-dia): "Mesmo link para todos os dias" / "Um link por dia".
3. Em `/eventos/{slug}`, se `tickets_per_day = true`:
   - Botão "Comprar Ingresso" abre **modal de seleção de dia**.
   - Modal lê `schedule` (dias) e cruza com `custom_links` cujo `override_date` cai naquele dia.
   - Usuária escolhe o dia → vai pro link correto.
4. `MergeEventsDialog`: detectar se eventos mesclados têm links distintos → sugerir ativar o toggle (não forçar).

### NÃO mexer
- `/links` (Linktree) continua exatamente como está.
- `LinkGroupForm`, `CustomLinkForm`, `LinksManager`, ordenação — intocados.

---

## Fase 4 — concluída

Realtime unificado em `/admin/links-manager` (`useAdminRealtime` com array), auto-recovery de chunk obsoleto via listener global + `ErrorBoundary`, e janela de desfazer mesclagem agora cobre até a data do evento (antes: fixo em 7 dias).

### Testes adicionados
- `src/__tests__/hooks/useAdminRealtime.test.tsx` — string, array (1 canal/N tabelas), enabled=false, array vazio, cleanup.
- `src/__tests__/components/ErrorBoundary.test.tsx` — chunk error dispara reload, guarda anti-loop (10s), erro comum mostra fallback.
