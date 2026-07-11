## Objetivo

Duas frentes independentes, entregues em etapas seguras:

**A. Melhorias no payload enviado à E-goi** (3 camadas: preheader, texto plano, tags)
**B. Fase 5 — revisar templates antigos** aproveitando os novos blocos criados (global_ref, hidden, event_card_multi, dedge_multi_cta, agenda_grid, countdown, etc.)

---

## Etapa 1 — Preheader dedicado no payload E-goi

**O que é hoje:** o preheader (aquele texto de preview que aparece ao lado do assunto na caixa de entrada) já é editável no admin e é embutido dentro do HTML como texto oculto. Alguns clientes de e-mail (Gmail app, Outlook novo) leem esse texto oculto; outros preferem um campo dedicado da API.

**O que muda:** passar o preheader também no campo `content.preheader` da API E-goi, além de continuar embutido no HTML (redundância intencional — cobre 100% dos clientes).

**Arquivos:**
- `supabase/functions/create-event-email-campaign/index.ts` → adicionar `preheader` no `createPayload.content`
- `supabase/functions/weekly-digest-draft/index.ts` → mesma coisa
- `supabase/functions/weekend-agenda-draft/index.ts` → mesma coisa

**Ganho esperado:** +5 a 15% de taxa de abertura (dado do setor quando o preheader é bem escrito e chega pelo campo oficial).

---

## Etapa 2 — Versão em texto plano (plain-text)

**O que é hoje:** só enviamos HTML. Clientes que não renderizam HTML (smartwatch, leitor de tela, filtros anti-spam agressivos, Outlook muito antigo) veem "e-mail em branco" ou caem no spam por não ter fallback.

**O que muda:** gerar automaticamente uma versão em texto puro a partir dos blocos do template (título, subtítulo, descrição, links do CTA) e enviar no campo `content.text` da E-goi.

**Como será feito:**
- Nova função `renderBlockedTemplateText(blocks, event, opts)` em `supabase/functions/_shared/emailBlocks.ts` — mesma lógica de `renderBlockedTemplate` (respeita `hidden`, expande `global_ref`), mas cospe texto ao invés de HTML.
- Cada `kind` de bloco tem sua versão texto: título vira linha em CAIXA ALTA, CTA vira "Link: URL", divider vira linha em branco, imagem/mapa some, etc.
- As 3 edge functions passam a enviar `content.text` além do `content.body`.

**Ganho esperado:** melhor entregabilidade (filtros anti-spam veem multipart bem formado), acessibilidade real para leitores de tela, fallback universal.

**Custo:** função nova de ~150 linhas + testes.

---

## Etapa 3 — Tags nas campanhas E-goi

**O que é hoje:** todas as campanhas ficam misturadas no painel E-goi. Não dá para filtrar "só digests" ou "só eventos" facilmente.

**O que muda:** cada campanha criada leva uma tag identificando o tipo:
- `mdaccula`, `evento-novo` → campanha de evento novo
- `mdaccula`, `digest-semanal` → digest de segunda
- `mdaccula`, `agenda-fds` → agenda de sexta
- `mdaccula`, `cortesia` → template de cortesia
- Se for teste A/B: adiciona `ab-test` e `variante-A` / `variante-B`

**Como será feito:** cada edge function que cria campanha adiciona um array `tags` no payload (documentação E-goi: campo `tags` aceita array de strings).

**Ganho esperado:** relatórios organizados por tipo, busca rápida no painel, base para automações futuras (ex.: "reenviar só os digests que tiveram bounce").

---

## Etapa 4 — Testes de regressão

Novos testes em `supabase/functions/_shared/emailBlocks_test.ts`:
- `renderBlockedTemplateText` respeita `hidden`
- `renderBlockedTemplateText` expande `global_ref`
- Texto gerado contém título, subtítulo, URLs de CTA
- Texto gerado NÃO contém tags HTML nem CSS

Contract tests adicionais em `src/__tests__/contracts/` verificando que o payload das edge functions inclui `preheader`, `text`, `tags` (usando mock do fetch).

---

## Etapa 5 — Fase 5: revisão dos templates antigos

**Motivo:** quando os blocos novos foram criados (`global_ref`, `event_card_multi`, `dedge_multi_cta`, `agenda_grid`, `countdown`, `hidden`), os templates que já existiam no banco (`email_templates`) não foram migrados — continuam usando os blocos antigos manualmente duplicados. Ex.: o rodapé social está copiado literalmente em cada template ao invés de referenciar um bloco global.

**Diagnóstico primeiro (só leitura):**
1. Listar todos os templates ativos em `email_templates` agrupados por `template_type`.
2. Para cada um, marcar:
   - Blocos que poderiam virar `global_ref` (rodapé, header, social icons repetidos)
   - Blocos que poderiam usar `event_card_multi` (listas de eventos manuais)
   - Blocos que poderiam usar `agenda_grid` (grades de fim de semana manuais)
   - Blocos que poderiam usar `countdown` (contagens regressivas manuais)

**Aplicação (com aprovação do relatório):**
- Criar/garantir os globais necessários em `email_global_blocks` (rodapé padrão, header padrão, social icons padrão).
- Substituir nos templates antigos os blocos duplicados por `global_ref` apontando para os globais.
- Substituir listas manuais pelos blocos dinâmicos novos.
- Nenhum template é deletado — só editado. Backup do JSON original em campo `previous_blocks` (migration adiciona coluna se não existir) para permitir rollback.

**Ordem de aplicação:** um `template_type` por vez, com preview lado a lado (antes/depois) antes de gravar.

**Ganho:** manutenção centralizada (mudar o rodapé em 1 lugar afeta todos), templates mais leves, uso dos recursos novos que já foram pagos em dev.

---

## Ordem sugerida de execução

1. **Etapa 1 (preheader)** — mudança pequena, ganho grande, quase zero risco.
2. **Etapa 3 (tags)** — mudança pequena, benefício organizacional imediato.
3. **Etapa 2 (texto plano)** — mudança média, requer testes.
4. **Etapa 4 (testes)** — trava as 3 anteriores contra regressão.
5. **Etapa 5 (revisão de templates)** — começa com o relatório de diagnóstico; aplicação só após você aprovar cada `template_type`.

Você pode parar em qualquer etapa. Recomendo pelo menos 1+3 juntas (são as mais baratas e de maior retorno visível).

---

## Antes vs Depois

| Item | Antes | Depois |
|---|---|---|
| Preheader | Só HTML embutido | HTML + campo oficial E-goi |
| Texto plano | Não existe | Gerado automaticamente |
| Tags | Sem tags | Categorizado por tipo |
| Templates antigos | Blocos duplicados | Usam globais + blocos dinâmicos |

## Riscos

- **Baixo** em 1 e 3 (aditivo ao payload; se E-goi ignorar, nada quebra).
- **Médio** em 2 (função nova; risco de texto mal formatado — mitigado por testes).
- **Médio** em 5 (edita templates existentes; mitigado por backup em `previous_blocks` e revisão antes/depois).

## Prevenção de regressão

- Testes Deno para `renderBlockedTemplateText`.
- Contract tests do payload E-goi.
- Coluna `previous_blocks` nos templates para rollback rápido da Fase 5.

## Pendências fora deste plano

- Nenhuma nova. Este plano fecha o ciclo de melhorias do sistema de e-mail iniciado nas fases anteriores.

Aprova executar tudo, ou quer fatiar (ex.: só 1+3 primeiro)?