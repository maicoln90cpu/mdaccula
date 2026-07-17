## Parte 1 — Suas 3 perguntas sobre lockfiles

**1) O ambiente do Lovable depende do `bun.lock`?**
Sim. O sandbox do Lovable (preview + build na nuvem) roda com **Bun** como gerenciador. É por isso que o bot `gpt-engineer-app[bot]` atualiza o `bun.lock` (texto) a cada edição feita pelo chat — o Bun regrava o lockfile toda vez que instala/altera dependência. Se você apagar o `bun.lock`, o próximo build no Lovable **vai regerar do zero** a partir do `package.json`. Isso funciona, mas tem um risco pequeno: o Bun vai reresolver todas as versões dentro dos ranges do `package.json` (ex: `^1.2.3`) e pode subir para uma versão minor/patch mais nova do que a que estava travada — em teoria idêntico, na prática pode expor bug novo de dependência. **Recomendação: manter o `bun.lock` intacto.**

**2) O `bun.lockb` (binário antigo) ainda é usado?**
Não. A partir do Bun 1.2 (jan/2025) o formato oficial passou a ser o `bun.lock` texto, e o Bun **ignora** o `.lockb` quando existe um `bun.lock` ao lado. O fato do seu `bun.lockb` estar parado desde 19/02/2026 confirma isso — é lixo órfão. **Seguro remover.** O Bun no ambiente do Lovable vai continuar usando só o `bun.lock` texto, sem diferença nenhuma.

**3) Risco de divergência npm (local) ↔ Bun (Lovable)?**
Existe, mas é **baixo na prática** neste projeto:
- Fonte de verdade dos dois é o mesmo `package.json` com os mesmos ranges semver.
- Ao longo do tempo, um pode travar `1.2.3` e o outro `1.2.4` de uma sub-dependência transitiva, se rodarem `install` em dias diferentes.
- Impacto real quase sempre é zero (patch releases). Fica perigoso só se alguma dependência publicar patch com breaking change (raro).
- Como o **build oficial de produção** é o do Lovable (Bun), o `bun.lock` é o que importa para o que vai ao ar. Seu `npm install` local serve pra você rodar `npm run dev`, `npm test`, `npx tsc` — se der problema local, você reinstala.
- Mitigação opcional futura: padronizar tudo em Bun (deletar `package-lock.json` e usar `bun install`/`bun run` localmente também). Não faço isso agora — fica como sugestão.

**Ação proposta desta parte:** deletar apenas `bun.lockb`. Manter `bun.lock` e `package-lock.json`.

---

## Parte 2 — As 10 funções que falharam no deploy anterior

**Sim, dá pra tentar de novo por aqui.** As 10 funções falharam com `Module not found` apontando para arquivos em `supabase/functions/_shared/`. Duas hipóteses:

- **(a) Falha transiente do bundler** — o pacote foi montado sem o `_shared` naquela execução específica. Retry costuma resolver.
- **(b) Bug real no deployer do Lovable** — sempre falha para funções que importam `_shared`. Se for isso, retry vai falhar de novo com o mesmo erro, e aí a solução definitiva é o workflow do GitHub Actions com Supabase CLI (que respeita `_shared` corretamente).

**Plano:** rodar `supabase--deploy_edge_functions` só nas 10 que falharam e ver o resultado. Custo é baixo (~1 min), e o output nos diz qual das duas hipóteses é a verdadeira.

Lista das 10 (todas usam `_shared`):
```
weekly-digest-draft, weekend-agenda-draft, blog-digest-draft,
create-event-email-campaign, send-scheduled-email-campaigns,
generate-multi-event-article, generate-blog-post-v2,
generate-blog-post-from-topic, scan-event-sources,
send-mass-newsletter
```

*(A lista exata pode variar 1-2 nomes — vou reconferir contra o log do deploy anterior antes de disparar.)*

---

## Execução (quando você aprovar)

**Passo 1 — Limpeza do lockfile órfão** (risco: nenhum)
- `rm bun.lockb`

**Passo 2 — Retry das 10 funções** (risco: baixo — pior caso é falhar de novo com a mesma mensagem)
- Chamar `supabase--deploy_edge_functions` com a lista das 10.
- Se **todas subirem:** era transiente, missão cumprida.
- Se **falharem de novo com `Module not found` de `_shared`:** confirma bug do deployer do Lovable. Aí o caminho é criar o workflow do GitHub Actions (fica como próximo plano separado, não faço junto).

**Passo 3 — Validação manual (você)**
- [ ] Confirmar que `bun.lockb` sumiu do VS Code e o aviso de lockfile duplicado desapareceu.
- [ ] Abrir Admin → E-mail → Configuração e disparar um "teste" de weekly-digest / weekend-agenda / blog-digest — se o HTML do e-mail chegar com os blocos atualizados (múltiplos CTAs, contagem regressiva corrigida, etc), as edges novas estão no ar.
- [ ] Ver logs de 1 das 10 funções no dashboard do Supabase e confirmar timestamp de deploy recente.

---

## Prevenção de regressão

- Se o retry funcionar: nada a fazer — foi transiente.
- Se falhar: abrir o plano do **GitHub Actions workflow** (`.github/workflows/deploy-edge-functions.yml` rodando `supabase functions deploy` a cada push em `main`). Isso elimina a dependência do deployer do Lovable pra sempre e ainda te dá deploy automático no push do VS Code — resolvendo também a dor original da conversa anterior.
- Documentar em `README.md` que `bun.lock` é o lockfile oficial do ambiente Lovable e não deve ser apagado, e que `package-lock.json` é só para uso local.

---

## Pendências que ficam para depois (não faço agora)

1. Workflow do GitHub Actions para deploy automático das edge functions (só se o retry falhar, ou se você quiser blindagem definitiva).
2. Decidir se vale padronizar tudo em Bun localmente (apagar `package-lock.json` e usar `bun install`). Elimina o risco de divergência da pergunta 3, mas muda seu fluxo de trabalho no VS Code.

Aprova executar os passos 1 e 2?