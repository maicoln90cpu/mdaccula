## Fase 3 — Aba "Controle Pessoal"

Nova aba dentro de Admin → E-mail, para você acompanhar quais eventos já receberam e-mail e quais ainda estão pendentes/rascunho, com opção de marcar manualmente.

### Antes vs Depois

**Antes:** só existe o Dashboard (métricas agregadas) e o Histórico (lista bruta de campanhas). Não há uma visão por evento que responda "esse evento já teve e-mail enviado ou não?".

**Depois:** nova aba **"Controle pessoal"** entre "Automações" e "Histórico" com uma tabela de eventos futuros e recentes, mostrando o status de e-mail de cada um e permitindo marcar como enviado manualmente.

### O que a aba mostra

Uma tabela com uma linha por **evento** (futuros + últimos 30 dias):

| Coluna | Conteúdo |
|---|---|
| Evento | Título + data + horário |
| Status e-mail | Badge: `Enviado`, `Rascunho na E-goi`, `Erro`, `Não disparado`, `Enviado manualmente` |
| Data envio | Quando saiu (ou "—") |
| Modo | `automático` / `manual` / `rascunho` |
| Ações | Botão "Marcar enviado manualmente" (só quando status ≠ Enviado) e "Ver na E-goi" (quando existe `egoi_campaign_id`) |

**Filtros no topo:** período (Próximos 7 dias / 30 dias / Todos futuros / Últimos 30 dias) e status (Todos / Pendentes / Enviados / Rascunho / Erro).

**Contadores rápidos** no cabeçalho: "X pendentes • Y rascunhos • Z enviados".

### Atualização automática

- Refetch a cada 30 s enquanto a aba está aberta (React Query `refetchInterval`).
- Refetch imediato após marcar manualmente ou quando a aba volta ao foco.
- Nenhum polling quando a aba não está ativa (economia de egress).

### Marcar como enviado manualmente

- Botão abre confirmação: "Confirma que este e-mail foi enviado manualmente pela E-goi?"
- Ao confirmar: cria/atualiza uma linha em `event_email_campaigns` com `mode='manual'`, `status='sent'`, `sent_at=now()`, `campaign_type='manual'`.
- Toast de sucesso + refetch.
- Se já existir campanha para o evento, atualiza a linha existente em vez de duplicar.

### Detalhes técnicos

- **Sem migração de schema**: `event_email_campaigns` já tem `mode`, `status`, `sent_at`, `campaign_type` — reutilizamos.
- Nova aba em `src/pages/admin/EmailConfig.tsx` (`value="controle"`), delegando toda a lógica a um novo componente `src/components/admin/EmailPersonalControl.tsx` (mantém o arquivo pai enxuto).
- Fonte de dados: `events` (título/data/hora/id) LEFT JOIN `event_email_campaigns` (mais recente por evento).
- Realtime é opcional; começamos apenas com `refetchInterval` de 30 s para não pagar realtime.
- Reaproveita `Badge`, `Button`, `Table`, `Select` do design system.

### Vantagens

- Visão única "quem falta / quem já foi" sem abrir E-goi.
- Marcação manual cobre o período em que a automação ainda está desligada.
- Zero mudança de banco → risco de regressão mínimo.
- Componentizado → não incha `EmailConfig.tsx`.

### Desvantagens / limites

- Refetch de 30 s gera pequeno tráfego enquanto a aba está aberta (mitigado por foco).
- "Marcar manualmente" não valida se o e-mail realmente foi enviado na E-goi — é um registro de controle seu.
- Não edita/desmarca automaticamente: se marcar por engano, precisa botão "desfazer" (vou incluir).

### Checklist manual de validação

- [ ] Aba "Controle pessoal" aparece entre Automações e Histórico.
- [ ] Lista traz eventos dos próximos 30 dias com status correto.
- [ ] Filtro por período e por status funciona.
- [ ] Contadores no topo batem com a lista filtrada.
- [ ] "Marcar enviado manualmente" cria registro e badge muda para "Enviado manualmente".
- [ ] Botão "Desfazer marcação manual" reverte o registro criado por engano.
- [ ] "Ver na E-goi" abre a campanha em nova aba quando existe `egoi_campaign_id`.
- [ ] Fecha e reabre a aba → dados atualizados sem F5.

### Pendências / futuro (não agora)

- Notificação (badge no menu) quando houver evento futuro sem e-mail enviado a menos de 48 h.
- Exportar CSV do controle pessoal.
- Realtime via Supabase channel (se o refetch parecer lento no uso real).

### Prevenção de regressão

- Teste de contrato em `src/__tests__/` verificando que a aba `controle` existe em `EmailConfig.tsx` e que `EmailPersonalControl.tsx` consulta `event_email_campaigns` (não referencia campos inexistentes).
- Nada de mudança de schema → migrações antigas seguem intactas.

Confirma seguir com essa implementação?
