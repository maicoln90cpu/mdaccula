# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Última atualização:** 18/07/2026

---

## Como usar este documento

Cada pendência tem um tipo — isso decide onde ela deveria estar:

| Tipo | O que é | Pergunta que responde |
|------|---------|------------------------|
| 🗳️ **Decisão pendente** | Algo pronto ou quase pronto, mas travado numa escolha que só o usuário pode fazer | "O que estou esperando alguém decidir?" |
| 🔧 **Bug conhecido** | Um problema real já identificado, ainda sem correção aplicada | "O que sei que está quebrado?" |
| 👀 **Monitoramento** | Uma mudança já foi feita e entregue — falta só voltar numa data futura pra conferir o resultado | "O que preciso lembrar de checar depois?" |

Quando um item sai de "aberto" (foi decidido, corrigido, ou o monitoramento terminou), ele se torna uma entrada nova no `CHANGELOG.md` e **sai** deste arquivo — não fica registrado como "concluído" aqui.

Se o que você quer registrar é uma feature nova ainda não iniciada (não uma decisão travada, não um bug, não um checkpoint), ela vai pro `docs/ROADMAP.md`, não aqui.

---

## 👀 Monitoramento

### Checkpoint: confirmar redução de banda do Bunny CDN e decidir sobre Cloudflare
**Checar em:** ~02/08/2026 (15 dias após o rollout)
**Contexto:** Rollout de variantes de imagem (thumb/medium) concluído em 18/07/2026 — ver entrada no [`CHANGELOG.md`](CHANGELOG.md). Falta confirmar com tráfego real se a banda caiu como esperado.
**Passos:**
1. Rodar o botão **"Gerar Variantes para Eventos Ativos"** em `/admin/settings` → aba Mídia (ferramenta pronta, ainda não foi clicado).
2. Depois de ~15 dias de tráfego real, comparar em `/admin` → Métricas Reais → aba Bunny CDN a média de bytes/requisição contra o baseline anotado (~337KB/req, ~90GB/mês, ~$4-5/mês do item de banda).
3. Só reconsiderar Cloudflare-na-frente-do-Bunny se o custo continuar alto mesmo após a queda esperada — origin traffic do Bunny já é só 1,3% da banda total (cache já é eficiente), então o ganho do Cloudflare tende a ser baixo: ele reduziria *quem fatura* a banda, não os bytes entregues. Se o total de ~$10/mês não cair proporcionalmente, conferir também a fatura detalhada do Bunny (pode ter taxa mínima/storage não relacionado a banda).
**Responsável:** usuário revisa as métricas; IA confere se solicitado

---

## 🗳️ Decisões Pendentes do Usuário

### SEO: Decidir se RSS volta como arquivo estático
**Contexto:** O feed RSS dinâmico (edge function `blog-rss`) ficou inacessível pelo domínio próprio porque a hospedagem do Lovable não suporta redirects/rewrites customizados (confirmado em `docs/LOVABLE-PLATFORM-CAPABILITIES.md`, pergunta 4). A tag `<link rel="alternate" ... blog-rss>` foi removida do `index.html`.
**Decisão necessária:** gerar `public/rss.xml` como arquivo estático (mesmo esquema do `sitemap.xml`, atualizado a cada build) ou deixar o RSS de fora por enquanto — não fazia parte dos achados críticos da auditoria de SEO original.
**Impacto se ignorado:** baixo
**Desde:** 14/07/2026

---

### SEO: Pipeline de prerender via GitHub Actions (Fase 4 da auditoria)
**Contexto:** Achado **crítico #1** da auditoria de SEO (nota geral 42/100): hoje toda rota (`/`, `/eventos/:slug`, `/blog/:slug`) devolve o mesmo HTML genérico pra qualquer crawler que não execute JavaScript — redes sociais mostram sempre o preview da home ao compartilhar um evento/post específico, e JSON-LD não chega ao Google/IA sem a página hidratar primeiro. Confirmado com o Lovable (`docs/LOVABLE-PLATFORM-CAPABILITIES.md`, perguntas 2 e 3): sem SSR/prerender nativo, sem build customizado com Chromium.
**Decisão necessária:** sinal verde pra iniciar. Solução: gerar HTML pré-renderizado fora do Lovable (GitHub Actions + Playwright) e commitar de volta no repo — maior mudança de todo o plano de correções (workflow de CI novo + risco de loop com o auto-sync do Lovable, precisa ser desenhado com cuidado). Detalhamento técnico completo no plano de correções da sessão de auditoria SEO.
**Impacto se ignorado:** crítico (SEO/compartilhamento social)
**Desde:** 14/07/2026

---

## 🔧 Bugs Conhecidos

*(Nenhum no momento)*

---

## 📚 Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| CHANGELOG.md | Histórico do que já foi entregue | [/CHANGELOG.md](/CHANGELOG.md) |
| docs/ROADMAP.md | Features novas planejadas, fases e cronograma | [/docs/ROADMAP.md](/docs/ROADMAP.md) |
| README.md | Documentação técnica | [/README.md](/README.md) |
| docs/PRD.md | Requisitos do produto | [/docs/PRD.md](/docs/PRD.md) |
| docs/CODE_STYLE.md | Guia de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| docs/SECURITY-AUDIT.md | Auditoria segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| tabelas.md | Documentação do banco | [/tabelas.md](/tabelas.md) |
