# Capacidades da hospedagem Lovable — perguntas pendentes

> Documento de rastreamento. Criado em 14/07/2026 durante a implementação das correções da
> auditoria SEO (ver `PENDENCIAS.MD` e o histórico de commits "fase 1 seo" / "fase 2 seo").

## Contexto

Confirmado com o time em 14/07/2026: **a Hostinger hoje só segura o domínio (DNS apontando
para o Lovable)** — `server.js` e a seção "Deploy na Hostinger (Node.js)" do `README.md` descrevem
uma arquitetura que **não está mais em uso**. Quem serve `mdaccula.com` de verdade, 100% do
tráfego, é a hospedagem própria do Lovable.

Isso invalida qualquer plano que dependesse de mexer no `server.js` ou no painel de build da
Hostinger (ex.: headers de segurança customizados, proxy para edge functions, prerender via
build command). Antes de continuar esses itens, precisamos saber o que a hospedagem do Lovable
realmente permite.

**Ação:** as perguntas abaixo devem ser enviadas ao suporte/documentação do Lovable. Assim que
as respostas chegarem, atualizar a coluna "Resposta" e o `status` de cada item — os itens do
plano de SEO bloqueados por cada pergunta estão listados para retomarmos o trabalho direto.

---

## Perguntas — prioridade alta (bloqueiam itens já em andamento)

### 1. Headers HTTP customizados (CSP, X-Frame-Options, Permissions-Policy)
**Pergunta:** É possível configurar headers de resposta HTTP customizados no deploy do Lovable
(via algum arquivo de config tipo `_headers`/`vercel.json`, ou uma opção no painel)?
**Por que importa:** Sem isso, não há onde aplicar Content-Security-Policy, X-Frame-Options e
Permissions-Policy — não existe mais um `server.js` rodando em produção pra fazer isso.
**Bloqueia:** Fase 2, item "Headers de segurança" (auditoria original, achado Médio).

### 2. Server-Side Rendering / prerendering
**Pergunta:** A hospedagem do Lovable suporta algum modo de SSR, edge-rendering ou
prerendering de rotas (mesmo que parcial), ou é exclusivamente hospedagem de SPA estática
(`vite build` + servir `dist/` puro)?
**Por que importa:** Este é o **achado crítico #1 de toda a auditoria de SEO** — hoje toda rota
(`/`, `/eventos/:slug`, `/blog/:slug`) devolve o mesmo HTML genérico pra qualquer crawler que não
execute JavaScript (redes sociais, a maioria dos bots de IA). Sem alguma forma de
SSR/prerendering na hospedagem real, esse achado não tem solução — não adianta gerar HTML
pré-renderizado localmente se o Lovable só publica o resultado de `vite build`.
**Bloqueia:** Fase 4 inteira do plano de correções.

### 3. Passos customizados de build (postbuild)
**Pergunta:** O pipeline de build do Lovable roda só `npm run build` (ou equivalente), ou aceita
scripts adicionais (`postbuild`) — e nesse ambiente de build é possível baixar/rodar um
Chromium headless (ex.: Playwright)?
**Por que importa:** Se a resposta da pergunta 2 for "não" (sem SSR nativo), a alternativa seria
gerar HTML pré-renderizado como parte do próprio build do Lovable. Só faz sentido se o ambiente
de build permitir isso sem estourar tempo/memória.
**Bloqueia:** Fase 4 (caminho alternativo, caso não exista SSR nativo).

---

## Perguntas — prioridade média

### 4. Redirects / rewrites customizados
**Pergunta:** É possível configurar redirects ou rewrites de rota no deploy (ex.: fazer
`mdaccula.com/functions/v1/*` apontar pra `xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/*`)?
**Por que importa:** O sitemap dinâmico e o feed RSS (edge functions) ficaram inacessíveis pelo
domínio próprio por causa disso — removemos as tags `<link>` que apontavam pra eles no
`index.html` como correção temporária (ver commit "fase 2 seo"). Se der pra configurar esse
proxy, podemos restaurar esses dois recursos.
**Bloqueia:** nada crítico — é uma melhoria, não um item bloqueado.

### 5. Status HTTP 404 real
**Pergunta:** Rotas inválidas (ex.: `/eventos/nao-existe-123`) hoje devolvem HTTP 200 (fallback
de SPA). É possível configurar a hospedagem pra devolver um 404 real nesses casos, ou isso
depende inteiramente de uma solução de SSR/prerendering (pergunta 2)?
**Por que importa:** Achado Médio da auditoria — soft-404 desperdiça crawl budget.
**Bloqueia:** item de baixa prioridade no plano, sem urgência.

### 6. Ambiente de preview/staging para testar mudanças arriscadas
**Pergunta:** Existe uma forma de publicar uma versão de teste (preview URL) antes de ir pro
domínio customizado `mdaccula.com`, pra validar mudanças arriscadas (como um CSP em modo
"valendo") sem afetar o site real primeiro?
**Por que importa:** Ajuda a testar os headers de segurança com mais confiança antes de aplicar
em produção.
**Bloqueia:** nada — só reduz risco de rollout dos itens acima.

---

## Perguntas — prioridade baixa (bom ter, não bloqueiam nada hoje)

### 7. Redirect www → apex
**Pergunta:** O redirecionamento de `www.mdaccula.com` pra `mdaccula.com` hoje é 302
(temporário); é configurado no painel do Lovable, ou isso é controlado pela Hostinger/DNS
(já que o domínio está lá)? Dá pra mudar pra 301 (permanente)?
**Bloqueia:** item de baixa prioridade, achado Médio da auditoria.

### 8. Deploy automático dos scripts de sitemap/IndexNow
**Pergunta:** Confirmar que os hooks `predev`/`prebuild` (que geram `public/sitemap.xml` e o
arquivo de verificação do IndexNow) realmente rodam a cada publish do Lovable — já que é o
Lovable quem builda, não mais a Hostinger.
**Por que importa:** Só confirmação — se isso já funciona (parece que sim, dado que o
`sitemap.xml` em produção está atualizado), não é uma pergunta urgente.

---

## Registro de respostas

| # | Pergunta (resumo) | Resposta do Lovable | Data | Item(s) desbloqueado(s) |
|---|---|---|---|---|
| 1 | Headers HTTP customizados | _pendente_ | | |
| 2 | SSR / prerendering | _pendente_ | | |
| 3 | Postbuild customizado | _pendente_ | | |
| 4 | Redirects/rewrites | _pendente_ | | |
| 5 | Status 404 real | _pendente_ | | |
| 6 | Preview/staging | _pendente_ | | |
| 7 | Redirect www→apex | _pendente_ | | |
| 8 | Confirmação predev/prebuild | _pendente_ | | |
