## Resposta rápida à sua dúvida sobre o fluxo

**Não, o Publish do Lovable NÃO faz deploy das edge functions.** São dois fluxos independentes:

| Fluxo | O que dispara deploy de edge function |
|---|---|
| **Publish (frontend)** | Só sobe o `dist/` (React build) para o CDN do Lovable. **Não toca em `supabase/functions/`**. |
| **Push no GitHub (VS Code)** | Sobe o código pro repo, mas **também não deploya** funções automaticamente — o Lovable só sincroniza funções quando o agente (eu) roda o deploy via ferramenta interna, ou quando você edita a função dentro do próprio chat do Lovable. |
| **Edição via chat Lovable** | Deploya automaticamente a função editada. |

Ou seja: se você edita `supabase/functions/xxx/index.ts` no VS Code e dá `git push`, o código chega no repo do Lovable, **mas a versão em produção no Supabase continua a antiga** até alguém rodar o deploy explicitamente. É exatamente o que aconteceu.

**Como resolver de forma definitiva:** sempre que mexer em edge functions pelo VS Code, me pedir "deploya as functions X, Y, Z" (ou "todas") depois do push. Não tem como automatizar 100% pelo seu lado sem configurar um workflow do GitHub Actions com Supabase CLI + token (mudança maior, pode entrar como pendência futura).

---

## Plano para agora

**Passo único:** rodar `supabase--deploy_edge_functions` com a lista das 52 funções do projeto (todas exceto `_shared`, que é biblioteca compartilhada e não é deployável).

Funções que vão ser deployadas (52):

```
apify-instagram-webhook, auto-article-cron, batch-convert-webp, blog-digest-draft,
blog-rss, bunny-stats, cleanup-storage, cleanup-sync-logs, compose-event-image,
convert-to-webp, create-event-email-campaign, create-recurring-events, diagnose-media,
egoi-campaign-stats, egoi-curl-probe, egoi-resources, egress-alert-cron,
fetch-link-metadata, generate-blog-post-from-topic, generate-blog-post-v2,
generate-blog-suggestions, generate-multi-event-article, geocode-event,
import-csv-data, import-storage, indexnow-notify, metrics-snapshot, migrate-to-bunny,
persist-logs, public-maps-config, regenerate-blog-image, render-static-map,
request-data-deletion, scan-event-sources, send-contact-email, send-mass-newsletter,
send-podcast-notification, send-scheduled-email-campaigns, send-test-email, sitemap,
supabase-usage, systemhealth, track-egress, track-link-click, track-redirect-click,
track-share, track-view, update-digest-schedule, upload-csv, upload-to-bunny,
weekend-agenda-draft, weekly-digest-draft
```

## Riscos

- **Baixo:** o deploy sobrescreve a versão atual em produção pela versão que está no repo (que é a mais nova, do VS Code). É exatamente o que você quer.
- Se alguma função tiver erro de sintaxe/import que passou batido, o deploy dela falha isoladamente — as outras 51 continuam subindo. Vou reportar quais falharam, se houver.
- Cada função individual leva ~5–15s pra subir. 52 funções = pode levar 2–5 min no total.

## Checklist manual pós-deploy

- [ ] Testar 1 função crítica que você sabia estar desatualizada (me diga qual — assim confirmamos que a nova versão está no ar).
- [ ] Ver logs de qualquer função que você suspeite que estava velha (via link do dashboard) e confirmar que o comportamento novo apareceu.

## Prevenção de regressão (opcional, futuro)

Se quiser blindagem permanente, dá pra criar um workflow em `.github/workflows/deploy-edge-functions.yml` que roda `supabase functions deploy --project-ref xfvpuzlspvvsmmunznxw` a cada push em `main`, usando um `SUPABASE_ACCESS_TOKEN` como secret do GitHub. É trabalho de ~30 min e some com essa dor pra sempre. Não faço agora — fica como pendência se você aprovar.

## Confirmação

Aprova rodar o deploy das 52 funções agora?
