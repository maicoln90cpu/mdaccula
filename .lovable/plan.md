## Diagnóstico (causa raiz)

Verifiquei o banco de dados: as descrições **estão salvas corretamente** (eventos recentes têm 28–117 caracteres no campo `description`). O bug está nas **consultas SELECT do frontend**, que esqueceram de pedir colunas:

| Arquivo | Linha | Problema |
|---|---|---|
| `src/hooks/useEvents.ts` | 43 | SELECT não pede `description`, `end_date`, `schedule`, `ai_context`, `pix_button_enabled`, `tickets_per_day` |
| `src/pages/EventDetail.tsx` | 146 | SELECT não pede `subtitle`, `address`, `end_date`, `schedule`, `updated_at` |

Resultado: o EventModal (aberto na página `/eventos`) e a página do slug (`/eventos/:slug`) **recebem o evento sem o campo `description`**, por isso a área fica vazia mesmo o banco tendo o conteúdo. Salvar funciona — o que falha é a leitura.

---

## Antes vs Depois

| | Antes | Depois |
|---|---|---|
| Modal do evento (lista pública) | Sem descrição (campo nem chega do banco) | Mostra descrição corretamente |
| Página do slug `/eventos/:slug` | Sem subtítulo/endereço/dias | Mostra todas as infos salvas |
| Banco | Já está correto | Sem alteração |
| Proteção | Nenhuma — qualquer dev pode esquecer uma coluna | Lista única de campos + teste que reprova SELECT incompleto |

---

## Fase 1 — Correção imediata (baixo risco)

**1.1.** Criar `src/lib/eventSelectFields.ts` com **uma única fonte da verdade**:
```ts
export const EVENT_PUBLIC_FIELDS = "id, title, subtitle, slug, venue, address, location_city, location_state, date, end_date, time, end_time, genres, lineup, description, schedule, ticket_link, vip_link, pix_button_enabled, tickets_per_day, image_url, views, blog_post_id, status, ai_context, created_at, updated_at";
```

**1.2.** Substituir o SELECT em `useEvents.ts` linha 43 por `EVENT_PUBLIC_FIELDS`.

**1.3.** Substituir o SELECT em `EventDetail.tsx` linha 146 por `EVENT_PUBLIC_FIELDS`.

**Vantagem:** uma só lista; trocar coluna em um lugar atualiza todas as telas.
**Desvantagem:** payload por evento aumenta ~200 bytes (irrelevante — já temos `limit(50)`).

---

## Fase 2 — Teste de regressão (impede o bug de voltar)

**2.1.** Criar `src/__tests__/lib/eventSelectFields.test.ts`:
- Garante que `EVENT_PUBLIC_FIELDS` contém: `description`, `subtitle`, `address`, `end_date`, `schedule`, `pix_button_enabled`, `tickets_per_day`.
- Se alguém remover um destes, o teste quebra no CI.

**2.2.** Criar `src/__tests__/architecture/event-select-fields.test.ts` (guard estático):
- Lê os arquivos `useEvents.ts` e `EventDetail.tsx`.
- Falha se encontrar `from("events").select("...string literal...")` em vez de `EVENT_PUBLIC_FIELDS`.
- Custo: <1s, sem rede, sem flake.

---

## Fase 3 — Validação manual (você executa)

Checklist após o deploy:
1. Abrir `/admin/events` → editar um evento com descrição → ver a descrição no Textarea ✅
2. Abrir `/eventos` → clicar num card → modal mostra descrição ✅
3. Abrir `/eventos/<slug>` → bloco "Sobre o evento" mostra descrição ✅
4. Criar evento novo com descrição → salvar → reabrir → descrição persiste ✅

---

## Pendências / próximos passos sugeridos (não agora)

- Aplicar o mesmo padrão de "campos centralizados" para `blog_posts` e `custom_links` (mesma classe de bug pode ocorrer lá).
- Avaliar trocar `select("*")` no admin por `EVENT_PUBLIC_FIELDS` para reduzir egress.

---

## Prevenção de regressão (resposta direta à pergunta "como corrigir de forma definitiva")

Três camadas combinadas:

1. **Fonte única** (`EVENT_PUBLIC_FIELDS`) — impossível esquecer uma coluna em uma tela e lembrar em outra.
2. **Teste unitário** — quebra se a constante perder campos críticos.
3. **Guard estático de arquitetura** — quebra se alguém voltar a usar string literal direto no SELECT de `events`.

CI bloqueante = merge impedido se qualquer uma das 3 falhar.

---

Posso seguir para a Fase 1 (correção) + Fase 2 (testes) juntas, ou prefere que eu faça só a correção primeiro e os testes em seguida?