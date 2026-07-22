# Bloco de e-mail "Comprar Sem Taxa via Pix"

## Contexto

O site já tem um botão condicional "Comprar Sem Taxa via Pix" em `EventDetail.tsx`, que aparece só quando o evento tem `pix_button_enabled = true` e um `vip_link` (WhatsApp) preenchido — reaproveita o número do WhatsApp trocando a mensagem, com saudação diferente dependendo de qual número é (Gui vs MD). Não existe equivalente no sistema de blocos de e-mail (`_shared/emailBlocks.ts` / `src/lib/emailTemplates/blocks.ts`), usado pelos templates de disparo (evento novo, virada de lote, digests etc.). Pedido do usuário: trazer esse mesmo CTA pros e-mails, como um bloco a mais no editor de templates (podendo ser ocultado como qualquer outro bloco), e já incluir como teste no template "Virada de Lote".

## Decisões (aprovadas em brainstorming)

1. **Comportamento automático**: o bloco só renderiza (HTML e texto) quando o evento do disparo tem Pix habilitado — mesma regra do site. Sem Pix habilitado, o bloco desaparece sozinho do e-mail (sem precisar ocultar manualmente). O toggle manual "ocultar bloco" que já existe genericamente pra todos os blocos continua funcionando por cima disso.
2. **Estilo fixo**: gradiente verde WhatsApp (`#25D366` → `#128C7E`), sem opção de cor customizável — mantém o reconhecimento visual de "Pix/sem taxa" e evita confusão com o CTA principal de ingresso. Alinhamento (`align`) e largura total (`full_width`) continuam configuráveis, como nos demais blocos.
3. **Sem duplicar a lógica de montagem do link**: hoje o parsing do `vip_link` (telefone) + decisão da saudação (Gui/MD) + montagem da mensagem só existe inline em `EventDetail.tsx`. Extraída para `supabase/functions/_shared/pixWhatsApp.ts` (`buildPixWhatsAppLink(vipLink, eventTitle)`), usada tanto pelo frontend quanto pelo composer de e-mail — evita que os dois lados divirjam no futuro (mesmo princípio já aplicado em `eventCta.ts`, `egoiClient.ts`).

## Mudanças

- **`supabase/functions/_shared/pixWhatsAppLink.ts`** (novo): `buildPixWhatsAppLink(vipLink: string | null | undefined, eventTitle: string): string | null` — parsing de `vip_link`, extração do `phone`, saudação Gui/MD, montagem da URL final. Retorna `null` se `vip_link` ausente/inválido ou sem `phone`.
- **`EventDetail.tsx`**: substitui o IIFE inline por uma chamada a `buildPixWhatsAppLink(event.vip_link, event.title)` (via alias `@shared/pixWhatsAppLink.ts`), condicionado a `event.pix_button_enabled`.
- **`_shared/emailBlocks.ts`**:
  - `EventAnnouncementData` ganha `pixWhatsAppUrl?: string`.
  - `Block` union ganha `{ id: string; kind: "pix_button"; label?: string; align?: Align; full_width?: boolean }`.
  - Novo `case "pix_button"` no render HTML (bulletproof button, mesmo padrão VML/Outlook do `cta_button`, cores fixas do gradiente WhatsApp) e no render texto-puro (`>> LABEL: url`). Ambos retornam `""` se `event.pixWhatsAppUrl` estiver vazio.
- **`_shared/emailComposer.ts`**: `buildEventAnnouncementData()` calcula `pixWhatsAppUrl` via `buildPixWhatsAppLink(event.vip_link, event.title)` só quando `event.pix_button_enabled` é `true` (precisa confirmar que `EmailEventRow` já expõe `pix_button_enabled` — se não expuser, adicionar ao tipo/select).
- **`src/lib/emailTemplates/blocks.ts`**: `BLOCK_LABELS.pix_button = 'Botão Pix sem taxa'`; adiciona `'pix_button'` a `AVAILABLE_BLOCKS`; insere o bloco no preset `ticket_batch` (`buildPresetBlocks`), logo após o `cta_button` "Garantir ingresso agora".

## Testes

- `supabase/functions/_shared/pixWhatsAppLink_test.ts` (Deno): saudação Gui vs MD, `vip_link` ausente/malformado → `null`.
- `emailBlocks_test.ts` / `emailComposer.test.ts`: bloco `pix_button` renderiza quando `pixWhatsAppUrl` presente, vazio quando ausente; `buildEventAnnouncementData` só popula `pixWhatsAppUrl` com `pix_button_enabled = true`.
- Rodar `frontend-edge-render-parity.test.ts` pra garantir que o novo `case` foi replicado nos dois lados (frontend reexport + edge).
- `npm test`, `npx tsc --noEmit` e `npm run test:edge` (Deno) antes de considerar concluído.

## Verificação manual

- Abrir o editor de templates, template "Virada de Lote", conferir que o bloco aparece e pode ser ocultado/mostrado.
- Gerar uma prévia com um evento que tenha Pix habilitado (bloco aparece) e outro sem (bloco some sozinho).
