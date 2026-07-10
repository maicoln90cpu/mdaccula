# Roadmap E-mail (E-goi) — status atual

## Concluído
- **B.5.1 — Editor de blocos** (drag-and-drop, logo redimensionável, imagem-com-link, social icons customizáveis, botão descadastrar oficial E-goi, resumo da matéria, preview com evento real, envio de teste).
- **B.5.2 — Presets** de template ("event_new", "ticket_batch", "weekly_digest") + banner de alcance estimado (com contagem e origem: lista inteira ou segmento).
- **B.6 — Auto-trigger** de rascunho ao publicar evento (toggle `dispatch_email_on_save`, guards master/agência, anti-race com `email_campaign_dispatched_at`).
- **B.6.1 — Criar rascunho agora** por evento (para eventos importados via CSV/script), painel B.4 com "Eventos sem rascunho".
- **B.7 — Envio imediato com dupla confirmação** (checklist + digitar "ENVIAR"), correção 403 no endpoint `POST /campaigns/email` (schema v3 correto).
- **B.8 — Virada de lote com arte opcional (esta onda):**
  - Nova aba "Virada de lote" em `/admin/email-config`.
  - Seleciona evento, template (pré-seleciona preset `ticket_batch`), assunto opcional e **upload de arte específica** que substitui o flyer padrão apenas neste disparo.
  - Reutiliza `dispatchEventDraftEmail` com novos overrides: `templateIdOverride`, `flyerOverrideUrl`, `subjectOverride`.
  - Se o template tem bloco `image_with_link` vazio (preset ticket_batch), a arte enviada também preenche esse bloco automaticamente.
  - Botões "Criar rascunho" + "Enviar agora" (dupla confirmação já existente).
  - Cada disparo cria uma nova entrada no histórico (`forceResend: true`), preserva histórico anterior.
- **Correção do banner "em breve":** o card "Criar rascunho de teste (em breve)" foi substituído por um card informativo apontando para o fluxo real (Preview → envio de teste; Histórico → rascunho/envio por evento; Virada de lote → disparo pontual).

## Auditoria pendente (apenas planejar, não implementar agora)

### A1 — Imagens não aparecem no Outlook (mobile mostra, Gmail mostra)
- **Sintoma:** ao enviar teste, no Outlook desktop as imagens ficam como `[x]` (bloqueadas/quebradas). No Gmail e no celular funcionam.
- **Prováveis causas:**
  1. Outlook (2016+/Windows) usa o motor **Word** para renderizar HTML — não interpreta `background-image` CSS, `object-fit`, `<picture>`, `srcset`, e trata `width/height` só via atributo HTML (não CSS).
  2. Imagens hospedadas em domínios sem CORS/`Content-Type` correto (Bunny CDN pode servir `application/octet-stream` em alguns paths) — Outlook exige `image/*`.
  3. `<img>` sem atributos `width` e `height` explícitos → Outlook não reserva espaço e o proxy de segurança pode bloquear.
  4. URLs assinadas de curta duração (Supabase Storage `getPublicUrl` em bucket privado) — Outlook faz cache/prefetch tardio e o link expira.
- **Investigação sugerida:**
  - Rodar o HTML no [Litmus](https://litmus.com/) ou [Email on Acid] para diagnóstico oficial.
  - Testar com CID (Content-ID) via Resend/E-goi anexando a imagem em vez de URL externa.
  - Adicionar `width`/`height` HTML atributos em todos `<img>` gerados por `renderBlockedTemplate`.
  - Verificar cabeçalho `Content-Type` das artes no Bunny/Supabase.
- **Correção candidata (não aplicar ainda):**
  1. Em `blocks.ts` / `eventAnnouncement.ts`: adicionar `width="X" height="Y" style="display:block;"` em todos os `<img>` (Outlook exige atributo HTML).
  2. Forçar `image/jpeg` ou `image/png` no upload (rejeitar formatos exóticos).
  3. Adicionar VML fallback (`<!--[if mso]>`) para hero images grandes — hack clássico Outlook.

### A2 — Preview do logo não corresponde ao e-mail real
- **Sintoma:** aumentar `logo_height` no editor deixa o logo pequeno no preview mas gigante no e-mail enviado.
- **Provável causa:** o iframe do preview aplica CSS herdado do site (fonts, box-sizing, dpi) e/ou o `srcDoc` renderiza com escala diferente da caixa de e-mail real (Outlook/Gmail usam viewport de ~600px, o preview atual tem ~640-720px de largura e a altura vai a 900px). Também: preview usa `sandbox=""` sem base CSS, mas fontes do sistema afetam altura das imagens.
- **Investigação sugerida:**
  - Comparar o HTML renderizado do preview vs HTML enviado (baixar via botão "Baixar HTML" já existente).
  - Confirmar se o `logo_height` está sendo aplicado como atributo HTML (`height="120"`) ou só CSS (`style="height:120px"`) — Outlook ignora CSS.
  - Validar largura do iframe: e-mails são desenhados para 600px; se o preview mostra em 900px, o logo parece proporcionalmente menor.
- **Correção candidata (não aplicar ainda):**
  1. Fixar largura do iframe do preview em **600px** (padrão de e-mail) em vez de `max-w-[640px]`.
  2. Renderizar `<img>` do logo com atributo `height` HTML e `width="auto"` (Outlook).
  3. Adicionar régua visual de 600px no preview para o admin ter referência.

## B.9 — Analytics de aberturas/cliques (CONCLUÍDO)

- **Migration `event_email_campaign_stats`:** FK para `event_email_campaigns`, `stats_json jsonb`, `fetched_at`, `updated_at`, RLS admin-only, unique por campaign_id.
- **Edge function `egoi-campaign-stats`:** `GET /campaigns/email/{id}/statistics` na E-goi, normaliza resposta (sent/delivered/opens/clicks/bounces/unsubscribes + taxas), aceita `campaign_id` (uma) ou `sync_all` (cron). Guards: auth admin OR `x-cron-secret`, master switch.
- **UI no Histórico:** ao expandir grupo, cada campanha `sent` mostra 4 cards (Envios / Abertura % / Cliques % / Baixas+Bounces) + botão "Carregar/Atualizar métricas" que dispara refresh sob demanda.
- **Persistência:** métricas são salvas no upsert e recarregadas automaticamente ao abrir a página.

### Pendências B.9 (backlog)
- **Cron 6h** (`sync_all=true`) — precisa habilitar no `pg_cron`; hoje a atualização é sob demanda pelo admin.
- Teste de contrato para a edge function (401 sem auth, 400 sem `campaign_id`).

## B.11 — Digest semanal automático (CONCLUÍDO)

- **site_setting `weekly_digest_enabled`** — toggle na aba "Digest semanal" em `/admin/email-config`.
- **Cron `weekly-digest-thursday-18h-brt`** — job `pg_cron` toda quinta 21:00 UTC (18h BRT) chama a edge function `weekly-digest-draft` com `x-cron-secret` (guardado em `internal_cron_secrets.weekly_digest_cron`).
- **Edge function `weekly-digest-draft`** — busca eventos ativos dos próximos 7 dias + últimos 3 posts publicados, renderiza HTML dark-neon inline (cores/logo do `email_template_settings`) e cria rascunho na E-goi (`POST /campaigns/email`, `mode: draft`). Guards: auth admin OU cron secret, master switch, `weekly_digest_enabled` (cron sempre respeita; admin pode `force: true`), `egoi_config` habilitado.
- **UI:** botão "Gerar rascunho agora" com resultado imediato (número de eventos/posts + hash da campanha).

### Pendências B.11 (backlog)
- Personalização do template por blocos (hoje é layout fixo).
- Analytics específico para digest (a B.9-extra já vai pegar as métricas quando a campanha for enviada, mas seria útil marcar `campaign_type = 'weekly_digest'` no histórico).

## Ondas restantes

- **B.10** — A/B test de assunto via UI simples (E-goi tem endpoint próprio).
- **B.12** — Segmentação por comportamento (abriu últimos 3, nunca abriu, clicou em ticket_link).

## Ordem sugerida
1. Validar B.11 em produção (gerar rascunho agora → conferir na E-goi).
2. Ligar o toggle "Digest semanal" e aguardar a próxima quinta.
3. B.10 (A/B assunto) — retorno rápido.
4. B.12 (segmentação) — precisa de ~30 dias de métricas B.9 acumuladas.


