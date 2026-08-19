# Plano completo em fases seguras — pendências, atualizações e limpeza

Regra geral: **uma fase por vez**, validação manual entre fases, nada de agrupar itens de risco alto. Cada fase é reversível.

---

## Fase 1 — MCP reescrito leve (DECIDIDO: reescrever) (risco: muito baixo)

**Hoje:** existe um servidor MCP no projeto (`src/lib/mcp/`, `supabase/functions/mcp/`, plugin no `vite.config.ts`, passo extra no CI) que **nunca foi publicado com sucesso** — o pacote gerado passa de 26MB e a Supabase recusa (erro 413).

**Depois:** uma Edge Function MCP enxuta, escrita à mão, sem a biblioteca pesada que causa o 26MB. Mesmas 5 ferramentas públicas (próximos eventos, detalhe de evento, lista de posts, detalhe de post, links).

**Sub-fases:**
- **1.1** — Escrever a nova função MCP à mão (protocolo JSON-RPC simples + as 5 consultas já existentes), sem dependências pesadas.
- **1.2** — Remover o plugin do Vite, a dependência `@lovable.dev/mcp-js` e a pasta `src/lib/mcp/`.
- **1.3** — Simplificar o CI: o passo separado com `continue-on-error` do `mcp` deixa de ser necessário.
- **1.4** — Publicar a função e testar a conexão real a partir de um cliente (ChatGPT/Claude).

**Ganho:** o site passa a ser consultável por assistentes de IA (bom para descoberta), build mais leve e CI sem passo que sempre falha.

**Validação:** build e testes verdes; CI todo verde; a função `mcp` aparece publicada e responde.


---

## Fase 2 — Atualizações de dependências em lotes (risco: baixo → médio)

Feito em **3 sub-fases separadas**, nunca tudo junto.

### 2A — Lote seguro (correções de bug e patches)
Radix UI (todos), `@fontsource/*`, Playwright, Supabase JS, TanStack Query, `date-fns`, `dompurify`.
Só correções compatíveis. Risco quase nulo.
**Validação:** `npm test`, typecheck, abrir /admin e conferir menus, modais e selects.

### 2B — React Router v6 → v7 (risco médio, fase isolada)
- Vantagem: suporte ativo, compatível com React 19 no futuro, correções de segurança.
- Risco: o novo comportamento de transição pode mudar o *timing* visual das telas que carregam sob demanda (praticamente todas as páginas aqui).
- Caminho seguro: **primeiro ativar as "future flags" ainda na v6** (uma por vez), conferir a navegação, e só depois trocar a versão.
**Validação:** navegar por todas as rotas públicas + /admin, conferir que não pisca nem trava.

### 2C — Bibliotecas de UI com mudanças de API (uma por vez)
`@hookform/resolvers` (3 → 5), `recharts`, `sonner`, `vaul`, `next-themes`.
Cada uma num passo próprio, com conferência da tela que usa.

### 2D — Adiado de propósito
React 19 e Tailwind 4: são reescritas grandes, sem ganho prático hoje. Ficam registradas no roadmap, não são executadas agora.

---

## Fase 3 — Fechar pendências de e-mail (risco: baixo)

**R-062 (risco residual):** se a função morrer exatamente no meio da conversa com a E-goi, o cron de limpeza pode liberar um evento que já teve campanha criada — em tese, permitindo uma campanha duplicada.
**Opções:** (a) aceitar formalmente o risco e documentar como decisão encerrada; (b) adicionar uma verificação extra antes de liberar (o cron consulta a E-goi para checar se a campanha existe).
Recomendo **(b)** — é uma verificação de leitura, não muda o fluxo de envio.

**Validação:** teste de regressão novo + envio real de teste.

---

## Fase 4 — Monitoramentos abertos (risco: nenhum, é conferência)

- **Prerender SEO:** conferir o log da próxima execução do robô diário e concluir se o Cloudflare está bloqueando. Ação depende do log.
- **Egress / Storage:** revisar se a API do Supabase voltou a responder; se não, encerrar como "bônus perdido" (não afeta o alarme principal).
- **Chave antiga do Google Maps:** continua exposta e só o suporte da Lovable pode revogar — acompanhar a resposta deles.

---

## Fase 5 — Higiene final do projeto (risco: muito baixo)

- Rodar varredura de vulnerabilidades das dependências e corrigir o que sobrou depois da Fase 2.
- Conferir contagens dos documentos (tabelas, edge functions) contra o estado real do banco.
- Atualizar `CHANGELOG.md`, `PENDENCIAS.md`, `SECURITY-AUDIT.md`, `TESTING.md` com o que foi feito.
- Rodar a suíte completa: testes, typecheck, lint, E2E.

---

## Ordem sugerida e pontos de parada

1. Fase 1 (decisão MCP) → parar e conferir build.
2. Fase 2A → parar e conferir admin.
3. Fase 2B → parar e conferir navegação inteira.
4. Fase 2C (uma lib por vez) → conferir tela a tela.
5. Fase 3 → conferir envio de e-mail.
6. Fases 4 e 5 → conferência e documentação.

## Detalhes técnicos

- Nenhuma alteração de schema de banco prevista (sem risco de perda de dados).
- Toda fase é revertível: dependências voltam pela versão anterior no `package.json`; Fase 1A é remoção de código morto; Fase 3 adiciona verificação, não remove nada.
- Pré-requisito de cada fase: `npm test`, `npx tsc --noEmit -p tsconfig.app.json` e `npm run lint` verdes antes de seguir.

## Decisões que preciso de você

1. Fase 1: remover o MCP (1A) ou reescrever leve (1B)?
2. Fase 2B: encara a migração do Router v7 agora ou deixa para depois?
3. Fase 3: aceitar o risco residual do R-062 ou implementar a verificação extra?
