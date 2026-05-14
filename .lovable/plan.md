
# Diagnóstico: por que os 2 posts deletados continuam aparecendo

Encontrei a causa exata. **Não é problema do Supabase nem do React** — é o **Service Worker (`public/service-worker.js`)** fazendo cache agressivo.

## Antes vs depois

| Situação | Hoje | Depois da correção |
|---|---|---|
| Você deleta um post | DELETE chega no banco e funciona ✅ | Igual, funciona ✅ |
| Lista é recarregada | SW intercepta o GET e devolve a **lista cacheada de até 30 min atrás** → post "fantasma" reaparece | SW detecta a mutação, **apaga o cache da tabela** e o próximo GET busca dados frescos |
| Você edita/cria evento | Mesmo problema: até 30 min servindo versão antiga | Atualização aparece imediatamente após salvar |
| Hard refresh (Ctrl+Shift+R) | Não resolve, porque o SW intercepta antes do navegador ir à rede | Continua resolvendo (e nem precisa mais) |

**Prova no código** (`public/service-worker.js`):
```js
const API_TTL = {
  '/rest/v1/blog_posts': 30 * 60 * 1000,  // 30 min
  '/rest/v1/events':     30 * 60 * 1000,  // 30 min
  ...
};
```
O SW usa Cache-First com TTL e **nunca invalida** quando você faz POST/PATCH/DELETE na mesma tabela.

---

# Sobre Realtime vs Egress (sua 2ª pergunta)

**Resposta direta:** Realtime do Supabase **não é egress significativo**. A diferença vai ser **mínima**, provavelmente menor que o polling de 15s que já está rodando hoje.

| Mecanismo | Custo de egress | Latência da atualização |
|---|---|---|
| Cache 30 min (hoje) | Mais baixo possível | Até 30 min ❌ |
| Polling 15s (já rodando no AIContent2) | Médio: 1 request a cada 15s **por aba aberta** | Até 15s |
| Realtime (websocket) | **Muito baixo**: 1 conexão persistente, mensagens de poucos bytes só quando há mudança | Instantâneo (<1s) ✅ |

Realtime usa WebSocket — **não conta como egress de API REST**. O Supabase tem cota separada generosa para Realtime (mensagens, não bytes). Para um painel admin usado por 1-2 pessoas, o consumo é desprezível.

**Recomendação:** podemos manter o cache agressivo do SW para o **público** (visitantes do site), e dar **bypass de cache + realtime** apenas para **rotas /admin/**. Assim você ganha velocidade na edição sem aumentar egress público.

---

# Plano de correção (em 3 etapas seguras)

## Etapa 1 — Corrigir o problema imediato (cache stale após mutação)

**Arquivo:** `public/service-worker.js`

Adicionar no fetch handler: quando interceptar um POST/PATCH/DELETE para `/rest/v1/<tabela>`, **deletar todas as entradas em cache** dessa tabela antes de retornar a resposta.

```js
// Pseudocódigo da mudança
if (method !== 'GET' && url.pathname.startsWith('/rest/v1/')) {
  const apiPath = extractApiPath(url);  // ex: /rest/v1/blog_posts
  // após a resposta voltar com sucesso (2xx):
  await invalidateApiCache(apiPath);    // apaga todas keys do API_CACHE que começam com apiPath
}
```

Subir versão do cache: `CACHE_VERSION = 'v12'` para forçar limpeza dos caches v11 existentes nos navegadores dos admins.

## Etapa 2 — Bypass de cache nas rotas /admin

**Arquivo:** `public/service-worker.js`

Quando o `Referer` ou `clientId` da requisição vier de uma página `/admin/*`, **pular o cache** e ir direto pro Supabase. Visitantes do site público continuam economizando egress.

## Etapa 3 — Realtime (substituir polling) — **opcional, recomendo depois de validar etapas 1 e 2**

**Arquivos:** `src/pages/admin/BlogManager.tsx`, `src/pages/admin/EventsManager.tsx`, `src/pages/admin/AIContent2.tsx`

Criar hook `useRealtimeTable(table, callback)` que abre canal Supabase e dispara refresh em INSERT/UPDATE/DELETE. Remover o `setInterval` de 15s do AIContent2.

**Pré-requisito SQL** (eu rodaria via migration):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE blog_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

---

# Vantagens / desvantagens de cada etapa

**Etapa 1 (invalidação no SW)**
- ✅ Resolve o bug imediato sem mudar arquitetura
- ✅ Zero impacto em egress
- ✅ Funciona offline-first como hoje
- ❌ Só atualiza a aba que fez a mutação. Outras abas/dispositivos esperam até 30min ou refresh

**Etapa 2 (bypass /admin)**
- ✅ Admin sempre vê dados frescos sem depender de invalidação
- ✅ Egress público (visitantes) **não muda**
- ❌ Egress do admin sobe um pouco (mas é 1-2 pessoas, irrelevante)

**Etapa 3 (realtime)**
- ✅ Multi-aba/multi-dispositivo sincronizado
- ✅ Remove polling de 15s — **reduz** egress do admin atual
- ❌ Precisa testar reconexão em conexões instáveis
- ❌ +1 dependência de Realtime do Supabase (já incluso no plano free)

---

# Checklist manual de validação (após cada etapa)

**Etapa 1:**
- [ ] Em /admin/blog, deletar um post → desaparece da lista imediatamente
- [ ] Editar título de um evento em /admin/events → mudança visível ao voltar pra lista
- [ ] Console DevTools → Application → Cache Storage → `mdaccula-api-v12` não contém entradas antigas após delete
- [ ] Em outra aba pública (não-admin), evento ainda carrega rápido (cache do público intacto)

**Etapa 2:**
- [ ] DevTools → Network: requisições em /admin mostram "from network" (não "from ServiceWorker")
- [ ] Em página pública (/blog), requisições continuam vindo do SW

**Etapa 3:**
- [ ] Abrir /admin/blog em 2 abas, deletar em uma → some da outra em <2s
- [ ] Verificar Monitor de Egress: polling de 15s desapareceu

---

# Pendências (futuro, fora deste plano)

- Botão "Regerar imagem" no card do PostsHistory (edge `regenerate-blog-image` já existe)
- Retry automático de imagem após 2 falhas no background da `generate-blog-post-v2`
- Considerar reduzir TTL do cache público de eventos de 30min → 10min (após Realtime estar validado)

# Prevenção de regressão

- Comentário no topo do `service-worker.js` documentando: **"Toda mutação em /rest/v1/<tabela> DEVE invalidar o cache dessa tabela. Não adicionar novas tabelas a CACHEABLE_API_PATHS sem garantir esse comportamento."**
- Teste manual no checklist do PR template: "Mutações refletem na UI sem hard refresh?"
- (futuro) Teste e2e Playwright que cria + deleta um post e valida desaparecimento

---

**Posso começar pela Etapa 1 (a correção crítica do bug que você reportou)?** Etapas 2 e 3 ficam para depois que você validar que o delete passou a funcionar.
