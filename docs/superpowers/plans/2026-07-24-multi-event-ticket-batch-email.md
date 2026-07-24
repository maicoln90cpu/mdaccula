# Multi-Event Ticket-Batch Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin send ONE e-mail covering multiple events whose ticket batch is changing the same day, laid out as a 2-column grid, instead of one "flyer enorme" e-mail per event.

**Architecture:** Reuse the existing `WeekendEventItem` data shape and email-block system (`_shared/emailBlocks.ts` is the single canonical renderer for both HTML and edge; the frontend `src/lib/emailTemplates/*.ts` files are thin re-export wrappers — never duplicate render logic). Add one new block kind (`event_grid`, 2 cards per row), one new template type (`ticket_batch_multi`), one new pure composer function (`buildMultiEventAnnouncementData`), one new Edge Function (`create-multi-event-email-campaign`) that claims N events atomically and inserts N rows sharing the same `egoi_campaign_id`, and a multi-select mode in the "Envio Manual" tab.

**Tech Stack:** Deno Edge Functions (Supabase), React + TypeScript admin (Vite), Postgres (Supabase), Vitest + Deno test runner.

## Global Constraints

- Grid is always 2 columns, never configurable (per approved spec — do not add a `columns` field).
- Event selection for this template type is always manual (checklist), never automatic by date.
- Subject/title text must come from the SAME `{{event_title}}` placeholder mechanism already used elsewhere (`buildEmailMeta`/`resolveEmailPlaceholders` in `supabase/functions/_shared/emailMeta.ts`) — do not invent a second placeholder system.
- Every selected event must show as "sent" in its own history row in `event_email_campaigns` — implemented as N rows sharing one `egoi_campaign_id`, never a new join table.
- Claim of the N events must be all-or-nothing: if any selected event is already dispatched or inactive, roll back every claim made in that call and return an error — never send a "partial" grid.
- Never duplicate render logic between `supabase/functions/_shared/emailBlocks.ts` and `src/lib/emailTemplates/blocks.ts` — the frontend file only re-exports types/render functions and owns admin-only concerns (labels, presets, available-blocks list).
- Spec reference: `docs/superpowers/specs/2026-07-24-multi-event-ticket-batch-email-design.md` (approved).

---

### Task 1: Migration — permitir `ticket_batch_multi` em `email_templates.type`

**Files:**
- Create: `supabase/migrations/20260724120000_email_templates_ticket_batch_multi_type.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: DB now accepts `type = 'ticket_batch_multi'` in `email_templates`.

- [ ] **Step 1: Write the migration file**

```sql
-- Permite o novo tipo de template "Virada de lote (múltiplos eventos)" —
-- e-mail único com grid de 2 colunas cobrindo vários eventos que viram de
-- lote no mesmo dia, em vez de um e-mail por evento.
ALTER TABLE public.email_templates DROP CONSTRAINT email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type = ANY (ARRAY[
    'event_new'::text, 'ticket_batch'::text, 'ticket_batch_multi'::text,
    'weekly_digest'::text, 'weekly_digest_editorial'::text,
    'weekend_agenda'::text, 'courtesy'::text, 'custom'::text, 'blog_digest'::text
  ]));
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name: `email_templates_ticket_batch_multi_type`, query: the SQL above) — this both runs it against the live DB and persists the migration file in the repo, matching the project's established convention (never hand-edit `supabase/config.toml`/`tabelas.md` schema docs directly for this — just confirm the constraint applied).

- [ ] **Step 3: Verify**

Run this query via the Supabase MCP `execute_sql` tool and confirm the new value appears in the constraint definition:
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'email_templates_type_check';
```
Expected: the returned `CHECK` clause includes `'ticket_batch_multi'::text`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260724120000_email_templates_ticket_batch_multi_type.sql
git commit -m "feat(db): permite tipo ticket_batch_multi em email_templates"
```

---

### Task 2: Bloco `event_grid` — tipo + render (2 colunas fixas)

**Files:**
- Modify: `supabase/functions/_shared/emailBlocks.ts` (add `gridEvents` field, `event_grid` Block variant, HTML render case, plain-text render case)
- Test: `supabase/functions/_shared/emailBlocks_test.ts`

**Interfaces:**
- Consumes: `WeekendEventItem` (already defined at `emailBlocks.ts:24-39` — reused as-is).
- Produces: `EventAnnouncementData.gridEvents?: WeekendEventItem[]` (new field, consumed by Task 3); `Block` variant `{ id: string; kind: "event_grid"; title?: string; eyebrow?: string; align?: Align }`.

- [ ] **Step 1: Write the failing tests**

Add to `supabase/functions/_shared/emailBlocks_test.ts` (check the existing file's imports at the top first — it already imports `renderBlockedTemplate` and a base `EventAnnouncementData` fixture; follow that same pattern for these new tests):

```ts
Deno.test("event_grid: renderiza 2 cards por linha (HTML)", () => {
  const event = {
    ...baseEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", timeLabel: "22h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a", ticketUrl: "https://x.com/ingresso-a" },
      { id: "2", title: "Evento B", dayLabel: "23/08", timeLabel: "23h", venue: "Clube Y", imageUrl: "https://x.com/b.jpg", eventUrl: "https://mdaccula.com/eventos/b", ticketUrl: "https://x.com/ingresso-b" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event, null, null, { preview: false });
  assertStringIncludes(html, "Evento A");
  assertStringIncludes(html, "Evento B");
  assertStringIncludes(html, "https://x.com/ingresso-a");
  assertStringIncludes(html, "https://x.com/ingresso-b");
  // 2 colunas: as duas âncoras de evento devem aparecer dentro da MESMA <tr>
  const trWithBoth = html.split("<tr>").find((chunk) => chunk.includes("Evento A") && chunk.includes("Evento B"));
  assertEquals(!!trWithBoth, true);
});

Deno.test("event_grid: número ímpar de eventos deixa a última linha com 1 card só", () => {
  const event = {
    ...baseEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a" },
      { id: "2", title: "Evento B", dayLabel: "23/08", venue: "Clube Y", imageUrl: "https://x.com/b.jpg", eventUrl: "https://mdaccula.com/eventos/b" },
      { id: "3", title: "Evento C", dayLabel: "24/08", venue: "Clube Z", imageUrl: "https://x.com/c.jpg", eventUrl: "https://mdaccula.com/eventos/c" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event, null, null, { preview: false });
  assertStringIncludes(html, "Evento C");
  // Só 2 pares de 50%: 3 eventos = 2 fileiras (2+1), não 4 células de 50%.
  const widthOccurrences = (html.match(/width="50%"/g) || []).length;
  assertEquals(widthOccurrences, 3);
});

Deno.test("event_grid: lista vazia não renderiza nada fora de preview", () => {
  const event = { ...baseEvent, gridEvents: [] };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event, null, null, { preview: false });
  assertEquals(html.includes("event_grid"), false);
  assertEquals(html.trim().includes("<tr>"), false);
});

Deno.test("event_grid: respeita eyebrow/title customizados", () => {
  const event = {
    ...baseEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const, eyebrow: "ÚLTIMAS HORAS", title: "Vira o lote hoje" }];
  const html = renderBlockedTemplate(blocks, event, null, null, { preview: false });
  assertStringIncludes(html, "ÚLTIMAS HORAS");
  assertStringIncludes(html, "Vira o lote hoje");
});

Deno.test("event_grid: versão texto puro lista os eventos", () => {
  const event = {
    ...baseEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", timeLabel: "22h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a", ticketUrl: "https://x.com/ingresso-a" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const text = renderBlockedTemplate(blocks, event, null, null, { preview: false, format: "text" });
  assertStringIncludes(text, "Evento A");
  assertStringIncludes(text, "https://x.com/ingresso-a");
});
```

If the test file doesn't already export/import a `baseEvent` fixture and a `format: "text"` option for `renderBlockedTemplate`, check the existing tests for `weekend_grid` in the same file first (`grep -n "weekend_grid" supabase/functions/_shared/emailBlocks_test.ts`) and mirror the exact fixture/options shape they use instead of inventing a new one — the two block kinds must be tested identically.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd supabase/functions/_shared && deno test emailBlocks_test.ts
```
Expected: FAIL — `event_grid` is not a valid `Block["kind"]` (TypeScript error) and/or the render switch has no case for it (empty output).

- [ ] **Step 3: Add the type and the field**

In `supabase/functions/_shared/emailBlocks.ts`, add `gridEvents` to `EventAnnouncementData` (near `weekendEvents`, around line 84):

```ts
  weekendEvents?: WeekendEventItem[];
  /** Eventos selecionados manualmente para o bloco `event_grid` (2 colunas) — usado pelo template "Virada de lote (múltiplos eventos)". Nome separado de `weekendEvents` de propósito: são features independentes, não acopladas. */
  gridEvents?: WeekendEventItem[];
```

Add the new `Block` variant to the union (right after the `weekend_grid` line, around line 134):

```ts
  | { id: string; kind: "weekend_grid"; layout?: "cartaz" | "timeline"; title?: string; eyebrow?: string; show_article_link?: boolean; day_bar_color?: string; align?: Align }
  | { id: string; kind: "event_grid"; title?: string; eyebrow?: string; align?: Align }
```

- [ ] **Step 4: Implement the HTML render case**

In the HTML render switch, add this case right after the `case "weekend_grid": { ... }` block closes (after line 764 in the current file):

```ts
    case "event_grid": {
      const list = event.gridEvents || [];
      const align = block.align ?? "left";
      const eyebrow = escape(block.eyebrow || "");
      const title = escape(block.title || "");
      const showHeader = !!(block.eyebrow || block.title);
      const header = showHeader ? `<tr><td style="padding:16px 32px 4px 32px;text-align:${align};">
        ${eyebrow ? `<div style="color:${primary};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${eyebrow}</div>` : ""}
        ${title ? `<h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${title}</h2>` : ""}
      </td></tr>` : "";

      if (list.length === 0) {
        if (!ctx.preview) return "";
        return `${header}<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            🎟️ Aqui aparece o grid de eventos selecionados quando o e-mail for montado.
          </div>
        </td></tr>`;
      }

      const card = (ev: WeekendEventItem) => {
        const url = escape(ev.eventUrl || "#");
        const ctaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
        const btn = ev.ticketUrl
          ? `<a href="${escape(ev.ticketUrl)}" style="display:inline-block;width:100%;box-sizing:border-box;padding:10px 12px;background:${gradient};color:#ffffff;font-size:11px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;border-radius:8px;">${ctaLabel}</a>`
          : "";
        return `<td width="50%" style="padding:8px;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <tr><td style="padding:0;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="260" border="0" style="display:block;width:100%;max-width:260px;height:auto;border:0;outline:none;">
              </a>
            </td></tr>
            <tr><td style="padding:12px 14px 14px 14px;">
              <div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
              <div style="color:#ffffff;font-size:14px;font-weight:800;line-height:1.2;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
              <div style="color:#a1a1aa;font-size:11px;margin-bottom:8px;">${escape(ev.venue)}</div>
              ${btn}
            </td></tr>
          </table>
        </td>`;
      };

      const rows: string[] = [];
      for (let i = 0; i < list.length; i += 2) {
        const pair = list.slice(i, i + 2);
        const cells = pair.map(card).join("");
        rows.push(`<tr><td style="padding:2px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`);
      }
      return `${header}${rows.join("")}`;
    }
```

- [ ] **Step 5: Implement the plain-text render case**

In the plain-text render switch, add this case right after `case "weekend_grid": { ... }` closes (after line 1128):

```ts
    case "event_grid": {
      const list = event.gridEvents || [];
      if (!list.length) return "";
      const header = (block.title || "Eventos selecionados").toUpperCase();
      const rows = list.map((ev) =>
        `- ${ev.dayLabel}${ev.timeLabel ? " " + ev.timeLabel : ""} · ${ev.title} @ ${ev.venue} — ${ev.ticketUrl || ev.eventUrl}`
      );
      return `${header}\n${rows.join("\n")}`;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd supabase/functions/_shared && deno test emailBlocks_test.ts
```
Expected: all tests pass, including the 5 new ones.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/emailBlocks.ts supabase/functions/_shared/emailBlocks_test.ts
git commit -m "feat(email): bloco event_grid (2 colunas fixas) para múltiplos eventos"
```

---

### Task 3: `buildMultiEventAnnouncementData` — composição multi-evento

**Files:**
- Modify: `supabase/functions/_shared/emailComposer.ts` (new function + new `validateEmailBlocks` case)
- Modify: `src/lib/emailTemplates/emailComposer.ts` (re-export the new function)
- Test: `src/__tests__/lib/emailComposer.test.ts` (existing Vitest suite already imports from `@shared/emailComposer.ts` through the frontend re-export — follow its existing import style)

**Interfaces:**
- Consumes: `EmailEventRow` (existing type, `emailComposer.ts:34-55`), `getEventCtaButtonLabel`/`DEFAULT_EVENT_CTA_TYPE` (existing, from `./eventCta.ts`).
- Produces: `buildMultiEventAnnouncementData(events: EmailEventRow[], opts?: { baseUrl?: string }): EventAnnouncementData` — consumed by Task 5 (Edge Function) and Task 8 (frontend manual send tab, via the re-export).

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/lib/emailComposer.test.ts` (check its existing imports first — it should already import `buildEventAnnouncementData` and a sample `EmailEventRow` fixture from `@/lib/emailTemplates/emailComposer`; reuse the same fixture pattern):

```ts
import { buildMultiEventAnnouncementData } from '@/lib/emailTemplates/emailComposer';

describe('buildMultiEventAnnouncementData', () => {
  const baseEvent = (overrides: Partial<Parameters<typeof buildMultiEventAnnouncementData>[0][number]> = {}) => ({
    id: 'evt-1',
    title: 'Evento Base',
    subtitle: null,
    slug: 'evento-base',
    date: '2026-08-23',
    time: '22:00',
    venue: 'Clube X',
    location_city: 'São Paulo',
    location_state: 'SP',
    image_url: 'https://cdn.mdaccula.com/evento-base.webp',
    description: null,
    ticket_link: 'https://ingressos.com/evento-base',
    vip_link: null,
    cta_type: null,
    lineup: null,
    latitude: null,
    longitude: null,
    venue_lat: null,
    venue_lng: null,
    pix_button_enabled: null,
    ...overrides,
  });

  it('gera título automático no singular para 1 evento', () => {
    const result = buildMultiEventAnnouncementData([baseEvent()]);
    expect(result.eventTitle).toBe('1 evento com novo lote hoje');
  });

  it('gera título automático no plural para N eventos', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ id: 'a' }),
      baseEvent({ id: 'b' }),
      baseEvent({ id: 'c' }),
    ]);
    expect(result.eventTitle).toBe('3 eventos com novo lote hoje');
  });

  it('mapeia cada evento para gridEvents com o shape de WeekendEventItem', () => {
    const result = buildMultiEventAnnouncementData([baseEvent()], { baseUrl: 'https://mdaccula.com' });
    expect(result.gridEvents).toHaveLength(1);
    expect(result.gridEvents?.[0]).toMatchObject({
      id: 'evt-1',
      title: 'Evento Base',
      venue: 'Clube X',
      cityState: 'São Paulo-SP',
      imageUrl: 'https://cdn.mdaccula.com/evento-base.webp',
      eventUrl: 'https://mdaccula.com/eventos/evento-base',
      ticketUrl: 'https://ingressos.com/evento-base',
    });
  });

  it('usa a URL do evento como ticketUrl quando ticket_link está vazio', () => {
    const result = buildMultiEventAnnouncementData([baseEvent({ ticket_link: null })], { baseUrl: 'https://mdaccula.com' });
    expect(result.gridEvents?.[0].ticketUrl).toBe('https://mdaccula.com/eventos/evento-base');
  });

  it('preenche ctaLabel só quando cta_type é diferente do padrão', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ cta_type: 'buy_ticket_discount' }),
    ]);
    expect(result.gridEvents?.[0].ctaLabel).toBe('Comprar Ingresso com Desconto');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/emailComposer.test.ts
```
Expected: FAIL — `buildMultiEventAnnouncementData` is not exported.

- [ ] **Step 3: Implement in `supabase/functions/_shared/emailComposer.ts`**

Add right after the existing `buildEventAnnouncementData` function:

```ts
export function buildMultiEventAnnouncementData(
  events: EmailEventRow[],
  opts: { baseUrl?: string } = {},
): EventAnnouncementData {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const count = events.length;
  const eventTitle = count === 1
    ? "1 evento com novo lote hoje"
    : `${count} eventos com novo lote hoje`;

  const gridEvents = events.map((event) => {
    const date = new Date(`${event.date}T${event.time || "00:00"}`);
    const dayLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const eventUrl = `${baseUrl}/eventos/${event.slug}`;
    const ctaLabel = event.cta_type && event.cta_type !== DEFAULT_EVENT_CTA_TYPE
      ? getEventCtaButtonLabel(event.cta_type)
      : undefined;
    return {
      id: event.id,
      title: event.title,
      dayLabel,
      timeLabel: (event.time || "").slice(0, 5) || "22h",
      venue: event.venue,
      cityState: `${event.location_city}-${event.location_state}`,
      imageUrl: event.image_url?.trim() || "",
      eventUrl,
      ticketUrl: event.ticket_link?.trim() || eventUrl,
      ctaLabel,
    };
  });

  return {
    eventTitle,
    flyerUrl: "",
    dateLabel: "",
    timeLabel: "",
    venueName: "",
    cityState: "",
    description: "",
    ticketUrl: "",
    eventUrl: `${baseUrl}/eventos`,
    agendaUrl: `${baseUrl}/eventos`,
    instagramUrl: "https://instagram.com/mdaccula",
    youtubeUrl: "https://youtube.com/@mdaccula",
    tiktokUrl: "https://tiktok.com/@mdaccula",
    unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
    gridEvents,
  };
}
```

Then add a case for `event_grid` inside `validateEmailBlocks` (right after the existing `case "weekend_grid":` block, which reads `if (!(event.weekendEvents || []).length) issues.push(...)`):

```ts
      case "event_grid":
        if (!(event.gridEvents || []).length) issues.push(issue(block, "EVENT_GRID_MISSING", "Selecione ao menos 1 evento para o grid."));
        break;
```

- [ ] **Step 4: Re-export from the frontend wrapper**

In `src/lib/emailTemplates/emailComposer.ts`, add `buildMultiEventAnnouncementData` to the existing `export { ... } from '@shared/emailComposer.ts';` list:

```ts
export {
  applyEmailBlockOverrides,
  buildEventAnnouncementData,
  buildMultiEventAnnouncementData,
  composeEmail,
  validateEmailBlocks,
} from '@shared/emailComposer.ts';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/emailComposer.test.ts
```
Expected: all pass, including the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/emailComposer.ts src/lib/emailTemplates/emailComposer.ts src/__tests__/lib/emailComposer.test.ts
git commit -m "feat(email): buildMultiEventAnnouncementData para o template multi-evento"
```

---

### Task 4: Expor tipo/preset novo no frontend (`blocks.ts`)

**Files:**
- Modify: `src/lib/emailTemplates/blocks.ts`

**Interfaces:**
- Consumes: `Block` (now includes `event_grid`, from Task 2), `PresetKey`/`buildPresetBlocks`/`TEMPLATE_PRESETS` (existing).
- Produces: `Template['type']` accepts `'ticket_batch_multi'`; `PresetKey` includes `'ticket_batch_multi'`; a new entry in `TEMPLATE_PRESETS` the admin can pick when creating a template.

- [ ] **Step 1: Add the type to `Template['type']`** (around line 43-51)

```ts
  type:
    | 'event_new'
    | 'ticket_batch'
    | 'ticket_batch_multi'
    | 'weekly_digest'
    | 'weekly_digest_editorial'
    | 'weekend_agenda'
    | 'courtesy'
    | 'custom'
    | 'blog_digest';
```

- [ ] **Step 2: Add the block label** in `BLOCK_LABELS` (around line 85, right after `weekend_grid`)

```ts
  weekend_grid: 'Agenda do fim de semana',
  event_grid: 'Grid de eventos (2 colunas)',
```

- [ ] **Step 3: Add to `AVAILABLE_BLOCKS`** (around line 106, right after `'weekend_grid'`)

```ts
  'weekend_grid',
  'event_grid',
```

- [ ] **Step 4: Add `'ticket_batch_multi'` to `PresetKey`** (around line 124-134)

```ts
export type PresetKey =
  | 'event_new'
  | 'ticket_batch'
  | 'ticket_batch_multi'
  | 'weekly_digest'
  | 'weekly_digest_poster'
  | 'weekly_digest_editorial'
  | 'weekend_agenda_cartaz'
  | 'weekend_agenda_timeline'
  | 'blog_digest_cards'
  | 'blog_digest_editorial'
  | 'courtesy';
```

- [ ] **Step 5: Add the preset branch in `buildPresetBlocks`** — right after the existing `if (type === 'ticket_batch') { ... }` block closes (after line 213)

```ts
  if (type === 'ticket_batch_multi') {
    return [
      { id: newBlockId(), kind: 'header', logo_height: 56 },
      { id: newBlockId(), kind: 'eyebrow', text: 'ÚLTIMAS HORAS · VIRADA DE LOTE', align: 'center' },
      { id: newBlockId(), kind: 'title', align: 'center' },
      {
        id: newBlockId(),
        kind: 'event_grid',
        eyebrow: '',
        title: '',
      },
      { id: newBlockId(), kind: 'divider' },
      { id: newBlockId(), kind: 'social_icons', networks: defaultSocials, align: 'center' },
      { id: newBlockId(), kind: 'footer', include_unsubscribe: true, align: 'center' },
    ];
  }
```

- [ ] **Step 6: Add to `TEMPLATE_PRESETS`** (right after the existing `ticket_batch` entry, and add the type to the array's `template_type` union at the top of the array declaration, around line 561-568)

```ts
    | 'event_new'
    | 'ticket_batch'
    | 'ticket_batch_multi'
    | 'weekly_digest'
    | 'weekend_agenda'
    | 'courtesy'
    | 'custom'
    | 'blog_digest';
}> = [
  // ... entradas existentes ...
```

E o novo item da lista (logo após o objeto `key: 'ticket_batch'`):

```ts
  {
    key: 'ticket_batch_multi',
    name: 'Virada de lote — múltiplos eventos',
    description:
      'Um e-mail só cobrindo vários eventos que viram de lote no mesmo dia, em grid de 2 colunas — em vez de um e-mail por evento.',
    subject_template: '⏰ {{event_title}}',
    preheader_template: 'O lote atual está acabando em vários eventos. Garanta antes da próxima virada de preço.',
    template_type: 'ticket_batch_multi',
  },
```

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors (this task only touches types/data, no test to run — the render behavior was already covered by Task 2's tests, and this file has no render logic of its own).

- [ ] **Step 8: Commit**

```bash
git add src/lib/emailTemplates/blocks.ts
git commit -m "feat(email): expõe template ticket_batch_multi no editor (preset + labels)"
```

---

### Task 5: Edge Function `create-multi-event-email-campaign`

**Files:**
- Create: `supabase/functions/create-multi-event-email-campaign/index.ts`
- Modify: `supabase/config.toml` (add `verify_jwt = false` entry, matching `create-event-email-campaign`'s own entry — this function does its own admin check internally via `has_role`)

**Interfaces:**
- Consumes: `egoiRequest`, `sendEgoiCampaign` from `../_shared/egoiClient.ts` (existing).
- Produces: `POST /functions/v1/create-multi-event-email-campaign` accepting `{ event_ids: string[], html: string, subject: string, preheader?: string, send_now?: boolean }`, returning `{ ok: boolean, status: string, egoi_campaign_id: string | null, error: string | null }` — consumed by Task 7 (`dispatchMultiEventDraftEmail`).

- [ ] **Step 1: Write the function**

```ts
// Cria 1 campanha na E-goi cobrindo N eventos (template "Virada de lote —
// múltiplos eventos"). Diferente de create-event-event-email-campaign (1
// evento = 1 linha), esta function faz o claim de TODOS os eventos
// selecionados de forma tudo-ou-nada, e insere N linhas em
// event_email_campaigns (uma por evento) compartilhando o MESMO
// egoi_campaign_id — assim cada evento aparece individualmente como
// "enviado" no histórico (EmailEventsTab.tsx), sem precisar de tabela de
// relacionamento nova.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { egoiRequest, sendEgoiCampaign } from '../_shared/egoiClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Token inválido' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Apenas admins' }, 403);

    const body = await req.json().catch(() => ({}));
    const eventIds = Array.isArray(body?.event_ids)
      ? (body.event_ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const html = body?.html as string | undefined;
    const subject = (body?.subject as string | undefined) || undefined;
    const preheader = (body?.preheader as string | undefined) || undefined;
    const sendNow = body?.send_now === true;

    if (eventIds.length === 0 || !html || !subject) {
      return json({ error: 'event_ids (array não vazio), html e subject são obrigatórios' }, 400);
    }

    // Guard 1: Master switch
    const { data: masterRow } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'egoi_email_enabled')
      .maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: Agência config
    const { data: cfg } = await admin.from('egoi_config').select('*').maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
    }
    const resolvedSegmentId = cfg.segment_id != null ? Number(cfg.segment_id) : null;

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) return json({ error: 'EGOI_API_KEY não configurada' }, 500);

    // Guard 3: claim tudo-ou-nada dos N eventos.
    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from('events')
      .update({ email_campaign_dispatched_at: now })
      .in('id', eventIds)
      .is('email_campaign_dispatched_at', null)
      .select('id,title,status');
    if (claimErr) throw claimErr;

    const claimedRows = claimed ?? [];
    const claimedIds = claimedRows.map((e) => e.id as string);

    if (claimedIds.length !== eventIds.length) {
      if (claimedIds.length > 0) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', claimedIds);
      }
      const blockedIds = eventIds.filter((id) => !claimedIds.includes(id));
      return json({
        error: 'Um ou mais eventos já têm campanha disparada (ou não existem). Nenhum e-mail foi enviado.',
        blocked_event_ids: blockedIds,
      }, 409);
    }

    const inactive = claimedRows.filter((e) => e.status !== 'active');
    if (inactive.length > 0) {
      await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', eventIds);
      return json({
        error: 'Um ou mais eventos selecionados não estão ativos. Nenhum e-mail foi enviado.',
        inactive_event_ids: inactive.map((e) => e.id),
      }, 409);
    }

    const internalName = `MDAccula • Virada de lote (${eventIds.length} eventos) • ${now.slice(0, 10)}`;
    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: 'html',
        body: html,
        ...(preheader ? { preheader } : {}),
      },
      tags: ['mdaccula', 'virada-de-lote-multi'],
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (resolvedSegmentId) createPayload.segment_id = resolvedSegmentId;

    const created = await egoiRequest('/campaigns/email', apiKey, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    let campaignHash: string | null = null;
    let campaignStatus: 'draft' | 'failed' | 'sent' = 'failed';
    let errorMessage: string | null = null;
    let sentAt: string | null = null;

    if (created.ok) {
      campaignHash =
        created.body?.campaign_hash ||
        created.body?.hash ||
        created.body?.data?.campaign_hash ||
        (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
        (created.body?.id != null ? String(created.body.id) : null);
      campaignStatus = 'draft';

      if (sendNow && !campaignHash) {
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra confirmar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (sendNow && campaignHash) {
        const sendRes = await sendEgoiCampaign(campaignHash, Number(cfg.list_id), apiKey, resolvedSegmentId);
        if (sendRes.ok) {
          campaignStatus = 'sent';
          sentAt = new Date().toISOString();
        } else {
          errorMessage = `E-goi send ${sendRes.status}: ${
            typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body)
          }`.slice(0, 1000);
        }
      }
    } else {
      // Falha na criação — libera o claim dos N eventos para nova tentativa.
      await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', eventIds);
      errorMessage = `E-goi ${created.status}: ${
        typeof created.body === 'string' ? created.body : JSON.stringify(created.body)
      }`.slice(0, 1000);
    }

    // N linhas, uma por evento, mesmo egoi_campaign_id — é isso que faz cada
    // evento aparecer individualmente como "enviado" no histórico.
    const rows = eventIds.map((eventId) => ({
      event_id: eventId,
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      mode: sendNow ? 'immediate' : 'draft',
      error_message: errorMessage,
      sent_at: sentAt,
      segment_id: resolvedSegmentId,
      campaign_type: 'multi_event',
    }));
    if (created.ok) {
      await admin.from('event_email_campaigns').insert(rows);
    }

    return json({
      ok: campaignStatus !== 'failed',
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: errorMessage,
      event_ids: eventIds,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
```

- [ ] **Step 2: Register `verify_jwt = false`**

In `supabase/config.toml`, add right after the existing `[functions.create-event-email-campaign]` entry:

```toml
[functions.create-multi-event-email-campaign]
verify_jwt = false
```

- [ ] **Step 3: Deploy and smoke-check manually**

This function cannot be unit-tested locally without live Supabase/E-goi credentials (same limitation as `create-event-email-campaign` — see Task 6's contract test, which only checks the auth boundary). After this task's commit is pushed (deploy is automatic via GitHub Actions on push to `main` touching `supabase/functions/**`), verify manually:
1. In `/admin/email-config` → Envio Manual, select the `ticket_batch_multi` template with 2 real upcoming events and click "Enviar teste" (once Task 8/9 wire the UI) — OR, until then, call the function directly with `curl`/Postman using a real admin JWT and 2 real `event_ids`, and confirm the response has `ok: true`, `status: 'draft'`.
2. Query `event_email_campaigns` for those 2 `event_id`s and confirm both rows exist with the same `egoi_campaign_id`.
3. Try calling it again with one of the same `event_ids` (already claimed) mixed with a fresh one — confirm it returns `409` and that the fresh event's `email_campaign_dispatched_at` was rolled back to `null` (not left claimed).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-multi-event-email-campaign/index.ts supabase/config.toml
git commit -m "feat(email): Edge Function create-multi-event-email-campaign (claim tudo-ou-nada)"
```

---

### Task 6: Contract test da Edge Function nova

**Files:**
- Create: `src/__tests__/contracts/create-multi-event-email-campaign.test.ts`

**Interfaces:**
- Consumes: the deployed `create-multi-event-email-campaign` endpoint (Task 5).
- Produces: nothing consumed by later tasks — this is a leaf test.

- [ ] **Step 1: Write the test** (mirrors `src/__tests__/contracts/create-event-event-email-campaign.test.ts` exactly — same auth-boundary-only scope, since this function also only accepts admin JWT with no cron bypass)

```ts
/**
 * Contract test — Edge Function `create-multi-event-email-campaign`.
 *
 * Só aceita JWT de admin (sem bypass de cron), então sem credenciais de
 * teste só dá pra verificar a camada de auth/CORS por rede — o claim
 * tudo-ou-nada e a criação de N linhas em event_email_campaigns são
 * verificados manualmente (ver Task 5, passo 3, do plano de implementação).
 *
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/create-multi-event-email-campaign` : '';

describe.skipIf(!SUPABASE_URL)('Contract: create-multi-event-email-campaign', () => {
  it('OPTIONS retorna CORS preflight válido', async () => {
    const res = await fetch(FN_URL, { method: 'OPTIONS' });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('Sem auth → 401 com JSON de erro', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty('error');
  });

  it('Anon-key (não-admin) → guard rejeita (401 ou 403)', async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ event_ids: ['x'], html: '<p>x</p>', subject: 'x' }),
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx vitest run src/__tests__/contracts/create-multi-event-email-campaign.test.ts
```
Expected: if `VITE_SUPABASE_URL` is set locally and the function from Task 5 hasn't been deployed yet, all 3 tests FAIL with 404 (expected until Task 5 is pushed and the automatic Edge Function deploy workflow runs — this is normal, not a bug, matching the pattern of every other freshly-added contract test in this repo). If the function is already deployed, all 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/contracts/create-multi-event-email-campaign.test.ts
git commit -m "test: contract test para create-multi-event-email-campaign"
```

---

### Task 7: `dispatchMultiEventDraftEmail` — helper de disparo (frontend)

**Files:**
- Modify: `src/lib/emailTemplates/dispatchEventDraft.ts`

**Interfaces:**
- Consumes: `supabase.functions.invoke` (existing client), the `create-multi-event-email-campaign` endpoint (Task 5), `DispatchEventDraftResult` type (already defined at the top of this file).
- Produces: `dispatchMultiEventDraftEmail(eventIds: string[], opts: { sendNow?: boolean; preparedComposition: { html: string; subject: string; preheader: string } }): Promise<DispatchEventDraftResult>` — consumed by Task 9.

- [ ] **Step 1: Implement**

Add at the end of `src/lib/emailTemplates/dispatchEventDraft.ts` (after `dispatchAbSubjectTest`):

```ts
/**
 * Dispara (rascunho ou envio real) o e-mail multi-evento de "Virada de lote".
 * Diferente de dispatchEventDraftEmail, a composição (HTML/assunto/preheader)
 * já vem pronta de fora (montada no client via buildMultiEventAnnouncementData
 * + composeEmail, na aba Envio Manual) — esta função só invoca a Edge
 * Function, sem recompor nada.
 */
export async function dispatchMultiEventDraftEmail(
  eventIds: string[],
  opts: {
    sendNow?: boolean;
    preparedComposition: { html: string; subject: string; preheader: string };
  }
): Promise<DispatchEventDraftResult> {
  const { data, error } = await supabase.functions.invoke('create-multi-event-email-campaign', {
    body: {
      event_ids: eventIds,
      html: opts.preparedComposition.html,
      subject: opts.preparedComposition.subject,
      preheader: opts.preparedComposition.preheader,
      send_now: opts.sendNow === true,
    },
  });
  if (error) return { ok: false, error: error.message };
  return (data as DispatchEventDraftResult) ?? { ok: false, error: 'Resposta vazia' };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/emailTemplates/dispatchEventDraft.ts
git commit -m "feat(email): dispatchMultiEventDraftEmail — helper de disparo multi-evento"
```

---

### Task 8: Aba Envio Manual — seleção múltipla + composição

**Files:**
- Modify: `src/pages/admin/EmailConfig.tsx`

**Interfaces:**
- Consumes: `buildMultiEventAnnouncementData` (Task 3), `PresetKey`/`Template['type']` including `'ticket_batch_multi'` (Task 4).
- Produces: `batchEventIds: string[]` state + `manualComposition` branch, consumed by Task 9's dispatch handlers.

- [ ] **Step 1: Add the new import**

Near the top of `EmailConfig.tsx`, wherever `buildEventAnnouncementData` is imported from `@/lib/emailTemplates/emailComposer`, add `buildMultiEventAnnouncementData` to the same import line.

- [ ] **Step 2: Add multi-select state**

Right after the existing `batchEventId`/`setBatchEventId` state declaration (search for `useState` calls near `batchTemplateId`), add:

```tsx
const [batchEventIds, setBatchEventIds] = useState<string[]>([]);
```

- [ ] **Step 3: Add `manualTemplates` filter for the new type**

Change the existing filter (around line 463-465):

```tsx
const manualTemplates = useMemo(
  () =>
    templates.filter((template) =>
      ['event_new', 'courtesy', 'ticket_batch', 'ticket_batch_multi', 'custom'].includes(template.type)
    ),
  [templates]
);
```

- [ ] **Step 4: Add `selectedManualEvents` (plural) memo**

Right after the existing `selectedManualEvent` memo (around line 472-475):

```tsx
const isMultiEventTemplate = selectedManualTemplate?.type === 'ticket_batch_multi';
const selectedManualEvents = useMemo(
  () => realEvents.filter((event) => batchEventIds.includes(event.id)),
  [realEvents, batchEventIds]
);
```

- [ ] **Step 5: Branch `manualComposition`**

Replace the start of the existing `manualComposition` `useMemo` (around line 476-484) so it branches on `isMultiEventTemplate` before doing anything single-event-specific:

```tsx
const manualComposition = useMemo(() => {
  if (!selectedManualTemplate) return null;

  if (isMultiEventTemplate) {
    if (selectedManualEvents.length === 0) return null;
    const event = buildMultiEventAnnouncementData(selectedManualEvents, { baseUrl: 'https://mdaccula.com' });
    return composeEmail({
      template: {
        blocks: selectedManualTemplate.blocks as Block[],
        subject_template: selectedManualTemplate.subject_template,
        preheader_template: selectedManualTemplate.preheader_template,
      },
      event,
      settings: tpl,
      globals: globalsMap,
    });
  }

  if (!selectedManualEvent) return null;
  const deadline = new Date();
  deadline.setHours(23, 59, 0, 0);
  const event = buildEventAnnouncementData(selectedManualEvent, {
    flyerOverrideUrl:
      selectedManualTemplate.type === 'ticket_batch' ? batchArtworkUrl || undefined : undefined,
    ticketBatchDeadlineIso: deadline.toISOString(),
  });
  let blocks = applyEmailBlockOverrides(selectedManualTemplate.blocks as Block[], {
    artworkUrl:
      selectedManualTemplate.type === 'ticket_batch'
        ? batchArtworkUrl || event.flyerUrl || undefined
        : undefined,
    defaultLink: event.ticketUrl,
  });
  const eventOnlyTemplateTypes = new Set(['event_new', 'event_reminder', 'last_hours', 'ticket_batch']);
  if (eventOnlyTemplateTypes.has(String(selectedManualTemplate.type))) {
    blocks = blocks.filter(
      (b) => !['weekend_grid', 'weekly_hero', 'blog_posts_list', 'dedge_block'].includes(b.kind)
    );
  }
  return composeEmail({
    template: {
      blocks,
      subject_template:
        selectedManualTemplate.type === 'ticket_batch'
          ? batchSubject || selectedManualTemplate.subject_template
          : selectedManualTemplate.subject_template,
      preheader_template: selectedManualTemplate.preheader_template,
    },
    event,
    settings: tpl,
    article: batchArticle,
    globals: globalsMap,
  });
}, [
  selectedManualTemplate,
  selectedManualEvent,
  isMultiEventTemplate,
  selectedManualEvents,
  batchArtworkUrl,
  batchSubject,
  tpl,
  batchArticle,
  globalsMap,
]);
```

- [ ] **Step 6: Replace the event `<Select>` with a checklist when multi**

In the JSX, right where `<div><Label>Evento</Label><Select ...>` starts (around line 1383-1403), wrap it in a conditional — keep the existing `<Select>` for the non-multi case, and add this branch for the multi case:

```tsx
<div>
  <Label>Evento{isMultiEventTemplate ? 's' : ''}</Label>
  {isMultiEventTemplate ? (
    <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
      {realEvents.map((e) => (
        <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={batchEventIds.includes(e.id)}
            onChange={(ev) => {
              setBatchEventIds((prev) =>
                ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)
              );
            }}
          />
          <span>
            {e.title} · {new Date(e.date).toLocaleDateString('pt-BR')}
          </span>
        </label>
      ))}
      {realEvents.length === 0 && (
        <p className="text-xs text-muted-foreground p-2">Nenhum evento ativo/futuro encontrado.</p>
      )}
    </div>
  ) : (
    <Select
      value={batchEventId}
      onValueChange={(id) => {
        setBatchEventId(id);
        setBatchSegmentId(undefined);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione o evento" />
      </SelectTrigger>
      <SelectContent>
        {realEvents.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.title} · {new Date(e.date).toLocaleDateString('pt-BR')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
</div>
```

- [ ] **Step 7: Update the template `<Select>` label mapping** to show a label for the new type (in the `manualTemplates.map` block, around line 1420-1431):

```tsx
{t.name} ·{' '}
{t.type === 'event_new'
  ? 'Evento'
  : t.type === 'courtesy'
    ? 'Cortesia'
    : t.type === 'ticket_batch'
      ? 'Virada'
      : t.type === 'ticket_batch_multi'
        ? 'Virada (multi)'
        : 'Custom'}
```

- [ ] **Step 8: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/EmailConfig.tsx
git commit -m "feat(email): seleção múltipla de eventos na aba Envio Manual"
```

---

### Task 9: Aba Envio Manual — disparo (teste / rascunho / agora) pro fluxo multi

**Files:**
- Modify: `src/pages/admin/EmailConfig.tsx`

**Interfaces:**
- Consumes: `dispatchMultiEventDraftEmail` (Task 7), `manualComposition`/`isMultiEventTemplate`/`selectedManualEvents` (Task 8).
- Produces: working "Enviar teste" / "Salvar rascunho" / "Enviar agora" buttons for the multi-event flow — this is the final task, nothing later consumes it.

- [ ] **Step 1: Branch `dispatchBatch`**

Modify the existing `dispatchBatch` function (around line 792) to branch at the very top:

```tsx
const dispatchBatch = async (sendNow: boolean) => {
  if (!manualComposition) {
    toast({ variant: 'destructive', title: 'Selecione o(s) evento(s) e o template' });
    return;
  }
  const preCheck = partitionIssues(manualComposition.issues);
  if (preCheck.blockers.length > 0) {
    toast({
      variant: 'destructive',
      title: 'Envio bloqueado',
      description: preCheck.blockers.map((item) => item.message).join(' '),
    });
    return;
  }
  if (preCheck.warnings.length > 0) {
    toast({ title: 'Aviso', description: preCheck.warnings.map((item) => item.message).join(' ') });
  }
  setBatchDispatching(true);

  try {
    if (isMultiEventTemplate) {
      if (selectedManualEvents.length === 0) {
        toast({ variant: 'destructive', title: 'Selecione ao menos 1 evento' });
        return;
      }
      const res = await dispatchMultiEventDraftEmail(batchEventIds, {
        sendNow,
        preparedComposition: {
          html: manualComposition.html,
          subject: manualComposition.subject,
          preheader: manualComposition.preheader,
        },
      });
      if (res.ok && res.status === 'sent') {
        toast({
          title: 'E-mail multi-evento enviado!',
          description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
        });
        void loadAll();
      } else if (res.ok && res.status === 'draft') {
        toast({
          variant: sendNow ? 'destructive' : 'default',
          title: sendNow ? 'Campanha criada, mas não enviada' : 'Rascunho criado na E-goi',
          description: res.egoi_campaign_id
            ? `Campanha #${res.egoi_campaign_id}${res.error ? ` — ${res.error}` : ''}`
            : res.error,
        });
        void loadAll();
      } else {
        toast({ variant: 'destructive', title: 'Falha', description: res.error || 'Erro desconhecido' });
      }
      return;
    }

    if (!batchEventId || !batchTemplateId) {
      toast({ variant: 'destructive', title: 'Selecione o evento e o template' });
      return;
    }
    const res = await dispatchEventDraftEmail(batchEventId, {
      forceResend: true,
      sendNow,
      templateIdOverride: batchTemplateId || undefined,
      flyerOverrideUrl:
        selectedManualTemplate?.type === 'ticket_batch' ? batchArtworkUrl || undefined : undefined,
      subjectOverride:
        selectedManualTemplate?.type === 'ticket_batch' ? batchSubject || undefined : undefined,
      segmentIdOverride: batchSegmentId,
      preparedComposition: {
        html: manualComposition.html,
        subject: manualComposition.subject,
        preheader: manualComposition.preheader,
      },
    });
    if (res.ok && res.status === 'sent') {
      toast({
        title: 'E-mail enviado!',
        description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
      });
      void loadAll();
    } else if (res.ok && res.status === 'draft') {
      toast({
        variant: sendNow ? 'destructive' : 'default',
        title: sendNow ? 'Campanha criada, mas não enviada' : 'Rascunho criado na E-goi',
        description: res.egoi_campaign_id
          ? `Campanha #${res.egoi_campaign_id}${res.error ? ` — ${res.error}` : ''}`
          : res.error,
      });
      void loadAll();
    } else {
      toast({
        variant: 'destructive',
        title: 'Falha',
        description: res.error || res.reason || 'Erro desconhecido',
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro desconhecido';
    toast({ variant: 'destructive', title: 'Erro', description: message });
  } finally {
    setBatchDispatching(false);
  }
};
```

Add the import for `dispatchMultiEventDraftEmail` alongside the existing `dispatchEventDraftEmail`/`dispatchAbSubjectTest` import from `@/lib/emailTemplates/dispatchEventDraft`.

- [ ] **Step 2: Disable scheduling and A/B controls for the multi-event template**

Find the JSX for the "Agendar" and "Teste A/B" controls (search for `scheduleBatch` and `dispatchAbTest` button triggers in this same `TabsContent value="batch"` section) and wrap each with `{!isMultiEventTemplate && ( ... )}` — V1 of the multi-event flow only supports immediate send / draft, matching the approved spec (no scheduling or A/B for multi-event, out of scope).

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual verification** (this feature has no automated end-to-end test — same limitation as the rest of the manual send tab, which is only covered by contract/unit tests on its pieces)

1. `npm run dev`, log in as admin, go to `/admin/email-config` → aba "Virada de Lote" (Envio Manual).
2. Create a template with `type = 'ticket_batch_multi'` (via the template editor, using the new "Virada de lote — múltiplos eventos" preset from Task 4).
3. Select that template in Envio Manual — confirm the event `<Select>` is replaced by a checklist.
4. Check 2-3 real upcoming events — confirm the preview renders a 2-column grid with those events' flyers/titles/CTAs.
5. Click "Enviar teste" — confirm the test e-mail arrives with the grid.
6. Click "Salvar rascunho" (`sendNow=false`) — confirm a campaign is created in E-goi as draft, and that ALL selected events show "Rascunho na E-goi" in `EmailEventsTab.tsx`'s history (same `egoi_campaign_id` for all).
7. Try disparar de novo pro MESMO conjunto de eventos — confirm it's blocked (already dispatched) until you reset `email_campaign_dispatched_at` manually or pick different events.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/EmailConfig.tsx src/lib/emailTemplates/dispatchEventDraft.ts
git commit -m "feat(email): dispara e-mail multi-evento (teste/rascunho/agora) na aba Envio Manual"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** grid 2 colunas (Task 2) ✓, seleção manual (Task 8) ✓, assunto sugerido via `{{event_title}}` (Task 4's preset + Task 3's `eventTitle`) ✓, histórico com N linhas mesmo `egoi_campaign_id` (Task 5) ✓, migration do CHECK (Task 1) ✓, claim tudo-ou-nada (Task 5) ✓.
- **Type consistency checked:** `gridEvents` (Task 2) is the exact field name used in `buildMultiEventAnnouncementData` (Task 3), `EmailConfig.tsx` (Task 8), and the Edge Function response shape matches `DispatchEventDraftResult` (Task 7) throughout.
- **No placeholders:** every step has complete code, not descriptions.
