# Plano — Lapidações finais no editor de e-mails

## Item 1 · Placeholders reconhecidos + botão "Ver placeholders"

**Problema (print 1):** o assunto salvo usa `{{event.title}}`, `{{event.date_label}}`, `{{event.venue}}`, `{{event.city_state}}` (notação com ponto). O resolver do preview só reconhece as versões com underline (`{{event_title}}`, `{{date_label}}`, `{{venue_name}}`, `{{city_state}}`) — por isso aparece "Placeholder não reconhecido" mesmo com evento selecionado.

**Correção:**
- Ampliar `resolvePlaceholders` em `src/components/admin/InboxPreviewHeader.tsx` para aceitar as duas notações (ponto e underline) e adicionar `{{weekend_range}}` e `{{time_label}}`.
- Corrigir o mesmo mapeamento no HTML final: em `src/lib/emailTemplates/blocks.ts` a função que resolve assunto/preheader antes do envio (`renderBlockedTemplate` + `dispatchEventDraft`) precisa aceitar as duas notações também, senão o e-mail sai com `{{event.title}}` literal.

Placeholders suportados (lista canônica):
- `{{event_title}}` = `{{event.title}}`
- `{{date_label}}` = `{{event.date_label}}`
- `{{time_label}}` = `{{event.time_label}}`
- `{{venue_name}}` = `{{event.venue}}`
- `{{city_state}}` = `{{event.city_state}}`
- `{{weekend_range}}` (só em Agenda FDS/Digest)

**Botão "Ver placeholders":** ao lado do campo Assunto, ícone `HelpCircle` que abre um `Dialog` (shadcn) listando os 6 placeholders com:
- Nome do placeholder em `<code>`.
- Descrição curta ("Título do evento", "Data já formatada", etc.).
- Botão `Copiar` (ícone Copy) que copia para o clipboard.
- Aviso de contexto: "weekend_range só funciona em Agenda FDS/Digest".

## Item 2 · Preview do editor não respeita blocos ocultos (print 5)

**Diagnóstico:** naquela tela o rótulo é "PREVIEW REAL (DADOS DO DISPARO)" — o preview vem de uma edge function (`weekly-digest-draft`) que renderiza a partir do **template salvo no banco**. Como o template estava "NÃO SALVO" e o usuário só ocultou blocos localmente, a edge function ignora o estado local e devolve o HTML como estava salvo.

**Correção — 2 partes:**
1. **Aviso claro:** se `isDirty === true` e o preview está no modo "real (edge function)", mostrar banner amarelo acima do iframe: *"Alterações não salvas — o preview real usa o template salvo. Salve para atualizar."* + botão "Salvar e recarregar".
2. **Fallback local:** quando `isDirty` for verdadeiro em Agenda FDS/Digest, cair no render local (`renderBlockedTemplate` client-side) usando `previewEvent` como mock, ao invés do HTML da edge. Assim, ocultar blocos reflete instantaneamente. Ao salvar, volta para o "real".

## Item 3 · Remover "Cuiabá" residual

Em `src/components/admin/settings/TimezoneSettings.tsx:22` o rótulo do fuso ainda lista `"Manaus, Cuiabá, Campo Grande"` como exemplos de cidades do fuso -4 (é factualmente correto — são cidades do fuso Amazônia). **Não vou remover Cuiabá dali** — é rótulo geográfico de fuso horário, não conteúdo de marca.

Migrations antigas (`20260709…`, `20260710…`) já corrigiram `footer_text` e blocos JSON de "Cuiabá" para "São Paulo". Vou:
- Rodar um `grep` final e confirmar que **nenhum** texto de marca/copy ainda cita Cuiabá fora do rótulo de fuso.
- Adicionar nota em `mem://index.md` (Core): *"MDAccula é São Paulo-SP. Nunca usar Cuiabá em copy/marca. Exceção: rótulo geográfico de fuso horário em TimezoneSettings."* — para eu não regredir isso no futuro.

## Antes vs depois

| Item | Antes | Depois |
|---|---|---|
| Placeholders | Só underline reconhecido → aviso amarelo constante | Ponto e underline aceitos + `{{weekend_range}}` |
| Descoberta | Rodapé com 4 placeholders escondidos | Botão "Ver placeholders" com modal + copiar |
| Preview ocultar bloco | Ignorado no modo "real" (usa DB) | Fallback local quando há alterações não salvas |
| Cuiabá | Já limpo em copy; rótulo de fuso mantido | Memória atualizada para prevenir regressão |

## Checklist manual

1. Assunto `{{event.title}} — {{event.date_label}}` com evento selecionado → header mostra "Solomun SP — Sáb, 12 jul", sem aviso amarelo.
2. Assunto `{{weekend_range}}` em Agenda FDS → header mostra o range real.
3. Clicar em "Ver placeholders" → modal abre com 6 itens; clicar em Copiar em `{{event_title}}` cola `{{event_title}}` no clipboard.
4. No Editor + Preview de Agenda FDS: ocultar todos os blocos → preview local fica vazio; banner "alterações não salvas" aparece; salvar → preview real recarrega vazio.
5. Enviar teste com assunto `{{event.title}}` → e-mail chega com o título real, não literal.

## Prevenção de regressão

- Teste unitário em `resolvePlaceholders`: aceita `{{event.title}}` e `{{event_title}}` como equivalentes.
- Teste unitário no resolver de assunto do `blocks.ts` (mesma cobertura, para o HTML enviado).
- Memory `mem://index.md`: entrada de marca "São Paulo, nunca Cuiabá em copy".

## Pendências (futuro)

- Traduzir os placeholders para nome amigável no bloco "Título do evento" (fora do escopo agora).
- Persistir a preferência do usuário entre "Preview local" vs "Preview real (edge)".

## Fases de deploy

1. **Fase A (baixo risco, só admin):** Itens 1 e 2 — placeholders + botão modal + fallback local. Sem impacto no HTML enviado, exceto o resolver do assunto que passa a aceitar mais formatos (retrocompatível).
2. **Fase B (memória):** Item 3 — atualização de memória, sem código.

Arquivos afetados:
- `src/components/admin/InboxPreviewHeader.tsx`
- `src/components/admin/EmailTemplateEditor.tsx` (botão modal + banner isDirty + fallback local para override)
- `src/lib/emailTemplates/blocks.ts` (resolver dual-notation no assunto/preheader do HTML enviado)
- `src/components/admin/PlaceholdersHelpDialog.tsx` (novo, ~60 linhas)
- `mem://index.md` (nota São Paulo)

Aprovar para executar?
