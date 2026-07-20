Plano de correção — itens restantes dos 7 mapeados
Fase 1 (VIP → Camarote) e Fase 2 (título editável na mesclagem) já foram aplicadas. Aqui segue o plano para os 5 itens que ainda estão pendentes.

```text
┌────────────────────────────────────────────────────────────────────┐
│ PENDENTES                                                          │
│ 3. Cron de emails automáticos criando apenas rascunho              │
│ 4. Erro "Não há eventos para montar a agenda deste bloco" manual   │
│ 5. Favicon oscilando entre Lovable e MDAccula                    │
│ 6. Remover campos de latitude/longitude do modal de evento          │
│ 7. Configurar "template padrão" para novo evento (aviso sem UI)    │
└────────────────────────────────────────────────────────────────────┘
```


FASE 3 — UI/Metadata de baixo risco (favicon + coordenadas do evento)

3.1 Favicon corrigido
- O que muda: `index.html` passa a apontar corretamente para `public/favicon.ico` com `type="image/x-icon"` e remove referências ao favicon do template Lovable.
- Arquivos envolvidos: `index.html`, `public/favicon.ico` (já existe, apenas revisar se é o logo MDAccula).
- Risco: baixo. Apenas tag `<link rel="icon">`. Não afeta runtime nem banco.
- Teste manual: recarregar /admin e /eventos, aba deve exibir o ícone MDAccula (caveira estilizada) em vez do ícone Lovable.

3.2 Remover inputs de latitude e longitude do formulário de evento
- O que muda: os campos `venue_lat` e `venue_lng` deixam de ser exibidos em `src/components/events/EventForm.tsx`. A geocodificação automática continua funcionando em segundo plano via `geocode-event` quando o evento é visualizado (`EventLocationMap`) ou quando o e-mail é disparado (`dispatchEventDraft.ts`).
- Arquivos envolvidos: `src/components/events/EventForm.tsx`, `src/components/events/EventLocationMap.tsx` (verificar se mantém fallback), `src/lib/emailTemplates/dispatchEventDraft.ts` (já geocodifica).
- Risco: baixo. Remove inputs opcionais; a lógica de geocode em fallback é preservada.
- Teste manual: criar/editar um evento → aba de local deve mostrar apenas endereço, cidade, estado, país. Acessar a página pública do evento deve ainda exibir o mapa se o endereço for geocodificável.


FASE 4 — Template padrão para novo evento (frontend admin)

4.1 Adicionar seletor de template padrão na aba "Configuração" do e-mail
- O que muda: a tabela `egoi_config` já possui a coluna `default_event_template_id` e o código de evento (`EventForm.tsx`) já exibe o aviso "Selecione um template padrão em /admin/email-config". O que falta é a UI para escolher esse template. Incluir um `<Select>` em `src/components/admin/emailConfig/ConfigTab.tsx` listando os templates do tipo `event_new` e salvando o `id` em `egoi_config.default_event_template_id`.
- Arquivos envolvidos: `src/components/admin/emailConfig/ConfigTab.tsx`, `src/pages/admin/EmailConfig.tsx` (carregar/salvar `default_event_template_id`), `src/components/events/EventForm.tsx` (apenas confirmar que o aviso some após a configuração).
- Risco: baixo. Adiciona campo que já existe no banco; não altera schema.
- Teste manual: ir em /admin/email-config → aba Configuração → escolher um template padrão → salvar. Criar evento: o aviso de "Selecione um template padrão" deve sumir e o botão de automação de e-mail deve habilitar.


FASE 5 — Automação de envio direto pelos crons de digest (edge functions)

5.1 Adicionar flag de envio automático na configuração do admin
- O que muda: inserir 3 novas `site_settings` (`weekly_digest_send_on_cron`, `weekend_agenda_send_on_cron`, `blog_digest_send_on_cron`) com valor `true`. Adicionar toggles na aba "Automações" para que o usuário possa desligar o envio direto (mantendo rascunho) se quiser.
- Arquivos envolvidos: `src/components/admin/emailConfig/AutomationsTab.tsx`, `src/components/admin/emailConfig/useEmailAutomation.ts`, `src/pages/admin/EmailConfig.tsx` (carregar/salvar as flags).
- Risco: médio. Adiciona estado e novas settings, mas não altera a API da E-goi.
- Teste manual: /admin/email-config → aba Automações → ver 3 toggles "Enviar automaticamente no cron".

5.2 Fazer as functions de digest dispararem a campanha após criar o rascunho
- O que muda: após criar a campanha na E-goi (`POST /campaigns/email`), se a flag de envio automático estiver ativa ou o body da requisição vier com `send_now: true`, a function chamará `POST /campaigns/{hash}/actions/send` e retornará `status: 'sent'` em vez de `'draft'`. A mesma defensiva de `egoiSendBodyIndicatesError` usada em `send-scheduled-email-campaigns` será aplicada.
- Arquivos envolvidos:
  - `supabase/functions/weekly-digest-draft/index.ts`
  - `supabase/functions/weekend-agenda-draft/index.ts`
  - `supabase/functions/blog-digest-draft/index.ts`
  - `supabase/functions/_shared/egoiClient.ts` (já exporta `egoiSendBodyIndicatesError`)
- Risco: médio-alto. Muda o comportamento das functions em produção. Requer deploy das functions e teste de envio real (pode usar o teste via admin para validar antes de deixar o cron ativo).
- Teste manual: /admin/email-config → aba Automações → clicar em "Testar Digest Semanal" com toggle de envio ativo → esperar resultado "sent" com campaign hash. Depois, verificar na E-goi se a campanha foi realmente enviada.

5.3 Atualizar crons para enviar automaticamente (migration)
- O que muda: opcional. A function já pode ler a flag `send_on_cron` do banco. Se preferir, podemos garantir que o body do `pg_cron` envie `send_now: true` explicitamente, mas a preferência é usar a flag no banco para centralizar o controle.
- Arquivos envolvidos: possivelmente `supabase/migrations/...` para inserir as novas settings e, se necessário, recriar o job do cron.
- Risco: baixo se apenas inserir settings. Recriar cron requer cuidado para não duplicar jobs.
- Teste manual: aguardar o horário do cron ou usar endpoint com `x-cron-secret` para simular.


FASE 6 — Corrigir erro "Não há eventos para montar a agenda deste bloco" no envio manual

6.1 Entender o cenário exato
- O erro vem de `supabase/functions/_shared/emailComposer.ts` quando um bloco `weekend_grid` é renderizado sem eventos. No envio manual, isso pode ocorrer quando o template selecionado é do tipo `weekend_agenda` mas o evento escolhido não é um evento de fim de semana multi-evento, ou quando o evento é único e a grade de eventos fica vazia.
- Arquivos envolvidos a investigar: `supabase/functions/_shared/emailComposer.ts` (linha ~204), `src/lib/emailTemplates/dispatchEventDraft.ts`, `src/lib/emailTemplates/eventAnnouncement.ts`.

6.2 Correção defensiva
- O que muda: se o template escolhido for `weekend_agenda` e o evento não tiver múltiplos eventos associados, o sistema deve usar uma variante de template compatível (do tipo `event_new`) ou renderizar um bloco de evento único em vez de `weekend_grid`. Outra opção é ajustar `emailComposer.ts` para renderizar grade vazia sem falhar.
- Preferência: fazer `dispatchEventDraft.ts` detectar a incompatibilidade e fallback para template `event_new` (ou o template padrão), emitindo um aviso no log. Isso evita que o envio manual quebre para eventos isolados.
- Arquivos envolvidos: `src/lib/emailTemplates/dispatchEventDraft.ts`, `supabase/functions/_shared/emailComposer.ts` (mensagem de erro mais clara), `src/pages/admin/EmailConfig.tsx` (feedback ao usuário).
- Risco: médio. Afeta a lógica de renderização de e-mails, mas a mudança é defensiva.
- Teste manual: /admin/email-config → aba Envio manual → escolher um template do tipo "Agenda de fim de semana" e um evento único (não multi) → clicar em "Criar/enviar". O sistema deve enviar com um template de evento único ou mostrar um aviso claro antes de prosseguir.


Ordem de execução recomendada

1. FASE 3: favicon + coordenadas (independente, baixo risco).
2. FASE 4: template padrão (frontend, baixo risco, desbloqueia o aviso do evento).
3. FASE 6: erro de agenda manual (mediação antes do envio automático).
4. FASE 5: envio automático pelos crons (maior impacto, testar bem após as correções anteriores).


Checklist geral de validação (para cada fase)
- [ ] Rodar `npx tsc --noEmit` após alterações frontend.
- [ ] Rodar `npm run lint`.
- [ ] Rodar `npm test` e `npm run test:coverage:ratchet` (se alterar edge functions, também `npm run test:edge`).
- [ ] Validar no localhost:8080 o fluxo afetado.
- [ ] Para edge functions, deploy via script `scripts/bundle-edge-functions.mjs` ou GitHub Actions.
- [ ] Para migrations, aplicar no banco e confirmar settings/tabelas.


Prevenção de regressão
- Adicionar/atualizar contratos em `src/__tests__/contracts/` para:
  - envio automático de digest (`status: 'sent'` quando `send_now: true`)
  - fallback de template `weekend_agenda` incompatível
- Atualizar testes de regressão existentes se o comportamento de draft mudar.
- Documentar as novas `site_settings` no `tabelas.md` e/ou `README.md`.


Pendências futuras (fora do escopo deste plano)
- Melhorar a mensagem de erro "Não há eventos para montar a agenda deste bloco" para incluir qual template e qual evento causaram o problema.
- Criar uma tela de "Preview" de e-mail antes de envio, para o usuário visualizar o resultado antes de confirmar.
- Auditoria de logs das edge functions para confirmar taxa de sucesso dos envios automáticos.