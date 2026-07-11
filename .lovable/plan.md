# Plano — Lapidações finais

## Item 1 · Imagem do evento quebrada só no Outlook

**Diagnóstico:** os flyers são servidos pelo Bunny CDN em formato **WebP** (`mdaccula.b-cdn.net/...webp`). O Outlook desktop (Windows) **não suporta WebP** — por isso mostra o "X" só nele; Gmail/Apple Mail/Outlook web renderizam normal.

**Correção proposta:** passar as URLs de imagem por um **proxy que converte WebP → JPG na hora**, apenas dentro do HTML do e-mail. Sem re-upload, sem migração de arquivos.

**Opções técnicas:**

| Opção | Custo | Confiabilidade | Recomendação |
|---|---|---|---|
| **A) wsrv.nl (weserv.nl)** — proxy público gratuito | Zero | Alta (usado por milhares de e-mails corporativos) | ✅ Recomendada |
| B) Bunny Optimizer com `?format=jpg` | Precisa habilitar Optimizer na conta Bunny (~$9,50/mês) | Alta | Só se você já usa/quer Optimizer |
| C) Re-upload de todos os flyers como JPG | Trabalho manual + dobra egress | Alta | ❌ |

**O que farei (Opção A):**
No `src/lib/emailTemplates/blocks.ts`, criar helper:
```ts
function proxyForEmail(url: string): string {
  // Só reescreve se for URL http(s) apontando pra .webp — placeholders,
  // data URIs e outros formatos passam intactos.
  if (!/^https?:\/\//.test(url) || !/\.webp(\?|$)/i.test(url)) return url;
  const clean = url.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&output=jpg&q=85`;
}
```
Aplicar em 2 blocos: `hero_image` e `image_with_link`.

**Antes vs depois:**
- Antes: Outlook desktop mostra ícone "X" no flyer.
- Depois: Outlook baixa a mesma imagem convertida em JPG e renderiza normal. Demais clientes (Gmail, Apple, Outlook web) continuam recebendo JPG também — sem impacto perceptível de qualidade a 85%.

**Vantagens:**
- Zero configuração adicional.
- Free e cached na borda do wsrv.nl.
- Só afeta e-mail (site continua servindo WebP puro).

**Desvantagens:**
- Dependência de terceiro (wsrv.nl). Se cair, imagens do e-mail não carregam — mas mesmo assim Outlook não vê pior do que hoje.
- Latência extra de ~200 ms no primeiro carregamento por imagem (depois cacheia).

**Checklist manual:**
1. Enviar teste para Outlook desktop → flyer aparece.
2. Enviar teste para Gmail → flyer continua aparecendo (idealmente).
3. Ver HTML gerado no botão "Baixar HTML" e conferir se URLs `.webp` viraram `wsrv.nl/?url=...&output=jpg`.

**Prevenção de regressão:**
- Adicionar 1 teste unitário: `proxyForEmail("https://x.b-cdn.net/foo.webp")` → contém `wsrv.nl` + `output=jpg`; `proxyForEmail("https://x.com/foo.jpg")` → retorna a URL original.

---

## Item 2 · Mostrar assunto e preheader no preview ao vivo

**Hoje:** o preview mostra só o corpo do e-mail (iframe do HTML). Você configura assunto/preheader mas **não vê como fica na caixa de entrada** até enviar teste.

**Proposta:** adicionar acima de cada iframe uma **"linha de caixa de entrada"** simulando o Gmail/Outlook, com:
- Ícone/avatar circular com iniciais da marca (**MD**).
- Nome do remetente (ex.: `MDAccula`).
- **Assunto** em negrito.
- **Preheader** em cinza claro, na mesma linha, com `—` como separador.
- Horário simulado à direita ("agora").
- Barra fina separando do iframe.

**Placeholders resolvidos:** aplicar `{{event_title}}`, `{{date_label}}`, `{{venue_name}}`, `{{city_state}}` usando `previewData` (mock ou evento real selecionado). Assim, o preview reflete o texto **final** que o assinante veria.

**Onde entra:**
1. Editor unificado (aba "Editor" em EmailConfig): sobre o iframe de 600 px em `EmailTemplateEditor.tsx`.
2. Aba "Template" (preview lateral em `EmailConfig.tsx`, iframe de 640 px).

**Componente novo:** `src/components/admin/InboxPreviewHeader.tsx` — recebe `{ subjectTemplate, preheaderTemplate, previewData, senderName?, senderInitials? }` e resolve os placeholders localmente.

**Mock de layout (referência):**

```text
┌─────────────────────────────────────────────────────────┐
│ (MD)  MDAccula                                    agora │
│       Novo evento: Solomun SP — Solomun SP em Parque…   │
│       ─ negrito ─── ── cinza claro (preheader) ────     │
└─────────────────────────────────────────────────────────┘
```

**Antes vs depois:**
- Antes: você editava o assunto às cegas e só via depois de enviar teste.
- Depois: enquanto digita no campo "Assunto" ou "Preheader" (Item 1 do plano anterior), o preview em cima do iframe atualiza instantaneamente com os placeholders resolvidos.

**Vantagens:**
- Feedback imediato — reduz erros de placeholder (ex: esquecer `{{event_title}}`).
- Vê exatamente como o assinante enxerga o e-mail no inbox (assunto+preheader é 70% da decisão de abrir).
- Funciona em todos os tipos: `event_new`, `ticket_batch`, `weekend_agenda`, `weekly_digest`, `courtesy`, `custom`.

**Desvantagens:**
- Ocupa ~70 px extra em cima do preview (aceitável).

**Checklist manual:**
1. Abrir aba "Editor", trocar template → header do inbox atualiza com o novo assunto/preheader.
2. Trocar o evento no seletor (previewData muda) → placeholders `{{event_title}}` etc. reagem em tempo real.
3. Deixar assunto vazio → header mostra fallback "(sem assunto configurado)" em itálico cinza.
4. Testar em digest/weekend — usa `digestPreviewMeta.subject` quando disponível.

**Prevenção de regressão:**
- 1 teste unitário do helper `resolvePlaceholders(template, data)` com casos: substituição normal, template vazio, placeholder inexistente permanece literal.

---

## Ordem sugerida de deploy

1. **Fase 1 (baixo risco, visual):** Item 2 (InboxPreviewHeader). Só afeta admin, zero impacto no e-mail enviado.
2. **Fase 2 (afeta HTML enviado):** Item 1 (proxy WebP→JPG). Testar teste real em Gmail e Outlook antes de considerar concluído.

## Pendências

- Fase 5 do plano antigo (revisar templates com blocos novos) e melhorias payload E-goi seguem em aberto.

## Detalhes técnicos

Arquivos afetados:
- `src/lib/emailTemplates/blocks.ts` — helper `proxyForEmail` + uso em `hero_image` e `image_with_link`.
- `src/components/admin/InboxPreviewHeader.tsx` — novo componente.
- `src/components/admin/EmailTemplateEditor.tsx` — insere o header sobre o iframe.
- `src/pages/admin/EmailConfig.tsx` — insere o header sobre o iframe da aba "Template".

Aprovar para eu executar as duas fases?
