# Capacidades da hospedagem Lovable

> Documento de rastreamento. Criado em 14/07/2026 durante a implementação das correções da
> auditoria SEO (ver `PENDENCIAS.MD` e o histórico de commits "fase 1 seo" / "fase 2 seo" /
> "fase 3 seo"). **Respondido em 14/07/2026** com base na documentação oficial
> (docs.lovable.dev).

## Contexto

Confirmado com o time em 14/07/2026: **a Hostinger hoje só segura o domínio (DNS apontando
para o Lovable)** — `server.js` e a seção "Deploy na Hostinger (Node.js)" do `README.md` descrevem
uma arquitetura que **não está mais em uso**. Quem serve `mdaccula.com` de verdade, 100% do
tráfego, é a hospedagem própria do Lovable.

**Status:** todas as 8 perguntas foram respondidas. Resumo: a hospedagem Lovable é uma SPA
estática pura, sem headers/redirects/rewrites customizáveis e sem SSR/prerender nativo. As
soluções viáveis (CSP via `<meta>`, prerender gerado no GitHub Actions e commitado, 404
mitigado via `noindex`) estão registradas em cada pergunta abaixo e já refletidas no plano de
correções.

---

## Perguntas — prioridade alta

### 1. Headers HTTP customizados (CSP, X-Frame-Options, Permissions-Policy)
**Pergunta:** É possível configurar headers de resposta HTTP customizados no deploy do Lovable?
**Resposta: ❌ Não suportado.** A hospedagem não processa `_headers`/`vercel.json`/`netlify.toml`
nem tem painel para isso.
**Alternativa viável:** `<meta http-equiv="Content-Security-Policy">` no `index.html` funciona
para CSP, mas com limitações (não cobre `frame-ancestors`, por exemplo). `X-Frame-Options` e
`Permissions-Policy` só existem como header HTTP de verdade — **sem equivalente meta, ficam sem
solução** na hospedagem Lovable.
**Item do plano:** Fase 2 "Headers de segurança" reescopada — só CSP via `<meta>`; X-Frame-Options
e Permissions-Policy registrados como limitação de plataforma, não implementáveis hoje.

### 2. Server-Side Rendering / prerendering
**Pergunta:** A hospedagem do Lovable suporta SSR, edge-rendering ou prerendering nativo?
**Resposta: ❌ Não.** SPA estática pura (`vite build` + fallback automático pro `index.html`).
Backend só via Edge Functions (rodam sob demanda, não no HTML inicial).
**Alternativa viável:** gerar HTML estático das rotas críticas **fora** do build do Lovable e
**commitar os arquivos no repo** (ex.: `dist/eventos/slug-x/index.html` ou, mais simples pro
nosso caso, arquivos estáticos versionados que o próprio `vite build` inclui no output). Migrar
de hospedagem está fora de escopo por decisão de negócio, não técnica.
**Item do plano:** Fase 4 segue viável **só pela rota de prerender estático gerado fora do
Lovable e commitado** — nunca dentro do pipeline de build do Lovable.

### 3. Build customizado / postbuild / Chromium no build
**Pergunta:** O pipeline de build do Lovable aceita hooks customizados, e roda Chromium headless?
**Resposta: ⚠️ Não no build do Lovable.** A doc não menciona hooks de build customizáveis nem
Chromium/Puppeteer disponível no pipeline. **Confirmado que os hooks `predev`/`prebuild` do
projeto (sitemap, IndexNow) já rodam hoje** porque fazem parte do próprio `npm run build` do npm
— não é uma feature do Lovable, é o próprio Node/npm executando o lifecycle hook antes do build.
Isso é diferente de adicionar Playwright/Puppeteer, que precisaria baixar um binário de Chromium
— isso não é suportado no ambiente de build do Lovable.
**Alternativa viável:** rodar o prerender (Playwright) no **GitHub Actions** — que já tem
Chrome disponível e já é usado pros testes e2e do projeto — e commitar o HTML gerado. O Lovable
então só serve esses arquivos como estáticos, sem precisar saber que foram prerenderizados.
**Item do plano:** Fase 4 exige pipeline no GitHub Actions com commit dos artefatos de prerender
de volta pro repo (ex.: um job que roda `scripts/prerender.mjs` e faz commit+push do resultado).

---

## Perguntas — prioridade média

### 4. Redirects / rewrites customizados
**Pergunta:** Dá pra fazer `mdaccula.com/functions/v1/*` apontar pra
`xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/*`?
**Resposta: ❌ Não.** Sem `_redirects`, sem `vercel.json`, sem painel.
**Alternativa viável:** manter o sitemap estático (`public/sitemap.xml`, já é o que fazemos) e,
se quisermos RSS de volta, gerá-lo como arquivo estático também (`public/rss.xml`) no mesmo
hook `prebuild` que já gera o sitemap — em vez de depender do endpoint dinâmico da edge
function. **Decisão pendente:** vale a pena reativar o RSS como arquivo estático agora, ou fica
de fora por enquanto (não fazia parte dos achados críticos da auditoria)?
**Item do plano:** a remoção das tags `<link rel="sitemap">`/`<link rel="alternate" ... rss>` do
commit "fase 2 seo" **vira definitiva** — sitemap dinâmico e RSS dinâmico não têm como funcionar
no domínio próprio nesta hospedagem.

### 5. Status HTTP 404 real
**Pergunta:** Dá pra configurar a hospedagem pra devolver 404 real em rotas inválidas?
**Resposta: ❌ Não.** O fallback SPA é automático e não configurável — toda rota desconhecida
devolve 200 + `index.html`. Mesmo com prerender (pergunta 2/3), só as rotas prerenderizadas
viram arquivos de verdade; o resto continua no fallback 200.
**Alternativa viável:** no `NotFound.tsx`, garantir `<meta name="robots" content="noindex">`
(a página já usa `SEOHead` com `noindex` — confirmar que está de fato sendo aplicado). Reduz o
dano de SEO mesmo sem 404 real.
**Item do plano:** vira "mitigação com noindex", não "correção real" — baixa prioridade,
já parcialmente resolvido pelo `SEOHead noindex` existente.

### 6. Preview/staging antes do domínio customizado
**Pergunta:** Dá pra testar mudanças arriscadas antes de ir pro `mdaccula.com`?
**Resposta: ✅ Sim.** Duas opções nativas do Lovable: **Share preview** (link público
`id-preview--*.lovable.app` por 7 dias, sem login) e o subdomínio permanente
**`mdaccula.lovable.app`** (gerado a cada publish, independente do domínio customizado).
**Item do plano:** usar `mdaccula.lovable.app` ou um Share preview pra validar a tag `<meta
CSP>` (item 1) antes de promover pro domínio customizado.

---

## Perguntas — prioridade baixa

### 7. Redirect www → apex, 301 vs 302
**Pergunta:** Dá pra mudar o redirect `www.mdaccula.com`→`mdaccula.com` de 302 pra 301?
**Resposta: ❌ Não — sempre 302.** É comportamento fixo da hospedagem Lovable quando dois
domínios estão conectados no mesmo projeto (o domínio primário é reversível pelo painel, daí o
302). Configurável em Project Settings → Domains → "Set as primary", mas o **código de status
não é configurável**.
**Item do plano:** aceitar como limitação de plataforma — não é bloqueante pra SEO (Google segue
302 e consolida sinais, só demora um pouco mais que com 301). Fechado, sem ação.

### 8. Deploy automático dos scripts de sitemap/IndexNow
**Pergunta:** Os hooks `predev`/`prebuild` rodam a cada publish do Lovable?
**Resposta: ✅ Sim, confirmado.** `npm run build` dispara `prebuild` automaticamente (é o próprio
ciclo de vida do npm, não uma feature específica do Lovable) — e como o Lovable roda `npm run
build` a cada publish, os scripts de sitemap/IndexNow rodam. Confirmado empiricamente: o
`public/sitemap.xml` em produção está sempre atualizado.
**Item do plano:** nenhum — comportamento já correto, só confirmação.

---

## Resumo executivo

| # | Pergunta | Resposta | Item do plano |
|---|---|---|---|
| 1 | Headers HTTP customizados | ❌ Não. Só CSP via `<meta>` | Fase 2 reescopada |
| 2 | SSR/prerender nativo | ❌ Não. Só prerender estático commitado | Fase 4 via GitHub Actions |
| 3 | Postbuild com Chromium no Lovable | ❌ Não. Usar GitHub Actions | Fase 4 depende disso |
| 4 | Redirects/rewrites | ❌ Não. Sitemap/RSS ficam estáticos | Remoção do commit "fase 2 seo" vira definitiva |
| 5 | 404 real | ❌ Não. Mitigar com `noindex` | Vira mitigação, baixa prioridade |
| 6 | Preview/staging | ✅ Sim (Share preview + `mdaccula.lovable.app`) | Desbloqueia teste seguro do item 1 |
| 7 | Redirect www→apex 301 | ❌ Só 302 na plataforma | Aceitar limitação, fechado |
| 8 | predev/prebuild automáticos | ✅ Sim, confirmado | Nenhuma ação necessária |
