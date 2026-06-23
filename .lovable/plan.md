# Aplicação da skill SEO no projeto MDAccula

## Diagnóstico (o que já existe e está bom)

| Item | Estado |
|---|---|
| Meta tags por rota (`SEOHead` com react-helmet-async) | ✅ Existe, usado em 13 páginas públicas |
| JSON-LD (`StructuredData`) | ✅ Existe |
| `public/sitemap.xml` estático (8 rotas principais) | ✅ Existe |
| Edge Function `sitemap` (dinâmica, inclui eventos + posts + imagens) | ✅ Existe |
| `public/robots.txt` (bloqueia admin, bots agressivos, libera redes sociais) | ✅ Robusto |
| `public/llms.txt` | ✅ Existe |
| Open Graph + Twitter Card sitewide no `index.html` | ✅ Existe |
| H1 único na Home | ✅ Hero.tsx |

## Lacunas encontradas (o que falta)

1. **Páginas privadas sem `noindex`**: `/auth`, `/login`, `/404` (NotFound). Hoje podem aparecer no Google.
2. **Sem testes que protejam o SEO contra regressão** (skill exige).
3. **IndexNow não configurado** (avisa Bing/Yandex na hora que tem evento novo).
4. **Sem verificação** se a Edge Function `sitemap` está realmente servindo `/sitemap.xml` para o Google (suspeito que Cloudflare reescreve, mas preciso confirmar antes de mexer).

## Plano em fases (cada fase aprovada separadamente)

### Fase 1 — `noindex` em páginas privadas (risco zero)
- Adicionar `<SEOHead noindex />` em `src/pages/Auth.tsx`, `src/pages/Login.tsx`, `src/pages/NotFound.tsx`.
- Estender `SEOHead.tsx` para aceitar prop `noindex?: boolean` que emite `<meta name="robots" content="noindex, nofollow">`.
- **Antes vs depois**: hoje Google pode indexar tela de login → depois fica fora do índice.
- **Validação manual**: abrir `/login`, inspecionar `<head>` no DevTools, confirmar `<meta name="robots" content="noindex,nofollow">`.

### Fase 2 — Confirmar qual sitemap o Google vê (investigação, sem mudança)
- Rodar `curl -I https://mdaccula.com/sitemap.xml` e `curl https://mdaccula.com/sitemap.xml | head -20`.
- Se vier do estático (8 rotas) → propor reescrita Cloudflare para a Edge Function (que já lista todos os eventos e posts).
- Se vier da Edge Function → marcar como ok, nada a fazer.
- **Sem mudanças nesta fase**, só relatório.

### Fase 3 — Testes de proteção (skill exige)
- Criar `src/__tests__/seo/seo-contract.test.ts`:
  - `public/sitemap.xml` existe e **não** contém `/admin`, `/login`, `/auth`.
  - `public/robots.txt` existe, tem `Sitemap:` apontando para o domínio canônico, **não** tem `Disallow: /` global.
  - Páginas públicas exportam componente que referencia `SEOHead`.
- **Previne regressão**: se alguém adicionar `/login` ao sitemap por engano, o CI falha.

### Fase 4 — IndexNow (opcional, exige sua aprovação extra)
- Criar Edge Function `submit-indexnow` + secret `INDEXNOW_KEY` + arquivo `public/<KEY>.txt`.
- Cron diário às 08:00 envia URLs novas para Bing/Yandex.
- **Vantagem**: eventos novos aparecem em horas, não dias.
- **Desvantagem**: mais uma função para manter; só vale se o tráfego do Bing for relevante.

## O que **não** vou mexer (por segurança)

- **`react-helmet-async`**: a skill prefere hook próprio (`useDocumentMeta`), mas isso é só para projetos com SSR (TanStack Start). Vite + React puro com helmet funciona perfeitamente e já está em 13 páginas — trocar agora seria refatoração arriscada sem ganho.
- **Sitemap estático vs Edge Function**: vou apenas investigar (Fase 2) antes de propor qualquer alteração.
- **`StructuredData`, `index.html`, `robots.txt`**: estão bons.

## Pendências futuras (não agora)

- Migrar `react-helmet-async` para hook próprio (só se um dia migrar para SSR).
- Adicionar OG image individual por evento/post (hoje todos usam a hero padrão).

## Próximo passo

Aprove a **Fase 1** (a mais segura e de maior impacto imediato) e eu começo só por ela. Posso já investigar a Fase 2 em paralelo (sem mexer em nada, só `curl`).
