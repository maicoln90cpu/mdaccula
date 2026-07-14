# Event Watcher — Fontes de Sites (Fase A, parte 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline "Event Watcher" para fontes do tipo **site** (Firecrawl): varrer sites cadastrados, extrair dados de evento via IA, gravar rascunhos pendentes de revisão, e permitir que um admin aprove um rascunho — o que cria o evento no site e gera o artigo do blog reaproveitando 100% o pipeline `generate-blog-post-v2` já existente.

**Architecture:** Duas tabelas novas (`event_sources`, `event_watch_drafts`) + uma Edge Function (`scan-event-sources`) que reaproveita o padrão de scraping/extração já usado em `generate-blog-suggestions`, + duas páginas admin (`EventSourcesManager`, `EventWatchReview`) que reaproveitam os padrões de `PodcastManager`/`BlogForm`. A aprovação de um rascunho chama a Edge Function `generate-blog-post-v2` já em produção (modo evento) exatamente como `EventForm.tsx`/`EventsManager.tsx` já fazem hoje.

**Tech Stack:** Supabase (Postgres + Deno Edge Functions + pg_cron), React 18 + TypeScript + TanStack Query + React Hook Form, Vitest (contract/unit tests), Deno test runner (edge function unit tests).

## Global Constraints

- Nunca editar `src/integrations/supabase/types.ts` ou `src/integrations/supabase/client.ts` à mão — regenerar via `mcp__supabase-mdaccula__generate_typescript_types` (ou `supabase gen types typescript`) depois de aplicar a migration.
- Nunca importar `@supabase/supabase-js` direto no frontend — sempre `@/integrations/supabase/client`.
- Logging no frontend via `logger` de `@/lib` (não `console.log`).
- Barrel imports: `@/hooks`, `@/lib`, `@/types` — não importar de arquivos individuais quando existir barrel.
- Datas `YYYY-MM-DD` sempre tratadas como string local, nunca `new Date("YYYY-MM-DD")` (reaproveitar `weekdayPtBr`/`dateFormattedPtBr` de `src/lib/eventArticlePayload.ts` quando precisar de data formatada).
- Toda tabela nova precisa de RLS habilitada + policy de admin (`public.is_admin()`) + `GRANT ... TO service_role` para as Edge Functions.
- Erros em `catch` tipados como `unknown`, narrados com `error instanceof Error`.
- Pré-merge: `npm test`, `npm run test:coverage:ratchet`, `npx tsc --noEmit` todos verdes.

## Escopo desta parte 1 (e o que fica para depois)

Esta é a fatia **site-only** da Fase A já aprovada (`veja-quais-as-chances-dazzling-babbage.md`). Ela entrega valor sozinha: varredura de sites, extração por IA, fila de revisão, publicação no site + blog. Ficam para um plano seguinte (`event-watcher-instagram-apify`, mesma pasta): fontes `type='instagram'` via Apify, o webhook assíncrono de retorno (padrão inédito neste código, sem precedente hoje) e a composição de imagem com template/logo. O schema já inclui a coluna `type` pronta para `'instagram'`, então a parte 2 não vai exigir migração de schema nova para isso.

Também fica fora desta parte 1, por ora: painel de configuração do intervalo de cron (a la `update-digest-schedule`). A migration já libera o nome do job `scan-event-sources-cron` na RPC `manage_digest_schedule`, então ligar o cron automático é uma chamada SQL de uma linha quando o piloto for aprovado (documentado na seção de Verificação) — o gatilho manual ("Executar agora") já cobre o uso imediato.

## File Structure

- `supabase/functions/_shared/index.ts` — **novo**. Helpers HTTP compartilhados (CORS, envelope JSON, timeout, rate limit, scraping Firecrawl, guarda admin-ou-cron) — hoje esse módulo não existe apesar de `CLAUDE.md`/`docs/CODE_STYLE.md` documentarem esse padrão; cada função duplica isso localmente. Criamos o módulo real aqui.
- `supabase/migrations/20260714120000_event_watcher_schema.sql` — **novo**. Tabelas `event_sources`, `event_watch_drafts`, RLS, triggers, índices, e libera o job `scan-event-sources-cron` na RPC `manage_digest_schedule`.
- `src/types/index.ts` — **modificado**. Novos tipos `EventSourceType`, `EventSource`, `EventSourceInsert`, `EventWatchDraftStatus`, `EventWatchDraft`.
- `supabase/functions/scan-event-sources/dedupe.ts` + `dedupe_test.ts` — **novo**. Lógica pura de deduplicação (testável sem rede/DB).
- `supabase/functions/scan-event-sources/extract.ts` + `extract_test.ts` — **novo**. Construção do tool-call de extração + parsing da resposta da IA (puro, testável).
- `supabase/functions/scan-event-sources/index.ts` — **novo**. Orquestração: lê fontes, raspa, extrai, deduplica, grava rascunhos.
- `src/__tests__/contracts/edge-scan-event-sources.test.ts` — **novo**. Contrato HTTP (CORS, 401/403, envelope).
- `src/pages/admin/EventSourcesManager.tsx` — **novo**. CRUD de fontes (`type='site'` nesta parte 1).
- `src/pages/admin/EventWatchReview.tsx` — **novo**. Fila de revisão + aprovar/rejeitar.
- `src/App.tsx` — **modificado**. 2 lazy imports + 2 rotas admin.
- `src/components/admin/AdminSidebar.tsx` — **modificado**. 2 itens de menu no grupo "Inteligência Artificial".

---

### Task 1: Módulo compartilhado de Edge Functions (`_shared/index.ts`)

**Files:**
- Create: `supabase/functions/_shared/index.ts`
- Test: `supabase/functions/_shared/index_test.ts`

**Interfaces:**
- Produces: `corsHeaders`, `handleCorsPreFlight(req: Request): Response | null`, `jsonSuccess(data?, status?): Response`, `jsonError(message: string, status?: number): Response`, `badRequestResponse(message: string): Response`, `rateLimitResponse(): Response`, `handleError(error: unknown, functionName: string): Response`, `withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label?: string): Promise<T>`, `fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response>`, `getClientIP(req: Request): string`, `isRateLimited(key: string, scope: string, limit?: number, windowMs?: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/index_test.ts
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  jsonSuccess,
  jsonError,
  handleCorsPreFlight,
  withTimeout,
  isRateLimited,
  getClientIP,
} from "./index.ts";

Deno.test("handleCorsPreFlight responde OPTIONS com headers CORS", () => {
  const req = new Request("https://x.test/f", { method: "OPTIONS" });
  const res = handleCorsPreFlight(req);
  assert(res !== null);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("handleCorsPreFlight retorna null para POST", () => {
  const req = new Request("https://x.test/f", { method: "POST" });
  assertEquals(handleCorsPreFlight(req), null);
});

Deno.test("jsonSuccess retorna envelope success:true por padrão", async () => {
  const res = jsonSuccess({ foo: "bar" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.foo, "bar");
});

Deno.test("jsonError retorna envelope com success:false", async () => {
  const res = jsonError("deu ruim", 400);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "deu ruim");
  assertEquals(body.success, false);
});

Deno.test("withTimeout resolve quando a promise termina a tempo", async () => {
  const result = await withTimeout(Promise.resolve(42), 100);
  assertEquals(result, 42);
});

Deno.test("withTimeout rejeita quando a promise demora demais", async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve(1), 50));
  let threw = false;
  try {
    await withTimeout(slow, 10, "teste-lento");
  } catch (e) {
    threw = true;
    assert(String((e as Error).message).includes("teste-lento"));
  }
  assert(threw);
});

Deno.test("getClientIP lê x-forwarded-for", () => {
  const req = new Request("https://x.test/f", {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  });
  assertEquals(getClientIP(req), "1.2.3.4");
});

Deno.test("isRateLimited bloqueia após exceder o limite na janela", () => {
  const key = `test-${crypto.randomUUID()}`;
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), false);
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), false);
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/_shared/index_test.ts`
Expected: FAIL — `Module not found "./index.ts"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/_shared/index.ts

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job",
};

export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

export function jsonSuccess(
  data: Record<string, unknown> = { success: true },
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function badRequestResponse(message: string): Response {
  return jsonError(message, 400);
}

export function rateLimitResponse(): Response {
  return jsonError("Muitas requisições. Tente novamente em instantes.", 429);
}

export function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonError(message, 500);
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  let timer: number;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

const rateLimitBuckets = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  scope: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(bucketKey) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (timestamps.length >= limit) {
    rateLimitBuckets.set(bucketKey, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, timestamps);
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/_shared/index_test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/index.ts supabase/functions/_shared/index_test.ts
git commit -m "feat(edge): add shared CORS/response/timeout/rate-limit helpers"
```

---

### Task 2: Schema do banco (`event_sources`, `event_watch_drafts`)

**Files:**
- Create: `supabase/migrations/20260714120000_event_watcher_schema.sql`

**Interfaces:**
- Produces: tabelas `public.event_sources` e `public.event_watch_drafts` (colunas exatas abaixo), função `public.manage_digest_schedule` atualizada para aceitar o job `scan-event-sources-cron`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260714120000_event_watcher_schema.sql
-- Event Watcher: fontes de eventos (Fase A, parte 1 — sites via Firecrawl) e fila de rascunhos.

CREATE TABLE public.event_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'site' CHECK (type IN ('site', 'instagram')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  last_seen_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_watch_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  extracted_title TEXT NOT NULL,
  extracted_date DATE NOT NULL,
  extracted_time TIME,
  extracted_venue TEXT,
  extracted_address TEXT,
  extracted_city TEXT,
  extracted_state TEXT,
  extracted_lineup TEXT[] DEFAULT '{}',
  extracted_ticket_link TEXT,
  extracted_description TEXT,
  extracted_confidence TEXT NOT NULL DEFAULT 'low' CHECK (extracted_confidence IN ('high', 'medium', 'low')),
  source_raw_excerpt TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  published_blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sources TO authenticated;
GRANT ALL ON public.event_sources TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_watch_drafts TO authenticated;
GRANT ALL ON public.event_watch_drafts TO service_role;

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_watch_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event sources"
  ON public.event_sources FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage event watch drafts"
  ON public.event_watch_drafts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_event_sources_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_event_watch_drafts_updated_at
  BEFORE UPDATE ON public.event_watch_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_sources_enabled ON public.event_sources(enabled);
CREATE INDEX idx_event_watch_drafts_status ON public.event_watch_drafts(status);
CREATE INDEX idx_event_watch_drafts_source_id ON public.event_watch_drafts(source_id);

-- Libera o novo job 'scan-event-sources-cron' na mesma RPC já usada pelos
-- digests, mantendo um único ponto de agendamento de cron no projeto.
CREATE OR REPLACE FUNCTION public.manage_digest_schedule(
  _job_name text,
  _enabled boolean,
  _cron_expr text,
  _function_url text,
  _cron_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  existing_id bigint;
BEGIN
  IF _job_name NOT IN ('weekly-digest-cron', 'weekend-agenda-cron', 'blog-digest-cron', 'scan-event-sources-cron') THEN
    RAISE EXCEPTION 'invalid job name: %', _job_name;
  END IF;

  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = _job_name;
  IF existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_id);
  END IF;

  IF _enabled THEN
    PERFORM cron.schedule(
      _job_name,
      _cron_expr,
      format(
        $cmd$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', %L,
            'x-cron-job', %L
          ),
          body := '{}'::jsonb
        );$cmd$,
        _function_url, _cron_secret, _job_name
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job', _job_name,
    'enabled', _enabled,
    'cron', _cron_expr,
    'unscheduled_previous', existing_id IS NOT NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) TO service_role;
```

- [ ] **Step 2: Aplicar a migration**

Run (via MCP): `mcp__supabase-mdaccula__apply_migration` com o nome `event_watcher_schema` e o SQL acima — **ou**, se preferir CLI local: `supabase db push`.
Expected: migration aplicada sem erro; `mcp__supabase-mdaccula__list_tables` mostra `event_sources` e `event_watch_drafts`.

- [ ] **Step 3: Regenerar os tipos do Supabase**

Run: `mcp__supabase-mdaccula__generate_typescript_types` e sobrescrever `src/integrations/supabase/types.ts` com o resultado (arquivo gerado — não editar à mão).
Expected: `types.ts` agora contém `event_sources` e `event_watch_drafts` em `Database["public"]["Tables"]`.

- [ ] **Step 4: Rodar o advisor de segurança**

Run: `mcp__supabase-mdaccula__get_advisors` com `type: "security"`.
Expected: nenhum novo warning relacionado a `event_sources`/`event_watch_drafts` (RLS habilitada + policies já cobrem o padrão usado no resto do projeto).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714120000_event_watcher_schema.sql src/integrations/supabase/types.ts
git commit -m "feat(db): add event_sources and event_watch_drafts tables"
```

---

### Task 3: Tipos TypeScript no barrel (`src/types`)

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: nenhuma (tipos são planos, seguindo a convenção já usada por `PodcastSubmission` no mesmo arquivo).
- Produces: `EventSourceType`, `EventSource`, `EventSourceInsert`, `EventWatchDraftStatus`, `EventWatchDraft`.

- [ ] **Step 1: Adicionar os tipos, seguindo a convenção de `PodcastSubmission` no mesmo arquivo**

Inserir logo antes da seção `// Re-export de tipos do Supabase para conveniência` (linha 148 atual):

```ts
// ============================================
// Tipos de Event Watcher
// ============================================

export type EventSourceType = 'site' | 'instagram';

export interface EventSource {
  id: string;
  type: EventSourceType;
  name: string;
  url: string;
  enabled: boolean;
  last_scanned_at?: string | null;
  last_seen_post_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventSourceInsert {
  type?: EventSourceType;
  name: string;
  url: string;
  enabled?: boolean;
}

export type EventWatchDraftStatus = 'pending_review' | 'approved' | 'rejected' | 'published';

export interface EventWatchDraft {
  id: string;
  source_id?: string | null;
  status: EventWatchDraftStatus;
  extracted_title: string;
  extracted_date: string;
  extracted_time?: string | null;
  extracted_venue?: string | null;
  extracted_address?: string | null;
  extracted_city?: string | null;
  extracted_state?: string | null;
  extracted_lineup?: string[] | null;
  extracted_ticket_link?: string | null;
  extracted_description?: string | null;
  extracted_confidence: 'high' | 'medium' | 'low';
  source_raw_excerpt?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_event_id?: string | null;
  published_blog_post_id?: string | null;
  created_at: string;
  updated_at: string;
  event_sources?: { name: string; url: string } | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add EventSource/EventWatchDraft types"
```

---

### Task 4: Deduplicação (lógica pura)

**Files:**
- Create: `supabase/functions/scan-event-sources/dedupe.ts`
- Test: `supabase/functions/scan-event-sources/dedupe_test.ts`

**Interfaces:**
- Produces: `normalizeTitle(title: string): string`, `isDuplicateEvent(candidate: { title: string; date: string }, existing: { title: string; date: string }[]): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/scan-event-sources/dedupe_test.ts
import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDuplicateEvent, normalizeTitle } from "./dedupe.ts";

Deno.test("normalizeTitle remove acentos, caixa e pontuação", () => {
  assert(normalizeTitle("Sún Fëst — 2ª Edição!") === normalizeTitle("sun fest 2a edicao"));
});

Deno.test("isDuplicateEvent detecta título igual + mesma data (com acento/caixa diferentes)", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assert(isDuplicateEvent({ title: "SUN FÉSTIVAL", date: "2026-09-19" }, existing));
});

Deno.test("isDuplicateEvent não marca duplicado se a data é diferente", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assertFalse(isDuplicateEvent({ title: "Sun Festival", date: "2026-09-20" }, existing));
});

Deno.test("isDuplicateEvent não marca duplicado se o título é diferente", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assertFalse(isDuplicateEvent({ title: "Moon Festival", date: "2026-09-19" }, existing));
});

Deno.test("isDuplicateEvent retorna false para lista vazia", () => {
  assertFalse(isDuplicateEvent({ title: "Qualquer", date: "2026-01-01" }, []));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/scan-event-sources/dedupe_test.ts`
Expected: FAIL — `Module not found "./dedupe.ts"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/scan-event-sources/dedupe.ts

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ExistingEventLike {
  title: string;
  date: string; // YYYY-MM-DD
}

export function isDuplicateEvent(
  candidate: { title: string; date: string },
  existing: ExistingEventLike[],
): boolean {
  const normalizedCandidate = normalizeTitle(candidate.title);
  return existing.some(
    (e) => e.date === candidate.date && normalizeTitle(e.title) === normalizedCandidate,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/scan-event-sources/dedupe_test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/scan-event-sources/dedupe.ts supabase/functions/scan-event-sources/dedupe_test.ts
git commit -m "feat(edge): add pure dedupe logic for event watch drafts"
```

---

### Task 5: Extração estruturada por IA (lógica pura)

**Files:**
- Create: `supabase/functions/scan-event-sources/extract.ts`
- Test: `supabase/functions/scan-event-sources/extract_test.ts`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `buildExtractionRequest(modelName: string, source: { name: string; url: string }, markdown: string): Record<string, unknown>`, `parseExtractionResponse(aiData: unknown): ExtractedEvent | null`, tipo `ExtractedEvent`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/scan-event-sources/extract_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildExtractionRequest, parseExtractionResponse } from "./extract.ts";

Deno.test("buildExtractionRequest monta tool-call com o modelo e a fonte corretos", () => {
  const body = buildExtractionRequest("google/gemini-2.5-flash", { name: "Site X", url: "https://x.test" }, "conteúdo raspado aqui") as any;
  assertEquals(body.model, "google/gemini-2.5-flash");
  assertEquals(body.tool_choice.function.name, "extract_event");
  assert(String(body.messages[1].content).includes("Site X"));
  assert(String(body.messages[1].content).includes("conteúdo raspado aqui"));
});

Deno.test("parseExtractionResponse retorna null quando has_event é false", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({ has_event: false, confidence: "low" }),
          },
        }],
      },
    }],
  };
  assertEquals(parseExtractionResponse(aiData), null);
});

Deno.test("parseExtractionResponse retorna null quando não há tool_call", () => {
  assertEquals(parseExtractionResponse({ choices: [{ message: {} }] }), null);
});

Deno.test("parseExtractionResponse extrai os campos do evento quando has_event é true", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              has_event: true,
              confidence: "high",
              title: "Sun Festival",
              date: "2026-09-19",
              time: "22:00",
              venue: "Arena X",
              address: "Rua Y, 123",
              location_city: "São Paulo",
              location_state: "SP",
              lineup: ["DJ A", "DJ B"],
              ticket_link: "https://ingressos.test/sun",
              description: "Um festival de música eletrônica.",
            }),
          },
        }],
      },
    }],
  };
  const result = parseExtractionResponse(aiData);
  assert(result !== null);
  assertEquals(result!.title, "Sun Festival");
  assertEquals(result!.date, "2026-09-19");
  assertEquals(result!.lineup.length, 2);
  assertEquals(result!.confidence, "high");
});

Deno.test("parseExtractionResponse retorna null quando o JSON dos argumentos é inválido", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{ function: { arguments: "{not-json" } }],
      },
    }],
  };
  assertEquals(parseExtractionResponse(aiData), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/scan-event-sources/extract_test.ts`
Expected: FAIL — `Module not found "./extract.ts"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/scan-event-sources/extract.ts

export interface ExtractedEvent {
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  address: string | null;
  location_city: string | null;
  location_state: string | null;
  lineup: string[];
  ticket_link: string | null;
  description: string | null;
  confidence: "high" | "medium" | "low";
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um assistente que extrai dados estruturados de anúncios de eventos de música eletrônica a partir de texto raspado de sites de terceiros.

Regras:
- Extraia apenas informações EXPLICITAMENTE presentes no texto. NUNCA invente data, local, horário ou lineup.
- Se o conteúdo não anuncia nenhum evento (ex: página institucional, notícia genérica, index de blog), retorne has_event=false.
- Se um campo não está claro no texto, deixe-o nulo/vazio — nunca adivinhe.
- confidence="high" só quando data, local e nome do evento estão todos claramente presentes; "medium" quando falta 1 desses; "low" caso contrário.`;

export function buildExtractionRequest(
  modelName: string,
  source: { name: string; url: string },
  markdown: string,
): Record<string, unknown> {
  const userPrompt = `Fonte: ${source.name} (${source.url})\n\nConteúdo raspado:\n${markdown}\n\nExtraia os dados do evento anunciado neste conteúdo, se houver algum.`;

  return {
    model: modelName,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_event",
          description: "Extrai dados estruturados de um evento de música eletrônica anunciado no texto, se houver",
          parameters: {
            type: "object",
            properties: {
              has_event: { type: "boolean", description: "true se o texto anuncia um evento real" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              title: { type: "string" },
              date: { type: "string", description: "Formato YYYY-MM-DD" },
              time: { type: "string", description: "Formato HH:MM, 24h" },
              venue: { type: "string" },
              address: { type: "string" },
              location_city: { type: "string" },
              location_state: { type: "string", description: "UF de 2 letras" },
              lineup: { type: "array", items: { type: "string" } },
              ticket_link: { type: "string" },
              description: { type: "string" },
            },
            required: ["has_event", "confidence"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_event" } },
  };
}

export function parseExtractionResponse(aiData: unknown): ExtractedEvent | null {
  const toolCall = (aiData as any)?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }

  if (args.has_event !== true) return null;
  if (typeof args.title !== "string" || typeof args.date !== "string") return null;

  return {
    title: args.title,
    date: args.date,
    time: typeof args.time === "string" && args.time ? args.time : null,
    venue: typeof args.venue === "string" && args.venue ? args.venue : null,
    address: typeof args.address === "string" && args.address ? args.address : null,
    location_city: typeof args.location_city === "string" && args.location_city ? args.location_city : null,
    location_state: typeof args.location_state === "string" && args.location_state ? args.location_state : null,
    lineup: Array.isArray(args.lineup) ? args.lineup.filter((x): x is string => typeof x === "string") : [],
    ticket_link: typeof args.ticket_link === "string" && args.ticket_link ? args.ticket_link : null,
    description: typeof args.description === "string" && args.description ? args.description : null,
    confidence: (["high", "medium", "low"].includes(args.confidence as string) ? args.confidence : "low") as "high" | "medium" | "low",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/scan-event-sources/extract_test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/scan-event-sources/extract.ts supabase/functions/scan-event-sources/extract_test.ts
git commit -m "feat(edge): add pure AI extraction request/parse logic"
```

---

### Task 6: Edge Function `scan-event-sources` (orquestração)

**Files:**
- Modify: `supabase/functions/_shared/index.ts` (adicionar `scrapeWithFirecrawl` e `authorizeAdminOrCron`)
- Create: `supabase/functions/scan-event-sources/index.ts`

**Interfaces:**
- Consumes: `handleCorsPreFlight`, `jsonSuccess`, `handleError`, `fetchWithTimeout` (Task 1); `isDuplicateEvent` (Task 4); `buildExtractionRequest`, `parseExtractionResponse` (Task 5).
- Produces: `scrapeWithFirecrawl(url: string, apiKey: string, timeoutMs?: number): Promise<{ success: boolean; markdown?: string; error?: string }>`, `authorizeAdminOrCron(req: Request, admin: SupabaseClient, opts: { anonKey: string; cronSecretRowName: string; cronJobHeaderValue: string }): Promise<{ authorized: boolean; status: number; message?: string }>`.

- [ ] **Step 1: Adicionar `scrapeWithFirecrawl` e `authorizeAdminOrCron` ao módulo compartilhado**

Adicionar ao final de `supabase/functions/_shared/index.ts` (reaproveita o padrão exato de `generate-blog-suggestions/index.ts:79-131`, só que compartilhado). Primeiro, adicionar o import no topo do arquivo (o módulo hoje não importa nada — este é o primeiro import):

```ts
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
```

Depois, ao final do arquivo:

```ts
export async function scrapeWithFirecrawl(
  url: string,
  apiKey: string,
  timeoutMs = 10000,
): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 1500,
        }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.success && data.data?.markdown) {
      return { success: true, markdown: data.data.markdown };
    }
    return { success: false, error: "No markdown content returned" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Timeout" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function authorizeAdminOrCron(
  req: Request,
  admin: SupabaseClient,
  opts: { anonKey: string; cronSecretRowName: string; cronJobHeaderValue: string },
): Promise<{ authorized: boolean; status: number; message?: string }> {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const cronJobHeader = req.headers.get("x-cron-job");

  if (cronSecretHeader && cronJobHeader === opts.cronJobHeaderValue) {
    const { data: row } = await admin
      .from("internal_cron_secrets")
      .select("secret")
      .eq("name", opts.cronSecretRowName)
      .maybeSingle();
    if (row?.secret && row.secret === cronSecretHeader) {
      return { authorized: true, status: 200 };
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { authorized: false, status: 401, message: "Não autenticado" };

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, opts.anonKey);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData.user) return { authorized: false, status: 401, message: "Token inválido" };

  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return { authorized: false, status: 403, message: "Apenas admins" };

  return { authorized: true, status: 200 };
}
```

- [ ] **Step 2: Escrever `scan-event-sources/index.ts`**

```ts
// supabase/functions/scan-event-sources/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreFlight,
  jsonSuccess,
  jsonError,
  handleError,
  fetchWithTimeout,
  scrapeWithFirecrawl,
  authorizeAdminOrCron,
} from "../_shared/index.ts";
import { isDuplicateEvent } from "./dedupe.ts";
import { buildExtractionRequest, parseExtractionResponse } from "./extract.ts";

const SCRAPE_TIMEOUT_MS = 10000;
const AI_TIMEOUT_MS = 60000;
const MAX_CONTENT_LENGTH = 4000;

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const admin = createClient(supabaseUrl, serviceKey);

    const auth = await authorizeAdminOrCron(req, admin, {
      anonKey,
      cronSecretRowName: "scan_event_sources_cron",
      cronJobHeaderValue: "scan-event-sources-cron",
    });
    if (!auth.authorized) return jsonError(auth.message ?? "Não autorizado", auth.status);

    if (!firecrawlKey) return jsonError("FIRECRAWL_API_KEY não configurada", 500);
    if (!lovableKey) return jsonError("LOVABLE_API_KEY não configurada", 500);

    const { data: sources, error: sourcesError } = await admin
      .from("event_sources")
      .select("id, name, url")
      .eq("type", "site")
      .eq("enabled", true);
    if (sourcesError) throw sourcesError;

    const { data: existingEvents } = await admin.from("events").select("title, date");
    const { data: existingDrafts } = await admin
      .from("event_watch_drafts")
      .select("extracted_title, extracted_date")
      .neq("status", "rejected");

    const existing = [
      ...(existingEvents ?? []).map((e) => ({ title: e.title, date: e.date })),
      ...(existingDrafts ?? []).map((d) => ({ title: d.extracted_title, date: d.extracted_date })),
    ];

    let created = 0;
    let skippedDuplicate = 0;
    let skippedNoEvent = 0;
    let scrapeErrors = 0;

    for (const source of sources ?? []) {
      const scrape = await scrapeWithFirecrawl(source.url, firecrawlKey, SCRAPE_TIMEOUT_MS);
      if (!scrape.success || !scrape.markdown) {
        scrapeErrors++;
        continue;
      }

      const truncated = scrape.markdown.slice(0, MAX_CONTENT_LENGTH);
      const requestBody = buildExtractionRequest("google/gemini-2.5-flash", source, truncated);

      const aiResponse = await fetchWithTimeout(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
        AI_TIMEOUT_MS,
      );

      if (!aiResponse.ok) {
        scrapeErrors++;
        continue;
      }

      const aiData = await aiResponse.json();
      const extracted = parseExtractionResponse(aiData);

      if (!extracted) {
        skippedNoEvent++;
        continue;
      }

      if (isDuplicateEvent(extracted, existing)) {
        skippedDuplicate++;
        continue;
      }

      const { error: insertError } = await admin.from("event_watch_drafts").insert({
        source_id: source.id,
        status: "pending_review",
        extracted_title: extracted.title,
        extracted_date: extracted.date,
        extracted_time: extracted.time,
        extracted_venue: extracted.venue,
        extracted_address: extracted.address,
        extracted_city: extracted.location_city,
        extracted_state: extracted.location_state,
        extracted_lineup: extracted.lineup,
        extracted_ticket_link: extracted.ticket_link,
        extracted_description: extracted.description,
        extracted_confidence: extracted.confidence,
        source_raw_excerpt: truncated.slice(0, 1500),
      });
      if (insertError) throw insertError;

      existing.push({ title: extracted.title, date: extracted.date });
      created++;

      await admin
        .from("event_sources")
        .update({ last_scanned_at: new Date().toISOString() })
        .eq("id", source.id);
    }

    return jsonSuccess({
      success: true,
      sourcesScanned: (sources ?? []).length,
      created,
      skippedDuplicate,
      skippedNoEvent,
      scrapeErrors,
    });
  } catch (error) {
    return handleError(error, "scan-event-sources");
  }
});
```

- [ ] **Step 3: Verificação manual do fluxo feliz**

1. `mcp__supabase-mdaccula__execute_sql`: `insert into event_sources (name, url) values ('Fonte de teste', 'https://example.com')`.
2. Configurar o secret `FIRECRAWL_API_KEY` (já deve existir no projeto — ver README.md:590-597) — se ainda não houver, pedir ao usuário via `mcp__supabase-mdaccula__` (a ferramenta de secrets não está na lista MCP disponível; usar o painel do Supabase/Lovable Cloud).
3. `mcp__supabase-mdaccula__deploy_edge_function` para `scan-event-sources`.
4. Chamar a função autenticado como admin (via `supabase.functions.invoke` no console do navegador logado como admin, ou `curl` com um token de admin válido) e conferir a resposta `{ success: true, sourcesScanned: 1, ... }`.
5. `select * from event_watch_drafts` — confirmar que, se a fonte de teste tiver conteúdo de evento, um rascunho foi criado; se não, `skippedNoEvent` deve ser 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/index.ts supabase/functions/scan-event-sources/index.ts
git commit -m "feat(edge): add scan-event-sources orchestration function"
```

---

### Task 7: Contract test (`scan-event-sources`)

**Files:**
- Create: `src/__tests__/contracts/edge-scan-event-sources.test.ts`

**Interfaces:**
- Consumes: nenhuma (teste HTTP puro contra o ambiente real, no padrão de `edge-weekly-digest-draft.test.ts`).

- [ ] **Step 1: Write the test**

```ts
// src/__tests__/contracts/edge-scan-event-sources.test.ts
/**
 * Contract test — Edge Function `scan-event-sources`.
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/scan-event-sources` : "";

describe.skipIf(!SUPABASE_URL)("Contract: scan-event-sources", () => {
  it("OPTIONS retorna CORS preflight válido", async () => {
    const res = await fetch(FN_URL, { method: "OPTIONS" });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    const allowedHeaders = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowedHeaders.toLowerCase()).toContain("x-cron-secret");
  });

  it("Sem auth e sem cron-secret → 401 com JSON de erro", async () => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("Anon-key (não-admin) → guard rejeita (401 ou 403)", async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty("error");
  });

  it("x-cron-secret inválido → não bypassa auth", async () => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": "obviously-invalid-secret-xyz",
        "x-cron-job": "scan-event-sources-cron",
      },
      body: "{}",
    });
    await res.text();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/__tests__/contracts/edge-scan-event-sources.test.ts`
Expected: se `VITE_SUPABASE_URL` não estiver setado localmente, os 4 testes aparecem como `skipped` (não falham). Em CI/staging com env configurado e a função já implantada (Task 6 concluída), os 4 devem passar.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/contracts/edge-scan-event-sources.test.ts
git commit -m "test: add contract test for scan-event-sources"
```

---

### Task 8: Admin — `EventSourcesManager.tsx`

**Files:**
- Create: `src/pages/admin/EventSourcesManager.tsx`

**Interfaces:**
- Consumes: `EventSource`, `EventSourceInsert` (Task 3, via `@/types`), `useToast` (via `@/hooks`), `supabase` (via `@/integrations/supabase/client`).

- [ ] **Step 1: Implementar a página (padrão `PodcastManager.tsx`: `useQuery`/`useMutation` + `Table` + `Dialog`)**

```tsx
// src/pages/admin/EventSourcesManager.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks";
import type { EventSource, EventSourceInsert } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";

export default function EventSourcesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EventSourceInsert>({ name: "", url: "", type: "site" });

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["event-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EventSource[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: EventSourceInsert) => {
      const { error } = await supabase.from("event_sources").insert([input]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sources"] });
      toast({ title: "Fonte adicionada!" });
      setDialogOpen(false);
      setForm({ name: "", url: "", type: "site" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar fonte", description: error.message, variant: "destructive" });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("event_sources").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-sources"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sources"] });
      toast({ title: "Fonte removida" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fontes de Eventos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova Fonte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova fonte (site)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="source-name">Nome</Label>
                <Input
                  id="source-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="source-url">URL</Label>
                <Input
                  id="source-url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://exemplo.com/agenda"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ ...form, type: "site" })}
                disabled={!form.name || !form.url || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fontes cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead>Última varredura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-xs">{source.url}</TableCell>
                    <TableCell>
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={(checked) =>
                          toggleEnabledMutation.mutate({ id: source.id, enabled: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {source.last_scanned_at ? new Date(source.last_scanned_at).toLocaleString("pt-BR") : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(source.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros (depende de Task 2 já ter regenerado `types.ts` e Task 3 os tipos do barrel).

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/EventSourcesManager.tsx
git commit -m "feat(admin): add EventSourcesManager page"
```

---

### Task 9: Admin — `EventWatchReview.tsx` (fila de revisão + aprovação)

**Files:**
- Create: `src/pages/admin/EventWatchReview.tsx`

**Interfaces:**
- Consumes: `EventWatchDraft` (Task 3), `buildArticlePayload`/`EventLike` de `@/lib/eventArticlePayload` (já existe), `supabase.functions.invoke('generate-blog-post-v2', ...)` (já existe, contrato confirmado em `EventsManager.tsx:234-249`), `supabase.functions.invoke('scan-event-sources', ...)` (Task 6).

- [ ] **Step 1: Implementar a página**

```tsx
// src/pages/admin/EventWatchReview.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks";
import type { EventWatchDraft } from "@/types";
import { buildArticlePayload, type EventLike } from "@/lib/eventArticlePayload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Check, X } from "lucide-react";

interface EditedFields {
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  locationCity: string;
  locationState: string;
  lineup: string;
  ticketLink: string;
  description: string;
}

function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-zA-Z0-9_]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString().slice(-6);
  return `${base}-${timestamp}`;
}

function toEditedFields(draft: EventWatchDraft): EditedFields {
  return {
    title: draft.extracted_title,
    date: draft.extracted_date,
    time: draft.extracted_time ?? "",
    venue: draft.extracted_venue ?? "",
    address: draft.extracted_address ?? "",
    locationCity: draft.extracted_city ?? "",
    locationState: draft.extracted_state ?? "",
    lineup: (draft.extracted_lineup ?? []).join(", "),
    ticketLink: draft.extracted_ticket_link ?? "",
    description: draft.extracted_description ?? "",
  };
}

const confidenceColor: Record<string, string> = {
  high: "bg-green-500/20 text-green-400 border-green-500/40",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  low: "bg-red-500/20 text-red-400 border-red-500/40",
};

export default function EventWatchReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<EventWatchDraft | null>(null);
  const [edited, setEdited] = useState<EditedFields | null>(null);
  const [scanning, setScanning] = useState(false);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["event-watch-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_watch_drafts")
        .select("*, event_sources(name, url)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EventWatchDraft[];
    },
  });

  const openDraft = (draft: EventWatchDraft) => {
    setSelected(draft);
    setEdited(toEditedFields(draft));
  };

  const rejectMutation = useMutation({
    mutationFn: async (draft: EventWatchDraft) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("event_watch_drafts")
        .update({
          status: "rejected",
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
      toast({ title: "Rascunho rejeitado" });
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ draft, fields }: { draft: EventWatchDraft; fields: EditedFields }) => {
      const eventInsert = {
        title: fields.title,
        slug: slugify(fields.title),
        date: fields.date,
        time: fields.time || null,
        venue: fields.venue,
        address: fields.address || null,
        location_city: fields.locationCity,
        location_state: fields.locationState,
        lineup: fields.lineup ? fields.lineup.split(",").map((s) => s.trim()).filter(Boolean) : null,
        ticket_link: fields.ticketLink || null,
        description: fields.description || null,
      };

      const { data: insertedEvent, error: eventError } = await supabase
        .from("events")
        .insert([eventInsert])
        .select()
        .single();
      if (eventError) throw eventError;

      const payload = buildArticlePayload(insertedEvent as unknown as EventLike, {
        generateImage: !insertedEvent.image_url,
      });
      const { data: blogData, error: blogError } = await supabase.functions.invoke("generate-blog-post-v2", {
        body: payload,
      });
      if (blogError) throw blogError;
      if (!blogData?.post?.id) throw new Error("Resposta inválida do gerador de artigo");

      const { error: linkError } = await supabase
        .from("events")
        .update({ blog_post_id: blogData.post.id })
        .eq("id", insertedEvent.id);
      if (linkError) throw linkError;

      const { data: userData } = await supabase.auth.getUser();
      const { error: draftError } = await supabase
        .from("event_watch_drafts")
        .update({
          status: "published",
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          published_event_id: insertedEvent.id,
          published_blog_post_id: blogData.post.id,
        })
        .eq("id", draft.id);
      if (draftError) throw draftError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
      toast({ title: "Publicado!", description: "Evento e artigo criados com sucesso." });
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao aprovar rascunho", description: error.message, variant: "destructive" });
    },
  });

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-event-sources", { body: {} });
      if (error) throw error;
      toast({
        title: "Varredura concluída",
        description: `${data.created} rascunho(s) criado(s) de ${data.sourcesScanned} fonte(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
    } catch (error) {
      toast({
        title: "Erro na varredura",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisão de Eventos (IA)</h1>
        <Button onClick={handleScanNow} disabled={scanning}>
          {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Executar Agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendentes de revisão</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : drafts.length === 0 ? (
            <p className="text-muted-foreground">Nenhum rascunho pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Confiança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDraft(draft)}>
                    <TableCell className="font-medium">{draft.extracted_title}</TableCell>
                    <TableCell>{draft.extracted_date}</TableCell>
                    <TableCell className="text-muted-foreground">{draft.event_sources?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={confidenceColor[draft.extracted_confidence]}>
                        {draft.extracted_confidence}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && edited && (
            <>
              <DialogHeader>
                <DialogTitle>Revisar rascunho</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={edited.title} onChange={(e) => setEdited({ ...edited, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={edited.date} onChange={(e) => setEdited({ ...edited, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Input type="time" value={edited.time} onChange={(e) => setEdited({ ...edited, time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Local (venue)</Label>
                  <Input value={edited.venue} onChange={(e) => setEdited({ ...edited, venue: e.target.value })} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={edited.address} onChange={(e) => setEdited({ ...edited, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={edited.locationCity} onChange={(e) => setEdited({ ...edited, locationCity: e.target.value })} />
                  </div>
                  <div>
                    <Label>Estado (UF)</Label>
                    <Input value={edited.locationState} onChange={(e) => setEdited({ ...edited, locationState: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Lineup (separado por vírgula)</Label>
                  <Input value={edited.lineup} onChange={(e) => setEdited({ ...edited, lineup: e.target.value })} />
                </div>
                <div>
                  <Label>Link de ingressos</Label>
                  <Input value={edited.ticketLink} onChange={(e) => setEdited({ ...edited, ticketLink: e.target.value })} />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={edited.description} onChange={(e) => setEdited({ ...edited, description: e.target.value })} />
                </div>
                {selected.source_raw_excerpt && (
                  <div>
                    <Label className="text-muted-foreground">Trecho original da fonte</Label>
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                      {selected.source_raw_excerpt}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate(selected)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Rejeitar
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ draft: selected, fields: edited })}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Aprovar e publicar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/EventWatchReview.tsx
git commit -m "feat(admin): add EventWatchReview page with approve/reject flow"
```

---

### Task 10: Rotas e menu admin

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `EventSourcesManager` (Task 8), `EventWatchReview` (Task 9).

- [ ] **Step 1: Adicionar lazy imports em `src/App.tsx`**

Localizar o bloco de lazy imports admin (perto de `const NewsSourcesManager = lazy(...)`) e adicionar logo depois:

```tsx
const EventSourcesManager = lazy(() => import("./pages/admin/EventSourcesManager"));
const EventWatchReview = lazy(() => import("./pages/admin/EventWatchReview"));
```

- [ ] **Step 2: Adicionar as rotas dentro do `<Route path="/admin" element={<AdminLayout />}>`**

Localizar (via Grep por `NewsSourcesManager`) a linha da rota `news-sources` e adicionar logo depois, seguindo o mesmo formato de `<Route path="blog" ...>`:

```tsx
<Route path="event-sources" element={<PageWithError name="Fontes de Eventos"><EventSourcesManager /></PageWithError>} />
<Route path="event-watch-review" element={<PageWithError name="Revisão de Eventos"><EventWatchReview /></PageWithError>} />
```

- [ ] **Step 3: Adicionar itens no menu, em `src/components/admin/AdminSidebar.tsx`**

Adicionar `Radar` e `ClipboardCheck` ao import de `lucide-react` (linha 2-25), e dois itens no grupo `"Inteligência Artificial"` (logo após o item `"Fontes de Notícias"`, linha ~65):

```tsx
{ title: "Fontes de Eventos", url: "/admin/event-sources", icon: Radar },
{ title: "Revisão de Eventos (IA)", url: "/admin/event-watch-review", icon: ClipboardCheck },
```

- [ ] **Step 4: Verificação manual (dev server)**

Run: `npm run dev`
Expected: logado como admin, `/admin/event-sources` e `/admin/event-watch-review` carregam sem erro; os 2 itens aparecem no menu lateral, grupo "Inteligência Artificial"; deslogado ou não-admin, ambas as rotas mostram "Acesso Negado" (via `ProtectedRoute`, herdado do `AdminLayout` — nenhum código de proteção extra necessário).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): wire up Event Watcher routes and sidebar links"
```

---

### Task 11: Suite completa + habilitar o cron (opcional, quando aprovado)

**Files:** nenhum arquivo novo — checagem final.

- [ ] **Step 1: Rodar a suite completa**

Run: `npm test && npm run test:coverage:ratchet && npx tsc --noEmit`
Expected: todos verdes (ratchet não pode cair mais que 0.5pp).

Run (se Deno estiver instalado): `npm run test:edge`
Expected: os testes de `_shared`, `dedupe` e `extract` passam (11 testes novos).

- [ ] **Step 2: Fluxo ponta a ponta manual**

1. Cadastrar uma fonte real em `/admin/event-sources` (um site com agenda de eventos conhecida).
2. Clicar "Executar Agora" em `/admin/event-watch-review`.
3. Confirmar que um rascunho aparece (ou que `skippedNoEvent`/`scrapeErrors` explica por que não).
4. Abrir o rascunho, revisar/editar os campos, clicar "Aprovar e publicar".
5. Confirmar em `/admin/events` que o evento foi criado, e em `/admin/blog` que o artigo foi gerado e vinculado (`blog_post_id` preenchido).

- [ ] **Step 3 (opcional): Ligar o cron automático a cada 48h**

Quando o piloto manual estiver validado, rodar uma vez via `mcp__supabase-mdaccula__execute_sql`:

```sql
select manage_digest_schedule(
  'scan-event-sources-cron',
  true,
  '0 */48 * * *',
  '<SUPABASE_URL>/functions/v1/scan-event-sources',
  '<gerar um uuid novo com gen_random_uuid() e também inserir em internal_cron_secrets com name = ''scan_event_sources_cron''>'
);
```

(Um painel admin para configurar isso pela UI, no padrão de `update-digest-schedule`, fica para uma iteração futura — não bloqueia o piloto.)
