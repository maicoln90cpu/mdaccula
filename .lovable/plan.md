
## Resposta à sua dúvida (blocos são compartilhados?)

**Não.** Hoje cada template no banco (`email_templates.blocks`) guarda a **sua própria lista de blocos em JSON**. Se você editar o "Rodapé + descontos" no template "Novo evento", **não** reflete no "Digest semanal" nem no "Agenda FDS". Cada template é um universo isolado.

**O que dá pra fazer** (não incluso nesta etapa, só como referência):
- Criar "blocos globais" (ex: rodapé, cabeçalho, redes sociais) salvos numa tabela `email_shared_blocks` e referenciados por ID nos templates. Edita 1 vez, propaga em todos. Custo: migration + refatoração do editor. Fica melhor para uma Fase C dedicada se você aprovar depois.

Por agora, seguimos com blocos por template mesmo.

---

## Correções desta rodada (baixo risco)

### Item 1 — Flyer do evento não aparece no preview
**Causa:** o mock aponta para `https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg` — essa URL não existe no CDN, então o navegador mostra imagem quebrada (invisível no fundo escuro). O bloco "flyer" só usa placeholder cinza quando `flyerUrl` está **vazio**; se tem URL quebrada, tenta renderizar mesmo assim.

**Correção:** trocar o `flyerUrl` do `MOCK_EVENT_DATA` (`src/lib/emailTemplates/eventAnnouncement.ts`) por uma URL válida existente no projeto (ex: `/placeholder.svg` ou um flyer real que já subimos ao Bunny). Assim o preview do editor mostra imagem real; envio de evento real continua usando `event.image_url` normalmente.

**Antes:** flyer bloco aparece vazio nos previews.
**Depois:** flyer bloco mostra imagem placeholder visível em todos os templates.

### Item 2 — Contagem regressiva "Médio": trocar dias/horas por horas/minutos
Em `src/lib/emailTemplates/blocks.ts` (bloco `countdown`, case `size === "medium"`), trocar as 2 caixas de `{dias, horas}` para `{horas, minutos}`. Também atualizar o rótulo do select no editor (`EmailTemplateEditor.tsx`) de "Médio — 2 caixas (dias/horas)" para "Médio — 2 caixas (horas/minutos)".

**Antes:** Médio mostra `00 DIAS | 12 HORAS`.
**Depois:** Médio mostra `12 HORAS | 34 MIN`. Mais útil quando falta pouco (virada de lote).

### Itens 3 e 4 — Remover pendências de CAPTCHA e Onboarding
Editar `PENDENCIAS.MD` retirando os dois bullets. Sem efeito em código.

---

## Item 5 — Plano do próximo ciclo (só planejar, não executar agora)

Depois de você aprovar/executar as 4 correções acima, o próximo ciclo terá **4 frentes** independentes:

### 5.a — Integração Google Maps
- Ativar conector Google Maps (já disponível no projeto, gateway pronto).
- Usar em: `EventDetail` (mapa do local do evento) e possivelmente `Contato`.
- Riscos: chave managed só funciona em `*.lovable.app`; para domínio custom `mdaccula.com` você precisará gerar chave própria com allowlist. Vou avisar quando chegar essa hora.

### 5.b — Testes automatizados dos comportamentos novos
Cobrir com Vitest:
- `renderBlock` respeita `block.hidden === true` (nada é gerado).
- DEDGE multi-CTA: `ctas` gera N botões, cada um com URL individual.
- `weekend_grid` filtra `heroEventId` (evita duplicação Nostalgia).
- `LinksManager` usa `sortLinkGroups` (guard test já existe pros helpers, falta um teste do componente).

### 5.c — Contract tests das edge functions de e-mail
Hoje só `indexnow-notify` e `sitemap` têm. Adicionar mocks e contract tests para `weekly-digest-draft` e `weekend-agenda-draft` cobrindo:
- Consolidação DEDGE (1 card, N CTAs).
- Filtro multi-dia (`end_date >= rangeStart`).
- CTA label "Enviar Nomes Para Lista" para DEDGE.

### 5.d — Alertas de egress
Dashboard já existe (`/admin/egress-monitor`). Falta:
- Job periódico (cron) que compara consumo do dia vs. média móvel 7 dias.
- Se >150%, dispara e-mail/notificação para admin.
- Persistir threshold em `site_settings` para você ajustar sem código.

---

## Execução sugerida

**Etapa única (baixo risco):** Itens 1, 2, 3, 4 juntos. Todos são alterações pequenas e independentes.

**Depois:** você escolhe qual das 4 frentes do Item 5 abrir primeiro. Sugiro a ordem `5.b → 5.c → 5.a → 5.d` — testes primeiro travam regressão, depois abrimos Google Maps com rede de segurança.

## Protocolo de resposta (por etapa)
Ao concluir os itens 1–4 vou informar: antes vs depois, melhorias, vantagens/desvantagens, checklist manual, pendências, prevenção de regressão.

Confirma seguir com os itens 1–4 desta rodada?
