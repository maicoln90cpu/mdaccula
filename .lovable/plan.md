## Diagnóstico — por que os artigos saem errados

### 1) Mapeamento ATUAL: campos enviados vs. campos usados pelo template

**Front envia (EventForm cria evento + EventsManager regerar):**
| Campo enviado | EventForm (criar) | EventsManager (regerar) | Existe no template `Evento Padrão`? |
|---|---|---|---|
| `eventName` | ✅ | ✅ | ✅ usado |
| `eventDate` | ✅ | ✅ | ✅ usado |
| `eventTime` | ✅ | ✅ | ❌ **não referenciado no user_prompt** |
| `endTime` | ✅ | ✅ | ❌ **não referenciado** |
| `eventLocation` | ✅ | ✅ | ✅ usado |
| `venue` | ✅ | ✅ | ❌ não referenciado |
| `address` | ✅ | ✅ | ❌ não referenciado |
| `locationCity` / `locationState` | ✅ | ✅ | ❌ não referenciado |
| `subtitle` | ✅ | ✅ | ❌ **não referenciado** (só citado no system) |
| `description` | ✅ | ✅ | ❌ não referenciado |
| `lineup` | ✅ | ✅ | ✅ usado (com `{{#if lineup}}`) |
| `genres` | ✅ | ✅ | ❌ não referenciado |
| `ticketLink` | ✅ | ✅ | ✅ usado |
| `vipLink` | ✅ | ✅ | ❌ **não referenciado** (só citado no system) |
| `eventImageUrl` | ✅ | ✅ | n/a |
| `aiContext` | ✅ | ❌ **NÃO ENVIADO** | injetado no system (block separado) |
| `weekday` (dia da semana) | ❌ não calculado | ❌ não calculado | ❌ inexistente |

**Conclusão:** o backend recebe quase tudo, mas o `user_prompt_template` só renderiza 6 campos. Os demais (subtitle, endTime, address, vipLink, description, genres, eventTime) entram no system prompt como "regra abstrata" sem o valor concreto sendo injetado — a IA não tem o dado para usar.

### 2) Causa de cada bug reportado

| Bug | Causa raiz |
|---|---|
| Artigo TANTRAROSA dizendo "lineup não confirmado" mesmo tendo lineup | O lineup É enviado, mas o template original não enfatiza obrigatoriedade. System prompt permite "se faltar, generalize". A IA hedge por padrão. |
| Mesmo artigo ignora "5% de desconto" do `aiContext` | `aiContext` só funciona quando criado via EventForm. Em re-geração via EventsManager **não é enviado** (e o evento sequer guarda esse campo no DB). |
| Artigo SUN diz "domingo" sendo sábado 19/09 | Nenhum cálculo de `weekday` é feito. IA infere errado a partir da data e alucina. |
| Artigo INDÚSTRIA inventa "use cupom MDACCULA" sendo cortesia | Mesmo problema do TANTRAROSA: `aiContext` foi preenchido na criação, mas system prompt do template **força** menção ao cupom MDACCULA ("REGRA CRÍTICA: SEMPRE mencione cupom MDACCULA"). O template sobrepõe o aiContext. |

### 3) Plano de correção (frontend + backend + DB)

#### A. **Banco de dados** (migração)
- Adicionar coluna `ai_context TEXT` em `events` para persistir o contexto e permitir re-geração consistente.

#### B. **Frontend**
1. **`EventForm.tsx`**: salvar `aiContext` na coluna nova `ai_context` ao criar/editar evento. Mostrar o textarea também em modo edição.
2. **`EventsManager.tsx` (`handleGenerateArticle`)**: enviar payload completo, incluindo:
   - `aiContext: event.ai_context`
   - `weekday`: nome do dia em PT-BR calculado via `Intl.DateTimeFormat('pt-BR', { weekday: 'long' })` da `event.date`
   - `dateFormatted`: data por extenso ("19 de setembro de 2026, sábado")
3. **`EventForm.tsx` (`blogPayload`)**: idem — adicionar `weekday` e `dateFormatted`.
4. Helper compartilhado novo: `src/lib/eventArticlePayload.ts` exportando `buildArticlePayload(event)` para evitar divergência entre os 2 call sites.

#### C. **Backend — `supabase/functions/generate-blog-post-v2/index.ts`**
1. **Bloco "DADOS ESTRUTURADOS DO EVENTO"** injetado no user prompt antes do template, contendo TODOS os campos com valor (key: value), garantindo que a IA tenha acesso literal mesmo se o template não referenciar:
   ```
   📋 DADOS OFICIAIS (use literalmente, não invente):
   - Nome: ...
   - Data: 19/09/2026 (sábado)
   - Horário: 23:00 às 06:00
   - Local: Arena Canindé, São Paulo - SP
   - Endereço: ...
   - Subtítulo/Promo: ...
   - Lineup confirmado: A, B, C
   - Gêneros: ...
   - Link ingressos: ...
   - Link VIP: ...
   - Descrição: ...
   ```
2. **Hierarquia de prioridade** explícita no system prompt:
   `aiContext > dados estruturados > template > conhecimento prévio`
3. **Anti-hedging**: se `lineup` veio preenchido, proibir frases tipo "lineup a confirmar"; se `endTime` veio, proibir "horário a confirmar".
4. **Override de cupom**: se `aiContext` mencionar "cortesia", "free", "gratuito", "sem venda", desativar a injeção da regra MDACCULA do template (override programático antes de chamar a IA).
5. **Cálculo de weekday no backend** (defesa em profundidade) caso o frontend não envie.

#### D. **Templates** (atualização de dados, não migração)
- Atualizar `user_prompt_template` do `Evento Padrão` (e demais relevantes) para referenciar todos os novos campos: `{{subtitle}}`, `{{endTime}}`, `{{address}}`, `{{vipLink}}`, `{{description}}`, `{{genres}}`, `{{weekday}}`, `{{aiContext}}`.
- Adicionar instrução explícita: "Se DADOS OFICIAIS contradisserem qualquer outra fonte, vencem os DADOS OFICIAIS."

### 4) Antes vs. Depois

**Antes:** Front envia 14 campos → template usa 6 → IA inventa o resto.  
**Depois:** Front envia 16 campos (+ weekday + ai_context persistido) → backend injeta bloco "DADOS OFICIAIS" obrigatório → template renderiza tudo + system reforça hierarquia → IA usa dado real ou omite (não inventa).

### 5) Vantagens / Desvantagens
- ✅ Dados sempre coerentes (dia da semana, lineup, cortesia, descontos personalizados).
- ✅ Re-geração via EventsManager mantém o aiContext.
- ✅ Reuso (helper único de payload).
- ⚠ Templates antigos ficam desatualizados — precisam ser revisados (faço junto).
- ⚠ Prompt fica maior → leve aumento de custo de tokens (~10-15%), aceitável.

### 6) Checklist de validação manual
1. Criar evento com lineup completo + aiContext "cortesia, sem venda" → artigo NÃO menciona MDACCULA, NÃO diz "lineup a confirmar".
2. Criar evento num sábado → artigo menciona "sábado" corretamente.
3. Editar evento existente, clicar "Regerar artigo" → aiContext salvo é respeitado.
4. Evento com `subtitle` "5% off com cupom MDACCULA" → artigo cita esse desconto.
5. Evento com vipLink → artigo menciona área VIP.

### 7) Pendências / fora deste escopo
- Sincronizar `event_link_synchronization` (já existe, sem mudanças).
- Auditoria retroativa dos artigos já gerados errado — fica para fluxo separado (botão "regerar" já cobre).
- Multi-event article (`generate-multi-event-article`) — mesmo padrão, mas em PR futuro.

### 8) Prevenção de regressão
- Logs estruturados já existem (`[generate-blog-post-v2] ...`); adicionar log explícito do bloco "DADOS OFICIAIS" enviado.
- Adicionar teste unitário em `__tests__/lib/eventArticlePayload.test.ts` validando weekday + presença de todos os campos.
