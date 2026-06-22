## Problema (causa raiz)

O link de ingresso do evento Vintage foi salvo no banco como `www.sympla.com.br/vintage-culture-em-sp__3378076?afid=112122` — **sem o `https://` na frente**.

Quando o botão "Comprar Ingresso" renderiza esse valor em `<a href="www.sympla.com.br/...">` dentro da página `/eventos/<slug>`, o navegador trata como caminho relativo e concatena com a URL atual, gerando:

`https://mdaccula.com/eventos/www.sympla.com.br/vintage-culture-em-sp__3378076?afid=112122`

### Por que só esse evento?

O `EventForm` tem um `normalizeUrl` que **só adiciona `https://` automaticamente para domínios encurtadores** (bit.ly, linktr.ee, cutt.ly, tinyurl.com). Qualquer outro domínio digitado sem protocolo (sympla.com.br, ingresse.com, etc.) passa direto e é salvo "cru". Os outros eventos foram salvos com `https://` no início (manual ou copy-paste do navegador), por isso só o Vintage quebrou.

O mesmo bug existe no campo `vip_link` e no `schedule[].url` (links de ingresso por dia em eventos mesclados).

---

## Plano de correção em 3 camadas

### Camada 1 — Corrigir o dado existente (1 evento)
Atualizar no banco apenas a linha do Vintage:
```sql
UPDATE events
SET ticket_link = 'https://' || ticket_link
WHERE ticket_link LIKE 'www.%' OR ticket_link LIKE 'sympla.%' OR ...
```
Vou rodar antes um `SELECT` para listar todos os `ticket_link` e `vip_link` sem `http(s)://` e mostrar para você aprovar antes do `UPDATE`.

### Camada 2 — Corrigir o cadastro (impede salvar de novo errado)
No `src/components/events/EventForm.tsx`, ampliar `normalizeUrl` para o mesmo padrão já usado em `CustomLinkForm.tsx`:
- Se a URL não começa com `http://` nem `https://` (e não é vazia), adicionar `https://` automaticamente.
- Aplicar tanto em `ticket_link` quanto em `vip_link` (já é chamado nos dois) e nos campos `schedule[].url` dos eventos mesclados.

### Camada 3 — Proteção em runtime (defesa em profundidade)
Criar helper `src/lib/safeExternalUrl.ts` que recebe qualquer string e devolve uma URL com protocolo (ou `#` se inválida). Aplicar em **todos** os pontos onde o `ticket_link`/`vip_link`/`schedule.url` viram `<a href>`:
- `src/pages/EventDetail.tsx` (4 ocorrências: mobile/desktop x ticket/vip)
- `src/components/events/EventModal.tsx` (1 ocorrência)
- `src/components/events/TicketDayPickerModal.tsx` (link do dia escolhido)

Assim, mesmo que um dia entre dado ruim no banco por qualquer outra via (importação CSV, edição direta), o link nunca mais vira caminho relativo.

---

## Antes vs depois

| | Antes | Depois |
|---|---|---|
| Salvar `www.sympla.com.br/x` no form | salvo como `www.sympla.com.br/x` → quebra | salvo como `https://www.sympla.com.br/x` |
| Render de `ticket_link` sem protocolo (legado) | vira `/eventos/<slug>/<url>` | helper adiciona `https://` no href |
| Vintage no ar | botão quebrado | botão funcional |

---

## Checklist de validação manual

- [ ] Editar o evento Vintage no admin e confirmar que o campo já mostra `https://www.sympla.com.br/...`
- [ ] Abrir `/eventos/vintage-...` no preview e clicar em "Comprar Ingresso" → abre Sympla em nova aba
- [ ] Cadastrar evento novo digitando `www.sympla.com.br/teste` (sem https) e confirmar que salva com `https://`
- [ ] Conferir no `EventModal` (carrossel da home) que o link também abre certo

---

## Prevenção de regressão

- Teste unitário `src/__tests__/lib/safeExternalUrl.test.ts` cobrindo: URL com http, com https, sem protocolo, `bit.ly/x`, string vazia, `null`, `javascript:` (deve virar `#`).
- Comentário no `EventForm.normalizeUrl` apontando para o helper compartilhado, evitando divergência futura entre os dois `normalizeUrl` espalhados pelo projeto.

## Pendências/futuro (não nesta entrega)

- Unificar os 4 `normalizeUrl` espalhados (`EventForm`, `CustomLinkForm`, `RedirectsManager`, `Redirect.tsx`) em `src/lib/safeExternalUrl.ts`. Faço só se você aprovar — mexe em fluxos sensíveis (redirects).
- Validação no schema do banco (`CHECK ticket_link ~ '^https?://'`) — extra-seguro, mas pode quebrar importações antigas; deixo só como sugestão.
