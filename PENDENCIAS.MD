# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Última atualização:** 19/07/2026

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

### Checkpoint: confirmar que o prerender SEO está rodando e gerando HTML correto
**Checar em:** ~20/07/2026 (1-2 dias após o primeiro agendamento)
**Contexto:** Pipeline de prerender via GitHub Actions (`.github/workflows/prerender.yml`) implementado e testado manualmente em 19/07/2026 contra o site real (título/JSON-LD corretamente hidratados por rota) — ver entrada no [`CHANGELOG.md`](CHANGELOG.md). Falta confirmar que a primeira execução agendada (09:00 UTC / 06:00 BRT) rodou e commitou `public/_prerendered/**` de verdade.
**Passos:**
1. Conferir a aba Actions do GitHub (`.github/workflows/prerender.yml`) — a run agendada rodou sem erro?
2. Conferir se um novo commit `chore(prerender): atualiza HTML pré-renderizado [skip ci]` apareceu no histórico.
3. `curl -A "facebookexternalhit"` numa rota de evento publicada e confirmar que o HTML já vem com título/JSON-LD específicos, não o genérico da home.
**Responsável:** IA confere quando solicitado

---

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

*(Nenhuma no momento)*

---

## 🔧 Bugs Conhecidos

### SEO: og:title/og:description não mudam por rota (ficam sempre o genérico do site)
**Contexto:** Encontrado em 19/07/2026 durante o teste manual do prerender — `document.title` é corretamente atualizado por `SEOHead.tsx`/react-helmet-async em cada rota (ex.: evento mostra "🎩 Helvétia Open Bar | MDAccula"), mas as tags `og:title`/`og:description`/`twitter:title`/`twitter:description` continuam com o texto genérico do site ("MDAccula - A maior agência de música eletrônica de São Paulo...") mesmo em páginas de evento/post específicas. Compartilhar um link de evento no WhatsApp/Instagram/Facebook hoje mostra o preview genérico do site, não o do evento.
**Impacto:** médio (mais visível agora que o prerender entrega HTML real pra crawlers — antes disso as redes sociais só viam o shell genérico de qualquer forma, então o sintoma não mudava nada; agora que o HTML é específico por rota, esse gap fica mais evidente)
**Ação sugerida:** investigar `SEOHead.tsx` — provavelmente falta atualizar as props `og:title`/`og:description`/`twitter:*` junto com o `<title>` quando a rota muda.
**Desde:** 19/07/2026

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
