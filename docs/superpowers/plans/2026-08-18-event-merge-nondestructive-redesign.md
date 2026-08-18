# Mesclagem de eventos não-destrutiva — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a mesclagem de eventos pra nunca mutar os eventos originais — mesclar cria 1
evento novo ("card-vitrine") e só marca os originais como escondidos; desmesclar (total ou
parcial) vira uma operação trivial de religar visibilidade, sem log/snapshot nenhum pra manter.

**Architecture:** Reaproveita a tabela `events` (nova coluna `is_merge_shell`), reaproveita
`merged_into_id`/`status='merged_inactive'` já existentes. A lógica de cálculo do card-vitrine
(nome/imagem/schedule/ticket) é extraída pra uma função pura testável
(`src/lib/eventMergeHelper.ts`), deixando os componentes React finos. O seletor de dia de
ingresso passa a ler ao vivo dos eventos escondidos em vez de uma cópia em `custom_links`.

**Tech Stack:** React + TypeScript + Vite, Supabase/Postgres, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md`

## Global Constraints

- `/links` nunca é tocado por esta feature — nenhuma tarefa deste plano deve mexer em
  `custom_links` ou nas telas de `/links`.
- Nenhum evento escondido (membro de um merge) tem qualquer campo próprio alterado pela
  mesclagem — só `status`/`merged_into_id`/`merged_at`.
- Todo passo que altera `supabase/functions/**` ou `supabase/migrations/**` segue o padrão do
  projeto: migrations aplicadas direto via MCP do Supabase (`apply_migration`), nunca só
  torcendo pra CI pegar.
- Toda fase termina com `npx tsc --noEmit` + `npm test` + `npm run test:coverage:ratchet` verdes
  antes de commit/push.

---

## Fase 1 — Coluna `is_merge_shell` + conversão do merge "Nostalgia"

### Task 1.1: Migration, tipos gerados e conversão de dado

**Files:**
- Create: `supabase/migrations/20260818140000_add_is_merge_shell_to_events.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerado via MCP, não à mão)
- Create: `src/__tests__/regression/merge-shell-column-and-nostalgia-migration.test.ts`
- Modify: `docs/tabelas.md`
- Modify: `docs/DATABASE_SCHEMA.md`

**Interfaces:**
- Produces: coluna `public.events.is_merge_shell BOOLEAN NOT NULL DEFAULT false`, índice
  `idx_events_merged_into_id`. Usados por todas as fases seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260818140000_add_is_merge_shell_to_events.sql

-- "Card-vitrine": evento criado pela mesclagem de outros. Nunca é um dos
-- eventos originais mutado — é sempre um evento NOVO, marcado por esta
-- coluna. Eventos absorvidos continuam usando merged_into_id/status
-- (já existentes) apontando pra ele, sem nenhum dado próprio alterado.
ALTER TABLE public.events
  ADD COLUMN is_merge_shell BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_merged_into_id
  ON public.events(merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- Converte o único merge ativo hoje no modelo antigo (evento "Nostalgia",
-- mesclado em 14/06/2026) pro modelo novo: o evento que já é o "principal"
-- vira, retroativamente, um card-vitrine — mesma URL, mesmo card, nada
-- muda pro público.
UPDATE public.events
SET is_merge_shell = true
WHERE id = 'bece84f6-371a-4a32-9444-253fae204037';
```

- [ ] **Step 2: Aplicar a migration no projeto `mdaccula` via MCP**

Usar `mcp__supabase-mdaccula__apply_migration` com `name: "add_is_merge_shell_to_events"` e o
conteúdo do Step 1 como `query`.

- [ ] **Step 3: Conferir ao vivo no banco**

Rodar via `mcp__supabase-mdaccula__execute_sql`:

```sql
select id, title, is_merge_shell from public.events
where id = 'bece84f6-371a-4a32-9444-253fae204037';
```

Esperado: 1 linha, `is_merge_shell = true`.

- [ ] **Step 4: Regenerar `src/integrations/supabase/types.ts`**

Usar `mcp__supabase-mdaccula__generate_typescript_types` e sobrescrever o arquivo com o resultado
(nunca editar esse arquivo à mão — é auto-gerado).

- [ ] **Step 5: Escrever o teste de regressão**

```ts
// src/__tests__/regression/merge-shell-column-and-nostalgia-migration.test.ts
/**
 * Regressão — a coluna `is_merge_shell` e a conversão do merge "Nostalgia"
 * pro modelo não-destrutivo precisam continuar existindo nas migrations,
 * senão a Fase 1 do redesenho de mesclagem (ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md)
 * nunca chegou a valer no banco.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function allMigrationsText(): string {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
    .join('\n');
}

describe('Migration — events.is_merge_shell existe e o merge "Nostalgia" foi convertido', () => {
  it('alguma migration adiciona a coluna is_merge_shell em events, com default false', () => {
    const all = allMigrationsText();
    expect(all).toMatch(/ADD COLUMN is_merge_shell BOOLEAN NOT NULL DEFAULT false/i);
  });

  it('alguma migration converte o card do merge "Nostalgia" pro novo modelo', () => {
    const all = allMigrationsText();
    expect(all).toMatch(/is_merge_shell\s*=\s*true/i);
    expect(all).toMatch(/bece84f6-371a-4a32-9444-253fae204037/i);
  });
});
```

- [ ] **Step 6: Rodar o teste novo**

Run: `npx vitest run src/__tests__/regression/merge-shell-column-and-nostalgia-migration.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 7: Documentação**

Em `docs/tabelas.md`, no bloco `CREATE TABLE public.events` (procurar `merged_at
TIMESTAMP WITH TIME ZONE,`), adicionar logo depois:

```sql
  is_merge_shell BOOLEAN NOT NULL DEFAULT false, -- true = evento "card-vitrine" criado por mesclagem (nunca um evento original mutado)
```

Em `docs/DATABASE_SCHEMA.md`, na linha da tabela `events` (buscar `merged_into_id`), adicionar
`is_merge_shell` à lista de colunas citadas.

- [ ] **Step 8: Verificação completa e commit**

Run: `npx tsc --noEmit && npm test && npm run test:coverage:ratchet`
Expected: tudo verde.

```bash
git add supabase/migrations/20260818140000_add_is_merge_shell_to_events.sql \
  src/integrations/supabase/types.ts \
  src/__tests__/regression/merge-shell-column-and-nostalgia-migration.test.ts \
  docs/tabelas.md docs/DATABASE_SCHEMA.md
git commit -m "feat(events): adiciona is_merge_shell e converte merge Nostalgia pro modelo novo"
git push
```

---

## Fase 2 — Mesclar cria um evento novo, sem mutar os originais

### Task 2.1: Função pura de cálculo do card-vitrine

**Files:**
- Create: `src/lib/eventMergeHelper.ts`
- Test: `src/__tests__/lib/eventMergeHelper.test.ts`

**Interfaces:**
- Produces: `MergeableEventRow`, `MergeChoices`, `MergeShellPayload` (types),
  `hasDistinctTicketLinks(events): boolean`, `buildMergeShellPayload(events, seedId, choices):
  MergeShellPayload` — consumidos pela Task 2.2.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```ts
// src/__tests__/lib/eventMergeHelper.test.ts
import { describe, it, expect } from 'vitest';
import {
  hasDistinctTicketLinks,
  buildMergeShellPayload,
  type MergeableEventRow,
} from '@/lib/eventMergeHelper';

function makeEvent(overrides: Partial<MergeableEventRow>): MergeableEventRow {
  return {
    id: 'id',
    title: 'Título',
    subtitle: null,
    venue: 'Venue',
    address: 'Endereço',
    location_state: 'SP',
    location_city: 'São Paulo',
    date: '2026-12-28',
    end_date: null,
    time: '16:00',
    end_time: null,
    genres: ['House'],
    lineup: ['Artista'],
    description: 'Descrição',
    ticket_link: 'https://exemplo.com/ingresso',
    vip_link: null,
    pix_button_enabled: false,
    cta_type: 'buy_ticket',
    image_url: 'https://exemplo.com/imagem.webp',
    views: 10,
    ...overrides,
  };
}

describe('hasDistinctTicketLinks', () => {
  it('retorna false quando todos os eventos têm o mesmo link', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/1' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/1' }),
    ];
    expect(hasDistinctTicketLinks(events)).toBe(false);
  });

  it('retorna true quando os links divergem', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/1' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/2' }),
    ];
    expect(hasDistinctTicketLinks(events)).toBe(true);
  });
});

describe('buildMergeShellPayload', () => {
  it('não muta nenhum dos eventos recebidos', () => {
    const events = [
      Object.freeze(makeEvent({ id: 'a', date: '2026-12-28' })),
      Object.freeze(makeEvent({ id: 'b', date: '2026-12-29' })),
    ];
    expect(() =>
      buildMergeShellPayload(events, 'a', {
        title: 'Festival X',
        imageUrl: 'https://exemplo.com/nova.webp',
        ticketsPerDay: true,
      })
    ).not.toThrow();
  });

  it('calcula intervalo de datas, soma views e monta schedule com todos os dias', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-12-29', end_date: null, views: 5, lineup: ['B'] }),
      makeEvent({ id: 'b', date: '2026-12-28', end_date: null, views: 3, lineup: ['A'] }),
      makeEvent({ id: 'c', date: '2026-12-31', end_date: null, views: 2, lineup: ['C'] }),
    ];
    const payload = buildMergeShellPayload(events, 'b', {
      title: 'Festival X',
      imageUrl: 'https://exemplo.com/nova.webp',
      ticketsPerDay: true,
    });

    expect(payload.date).toBe('2026-12-28');
    expect(payload.end_date).toBe('2026-12-31');
    expect(payload.views).toBe(10);
    expect(payload.schedule).toEqual([
      { date: '2026-12-28', time: '16:00', end_time: null, lineup: ['A'] },
      { date: '2026-12-29', time: '16:00', end_time: null, lineup: ['B'] },
      { date: '2026-12-31', time: '16:00', end_time: null, lineup: ['C'] },
    ]);
  });

  it('copia venue/endereço/gêneros/etc. do evento "seed" (não do primeiro por data)', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-12-29', venue: 'Venue A', genres: ['Techno'] }),
      makeEvent({ id: 'b', date: '2026-12-28', venue: 'Venue B', genres: ['House'] }),
    ];
    const payload = buildMergeShellPayload(events, 'a', {
      title: 'Festival X',
      imageUrl: null,
      ticketsPerDay: false,
    });
    expect(payload.venue).toBe('Venue A');
    expect(payload.genres).toEqual(['Techno']);
  });

  it('quando ticketsPerDay=false, copia o ticket_link do seed; quando true, fica null', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/unico' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/unico' }),
    ];
    const single = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: false,
    });
    expect(single.ticket_link).toBe('https://x.com/unico');

    const perDay = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: true,
    });
    expect(perDay.ticket_link).toBeNull();
  });

  it('sempre nasce sem artigo vinculado e como card-vitrine ativo', () => {
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];
    const payload = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: true,
    });
    expect(payload.blog_post_id).toBeNull();
    expect(payload.status).toBe('active');
    expect(payload.is_merge_shell).toBe(true);
  });

  it('lança erro claro se o seedId não estiver entre os eventos', () => {
    const events = [makeEvent({ id: 'a' })];
    expect(() =>
      buildMergeShellPayload(events, 'inexistente', {
        title: 'F',
        imageUrl: null,
        ticketsPerDay: false,
      })
    ).toThrow(/base não encontrado/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha (módulo não existe ainda)**

Run: `npx vitest run src/__tests__/lib/eventMergeHelper.test.ts`
Expected: FAIL — `Cannot find module '@/lib/eventMergeHelper'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/eventMergeHelper.ts
/**
 * Cálculo puro do "card-vitrine" resultante de uma mesclagem de eventos —
 * extraído de MergeEventsDialog pra ser testável sem mockar Supabase.
 * Nunca muta os eventos recebidos: só lê e retorna um objeto novo.
 */
import { normalizeLineup } from '@/lib/lineupNormalizer';

export interface MergeableEventRow {
  id: string;
  title: string;
  subtitle: string | null;
  venue: string;
  address: string | null;
  location_state: string;
  location_city: string;
  date: string;
  end_date: string | null;
  time: string | null;
  end_time: string | null;
  genres: string[];
  lineup: string[] | null;
  description: string | null;
  ticket_link: string | null;
  vip_link: string | null;
  pix_button_enabled: boolean;
  cta_type: string;
  image_url: string | null;
  views: number | null;
}

export interface MergeChoices {
  title: string;
  imageUrl: string | null;
  ticketsPerDay: boolean;
}

export interface MergeSchedulePartDay {
  date: string;
  time: string | null;
  end_time: string | null;
  lineup: string[];
}

export interface MergeShellPayload {
  title: string;
  subtitle: string | null;
  venue: string;
  address: string | null;
  location_state: string;
  location_city: string;
  date: string;
  end_date: string;
  time: string | null;
  end_time: string | null;
  genres: string[];
  description: string | null;
  schedule: MergeSchedulePartDay[];
  ticket_link: string | null;
  vip_link: string | null;
  pix_button_enabled: boolean;
  tickets_per_day: boolean;
  cta_type: string;
  image_url: string | null;
  views: number;
  blog_post_id: null;
  status: 'active';
  is_merge_shell: true;
}

export function hasDistinctTicketLinks(events: Pick<MergeableEventRow, 'ticket_link'>[]): boolean {
  const links = events.map((e) => (e.ticket_link || '').trim()).filter(Boolean);
  return new Set(links).size > 1;
}

export function buildMergeShellPayload(
  events: MergeableEventRow[],
  seedId: string,
  choices: MergeChoices
): MergeShellPayload {
  const seed = events.find((e) => e.id === seedId);
  if (!seed) {
    throw new Error('Evento base não encontrado entre os eventos selecionados.');
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date;
  const lastEvent = sorted[sorted.length - 1];
  const endDate = lastEvent.end_date && lastEvent.end_date > lastEvent.date
    ? lastEvent.end_date
    : lastEvent.date;

  const schedule: MergeSchedulePartDay[] = sorted.map((e) => ({
    date: e.date,
    time: e.time,
    end_time: e.end_time,
    lineup: normalizeLineup(e.lineup),
  }));

  const totalViews = events.reduce((sum, e) => sum + (e.views || 0), 0);
  const sharedTicketLink = choices.ticketsPerDay ? null : seed.ticket_link;

  return {
    title: choices.title,
    subtitle: seed.subtitle,
    venue: seed.venue,
    address: seed.address,
    location_state: seed.location_state,
    location_city: seed.location_city,
    date: startDate,
    end_date: endDate,
    time: seed.time,
    end_time: seed.end_time,
    genres: seed.genres,
    description: seed.description,
    schedule,
    ticket_link: sharedTicketLink,
    vip_link: seed.vip_link,
    pix_button_enabled: seed.pix_button_enabled,
    tickets_per_day: choices.ticketsPerDay,
    cta_type: seed.cta_type,
    image_url: choices.imageUrl,
    views: totalViews,
    blog_post_id: null,
    status: 'active',
    is_merge_shell: true,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/__tests__/lib/eventMergeHelper.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventMergeHelper.ts src/__tests__/lib/eventMergeHelper.test.ts
git commit -m "feat(events): extrai cálculo puro do card-vitrine de mesclagem"
```

(Push fica pro fim da Fase 2 — Task 2.3 — junto com o resto da fase funcionando de ponta a
ponta.)

### Task 2.2: Reescrever `MergeEventsDialog.tsx`

**Files:**
- Modify: `src/components/admin/MergeEventsDialog.tsx` (reescrita completa)
- Modify: `src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx` (adaptado — não
  existe mais "escolher o principal")

**Interfaces:**
- Consumes: `hasDistinctTicketLinks`, `buildMergeShellPayload`, `MergeableEventRow` de
  `@/lib/eventMergeHelper` (Task 2.1); `uploadImageWithThumb` de `@/lib/bunnyUploader`
  (já existe); `ImageUploadWithCrop` de `@/components/ui/ImageUploadWithCrop` (já existe).
- Produces: mesmas props públicas do componente (`open`, `onOpenChange`, `events`, `onSuccess`) —
  nenhum consumidor externo precisa mudar.

- [ ] **Step 1: Reescrever o componente**

```tsx
// src/components/admin/MergeEventsDialog.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { formatEventDateRange } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUploadWithCrop } from '@/components/ui/ImageUploadWithCrop';
import { uploadImageWithThumb } from '@/lib/bunnyUploader';
import {
  hasDistinctTicketLinks,
  buildMergeShellPayload,
  type MergeableEventRow,
} from '@/lib/eventMergeHelper';

interface MergeableEvent {
  id: string;
  title: string;
  slug: string;
  date: string;
  end_date?: string | null;
  venue: string;
  views?: number | null;
  blog_post_id?: string | null;
  ticket_link?: string | null;
  image_url?: string | null;
  is_merge_shell?: boolean;
  merged_into_id?: string | null;
}

interface MergeEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MergeableEvent[];
  onSuccess: () => void;
}

/**
 * Mescla 2+ eventos criando 1 evento NOVO ("card-vitrine", is_merge_shell=true)
 * que herda nome/imagem/venue escolhidos + schedule/views agregados.
 * Os eventos selecionados NUNCA são alterados — só recebem
 * status='merged_inactive' + merged_into_id apontando pro card novo.
 * Desfazer (UndoMergeDialog) é sempre possível, em qualquer momento, porque
 * não existe nenhum dado original pra restaurar.
 */
export const MergeEventsDialog = ({
  open,
  onOpenChange,
  events,
  onSuccess,
}: MergeEventsDialogProps) => {
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [ticketsPerDay, setTicketsPerDay] = useState<boolean | null>(null);
  const [mergedTitle, setMergedTitle] = useState<string>('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [imageMode, setImageMode] = useState<'existing' | 'upload'>('existing');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const seed = events[0];

  const dateRange = useMemo(() => {
    if (!events.length) return null;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0].date;
    const end = sorted[sorted.length - 1].end_date || sorted[sorted.length - 1].date;
    return { start, end };
  }, [events]);

  const hasDistinctLinks = useMemo(() => hasDistinctTicketLinks(events), [events]);

  useEffect(() => {
    if (open) {
      setTicketsPerDay(hasDistinctLinks);
    }
  }, [open, hasDistinctLinks]);

  // Reseta tudo sempre que o modal abre pra um NOVO grupo de eventos (o
  // componente fica montado o tempo todo em EventsManager).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTitleTouched(false);
      setImageMode('existing');
      setSelectedImageUrl(seed?.image_url ?? null);
      setUploadedImageFile(null);
    }
    wasOpenRef.current = open;
  }, [open, seed]);

  // Sugere o nome com o título do primeiro evento marcado — só enquanto o
  // admin não tiver digitado nada (mesma proteção da R-024 original).
  useEffect(() => {
    if (open && seed && !titleTouched) {
      setMergedTitle(seed.title);
    }
  }, [open, seed, titleTouched]);

  const effectiveTicketsPerDay = ticketsPerDay ?? hasDistinctLinks;
  const effectiveTitle = (mergedTitle.trim() || seed?.title || '').trim();

  const handleMerge = async () => {
    if (!seed || !dateRange) return;

    if (events.some((e) => e.is_merge_shell || !!e.merged_into_id)) {
      toast({
        variant: 'destructive',
        title: 'Seleção inválida',
        description: 'Um dos eventos selecionados já faz parte de outra mesclagem.',
      });
      return;
    }

    setMerging(true);
    try {
      const allIds = events.map((e) => e.id);

      const { data: fullEvents, error: fetchErr } = await supabase
        .from('events')
        .select('*')
        .in('id', allIds);
      if (fetchErr) throw fetchErr;
      if (!fullEvents || fullEvents.length !== allIds.length) {
        throw new Error('Não foi possível carregar todos os eventos selecionados.');
      }

      let effectiveImageUrl = selectedImageUrl;
      if (imageMode === 'upload') {
        if (!uploadedImageFile) {
          throw new Error('Selecione uma imagem antes de continuar.');
        }
        logger.debug('[merge] fazendo upload da imagem do festival');
        const uploadedUrl = await uploadImageWithThumb(uploadedImageFile, 'event-images', {
          medium: true,
        });
        if (!uploadedUrl) throw new Error('Falha no upload da imagem do festival.');
        effectiveImageUrl = uploadedUrl;
      }

      const payload = buildMergeShellPayload(fullEvents as unknown as MergeableEventRow[], seed.id, {
        title: effectiveTitle,
        imageUrl: effectiveImageUrl,
        ticketsPerDay: effectiveTicketsPerDay,
      });

      logger.debug('[merge] criando card-vitrine', { title: payload.title });
      const { data: shell, error: insertErr } = await supabase
        .from('events')
        .insert([payload])
        .select()
        .single();
      if (insertErr) throw insertErr;

      logger.debug('[merge] escondendo eventos originais', { count: allIds.length });
      const { error: updateErr } = await supabase
        .from('events')
        .update({
          status: 'merged_inactive',
          merged_into_id: shell.id,
          merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', allIds);
      if (updateErr) throw updateErr;

      try {
        localStorage.removeItem('mdaccula-events-cache');
      } catch {
        // localStorage indisponível — segue sem quebrar
      }
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: 'Eventos mesclados!',
        description: `${events.length} eventos viraram 1 festival de ${formatEventDateRange(payload.date, payload.end_date)}.`,
      });

      try {
        await Promise.resolve(onSuccess());
      } catch (cbErr) {
        logger.warn('[merge] onSuccess callback falhou (não bloqueia merge):', cbErr);
      }
      setMerging(false);
      onOpenChange(false);
      setConfirming(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('[MergeEventsDialog] Erro ao mesclar:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao mesclar eventos',
        description: message || 'Tente novamente. Nenhuma alteração foi salva.',
      });
      setMerging(false);
    }
  };

  if (!events.length || !dateRange) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (merging) return;
        if (!o) setConfirming(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar {events.length} eventos em 1 festival</DialogTitle>
          <DialogDescription>
            Cria um evento novo cobrindo{' '}
            <strong>{formatEventDateRange(dateRange.start, dateRange.end)}</strong>. Os{' '}
            {events.length} eventos selecionados ficam escondidos (não deletados) — nenhum dado
            deles é alterado, e você pode desfazer quando quiser.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 space-y-1">
                <Label className="text-base">Eventos selecionados:</Label>
                {events.map((e) => (
                  <div key={e.id} className="text-sm text-muted-foreground">
                    {e.title} — {e.date}
                    {e.end_date && e.end_date !== e.date ? ` → ${e.end_date}` : ''}
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="merged-title" className="text-base">
                  Nome do festival (evento novo):
                </Label>
                <Input
                  id="merged-title"
                  value={mergedTitle}
                  onChange={(e) => {
                    setMergedTitle(e.target.value);
                    setTitleTouched(true);
                  }}
                  placeholder={seed?.title || 'Nome do festival'}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  Sugerido a partir do primeiro evento marcado — edite livremente.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imagem do festival:
                </Label>
                <Tabs
                  value={imageMode}
                  onValueChange={(v) => setImageMode(v as 'existing' | 'upload')}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Usar imagem de um dos eventos</TabsTrigger>
                    <TabsTrigger value="upload">Enviar nova imagem</TabsTrigger>
                  </TabsList>
                  <TabsContent value="existing" className="mt-2">
                    {events.some((e) => e.image_url) ? (
                      <div className="flex flex-wrap gap-2">
                        {events.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedImageUrl(e.image_url ?? null)}
                            title={e.title}
                            className={`rounded border-2 overflow-hidden transition-colors ${
                              selectedImageUrl === (e.image_url ?? null)
                                ? 'border-primary'
                                : 'border-transparent'
                            }`}
                          >
                            {e.image_url ? (
                              <img
                                src={e.image_url}
                                alt={e.title}
                                className="h-16 w-24 object-cover"
                              />
                            ) : (
                              <span className="flex h-16 w-24 items-center justify-center text-[10px] text-muted-foreground bg-muted px-1 text-center">
                                Sem imagem
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nenhum dos eventos selecionados tem imagem.
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2">
                    {uploadedImageFile ? (
                      <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                        <img
                          src={URL.createObjectURL(uploadedImageFile)}
                          alt="Preview"
                          className="h-16 w-24 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadedImageFile.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedImageFile(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <ImageUploadWithCrop
                        onImageSelect={setUploadedImageFile}
                        aspectRatio={16 / 9}
                        label=""
                        cropMode="optional"
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ação totalmente reversível — nenhum evento é alterado ou deletado, só escondido.
              </AlertDescription>
            </Alert>

            <div
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                hasDistinctLinks
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-input bg-muted/30'
              }`}
            >
              <Switch
                id="merge-tickets-per-day"
                checked={effectiveTicketsPerDay}
                onCheckedChange={(v) => setTicketsPerDay(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="merge-tickets-per-day" className="cursor-pointer">
                  Um link de venda por dia (festival)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, o botão "Comprar Ingresso" abre um{' '}
                  <strong>modal de seleção do dia</strong>, buscando o link de cada dia direto no
                  evento escondido correspondente (sempre atualizado). Quando desligado, o botão
                  vai direto pro link único (precisa ser o mesmo em todos os eventos).
                </p>
                {hasDistinctLinks && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Detectamos <strong>links de venda diferentes</strong> nos eventos selecionados
                    — recomendamos manter ligado.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Confirmação final.</strong> Vou:
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                  <li>
                    Criar o evento novo <strong>{effectiveTitle}</strong>, cobrindo{' '}
                    {formatEventDateRange(dateRange.start, dateRange.end)}.
                  </li>
                  <li>
                    Esconder os {events.length} eventos selecionados (continuam existindo,
                    intactos, reativáveis a qualquer momento).
                  </li>
                  <li>
                    Definir <strong>"Um link de venda por dia"</strong>:{' '}
                    {effectiveTicketsPerDay ? 'LIGADO (modal por dia)' : 'DESLIGADO (link único)'}.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={merging}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleMerge} disabled={merging}>
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mesclando...
                  </>
                ) : (
                  'Confirmar e mesclar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 2: Reescrever o teste adaptado (sem mais "escolher o principal")**

```tsx
// src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx
/**
 * Regressão R-024 (adaptada ao modelo não-destrutivo, 18/08/2026) — o nome
 * customizado digitado em "Nome do festival" não pode ser descartado por
 * nenhum outro estado do modal mudando (imagem, switch de ticket por dia).
 * No modelo antigo isso acontecia ao trocar qual evento era o "principal";
 * esse conceito não existe mais, mas a mesma classe de bug (efeito que
 * resincroniza um campo já editado manualmente) continua valendo a pena
 * proteger.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MergeEventsDialog } from '@/components/admin/MergeEventsDialog';

const eventA = {
  id: 'event-a',
  title: 'Evento A',
  slug: 'evento-a',
  date: '2026-12-28',
  end_date: null,
  venue: 'Venue A',
  image_url: null,
};

const eventB = {
  id: 'event-b',
  title: 'Evento B',
  slug: 'evento-b',
  date: '2026-12-29',
  end_date: null,
  venue: 'Venue B',
  image_url: null,
};

function renderDialog() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MergeEventsDialog
        open={true}
        onOpenChange={() => {}}
        events={[eventA, eventB]}
        onSuccess={() => {}}
      />
    </QueryClientProvider>
  );
}

describe('Regressão R-024 — MergeEventsDialog preserva nome customizado', () => {
  it('não sobrescreve o nome digitado quando o admin alterna a aba de imagem', () => {
    renderDialog();

    const titleInput = screen.getByLabelText(/nome do festival/i);
    fireEvent.change(titleInput, { target: { value: 'Nome Customizado' } });
    expect(titleInput).toHaveValue('Nome Customizado');

    fireEvent.click(screen.getByRole('tab', { name: /enviar nova imagem/i }));
    expect(titleInput).toHaveValue('Nome Customizado');
  });

  it('sugere o título do primeiro evento selecionado quando o campo ainda não foi editado', () => {
    renderDialog();
    const titleInput = screen.getByLabelText(/nome do festival/i);
    expect(titleInput).toHaveValue('Evento A');
  });

  it('não existe mais nenhum seletor de "evento principal"', () => {
    renderDialog();
    expect(screen.queryByText(/escolha o evento principal/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/MergeEventsDialog.tsx \
  src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx
git commit -m "feat(events): mesclagem passa a criar evento novo em vez de mutar o principal"
```

### Task 2.3: `TicketDayPickerModal` busca ao vivo nos eventos escondidos

**Files:**
- Modify: `src/components/events/TicketDayPickerModal.tsx`
- Create: `src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx`

**Interfaces:**
- Consumes: nenhuma nova — mesma assinatura de props do componente.
- Produces: nenhuma mudança de interface pública; só a fonte da consulta interna muda.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```tsx
// src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx
/**
 * Regressão — o seletor de dia de ingresso de um evento mesclado precisa ler
 * direto dos eventos escondidos (events.merged_into_id), NÃO de uma cópia em
 * custom_links. Isso garante que editar o link de venda de um dia depois da
 * mesclagem reflete na hora, sem nenhuma sincronização manual — ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { TicketDayPickerModal } from '@/components/events/TicketDayPickerModal';

describe('TicketDayPickerModal — busca os dias direto dos eventos escondidos', () => {
  it('consulta events filtrando por merged_into_id (não mais custom_links)', async () => {
    let queriedTable = '';
    let queriedColumn = '';
    let queriedValue = '';

    fromMock.mockImplementation((table: string) => {
      queriedTable = table;
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            queriedColumn = column;
            queriedValue = value;
            return Promise.resolve({
              data: [
                { title: 'Dia 1 — Artista A', date: '2026-12-28', ticket_link: 'https://exemplo.com/dia28' },
                { title: 'Dia 2 — Artista B', date: '2026-12-29', ticket_link: 'https://exemplo.com/dia29' },
              ],
              error: null,
            });
          },
        }),
      };
    });

    render(
      <TicketDayPickerModal
        open={true}
        onOpenChange={() => {}}
        eventId="shell-1"
        eventTitle="Festival Teste"
        schedule={[
          { date: '2026-12-28', time: '16:00', end_time: null, lineup: [] },
          { date: '2026-12-29', time: '16:00', end_time: null, lineup: [] },
        ]}
        fallbackTicketLink={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Dia 1 — Artista A/i })).toBeInTheDocument();
    });

    expect(queriedTable).toBe('events');
    expect(queriedColumn).toBe('merged_into_id');
    expect(queriedValue).toBe('shell-1');

    const link28 = screen.getByRole('link', { name: /Dia 1 — Artista A/i });
    expect(link28).toHaveAttribute('href', 'https://exemplo.com/dia28');
    const link29 = screen.getByRole('link', { name: /Dia 2 — Artista B/i });
    expect(link29).toHaveAttribute('href', 'https://exemplo.com/dia29');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx`
Expected: FAIL — a consulta atual usa `custom_links`/`event_id`, não `events`/`merged_into_id`.

- [ ] **Step 3: Trocar a fonte da consulta**

Editar `src/components/events/TicketDayPickerModal.tsx`: trocar o bloco do `useEffect` (linhas
48-92 do arquivo atual) por:

```tsx
  /**
   * Modal exibido quando um evento mesclado tem `tickets_per_day = true`.
   * Lista os dias do `schedule` cruzados com os eventos escondidos daquele
   * grupo (`events.merged_into_id = eventId`) — sempre ao vivo, nunca uma
   * cópia: editar o link de venda de um dia reflete aqui na hora seguinte.
   * Se não houver link pra um dia, mostra fallback (ticket_link do card) com aviso.
   */
  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from('events')
        .select('title, date, ticket_link')
        .eq('merged_into_id', eventId);

      if (cancelled) return;

      const scheduleDays = parseSchedule(schedule) || [];
      const linkByDate = new Map<string, { url: string; title?: string }>();
      (members || []).forEach((m) => {
        if (m.date && m.ticket_link) {
          linkByDate.set(m.date, { url: m.ticket_link, title: m.title });
        }
      });

      const built: DayOption[] = scheduleDays.map((d) => {
        const match = linkByDate.get(d.date);
        const label = parseLocalDate(d.date).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        });
        return {
          date: d.date,
          label,
          url: match?.url || fallbackTicketLink || '',
          linkTitle: match?.title,
        };
      });

      setDays(built);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId, schedule, fallbackTicketLink]);
```

Também atualizar o comentário de topo do componente (linhas 32-36 atuais) pra refletir a nova
fonte — já incluído no bloco acima.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx`
Expected: PASS.

- [ ] **Step 5: Suíte completa da fase**

Run: `npx tsc --noEmit && npm test && npm run test:coverage:ratchet`
Expected: tudo verde.

- [ ] **Step 6: Commit e push**

```bash
git add src/components/events/TicketDayPickerModal.tsx \
  src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx
git commit -m "feat(events): seletor de dia de ingresso busca ao vivo nos eventos escondidos"
git push
```

---

## Fase 3 — Desfazer e listar sem depender de `application_logs`

### Task 3.1: Reescrever `UndoMergeDialog.tsx`

**Files:**
- Modify: `src/components/admin/UndoMergeDialog.tsx` (reescrita completa)
- Create: `src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx`

**Interfaces:**
- Produces: nova prop pública `shell: MergeShellSummary | null` (substitui `log: MergeLog |
  null`); exporta `MergeShellSummary = { id: string; title: string }` — consumido pela Task 3.2 e
  3.3.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```tsx
// src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx
/**
 * Regressão — "Desfazer mesclagem" precisa funcionar em QUALQUER mesclagem,
 * de qualquer idade, sem depender de nenhum snapshot em application_logs
 * (foi a ausência desse snapshot que impediu o desfazer automático do merge
 * "Parador Reveillon", exigindo reversão manual via SQL em 17/08/2026).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { UndoMergeDialog } from '@/components/admin/UndoMergeDialog';

describe('UndoMergeDialog — desfaz lendo o grupo direto de events, sem application_logs', () => {
  it('lista os membros do grupo e nunca consulta application_logs', async () => {
    const calledTables: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calledTables.push(table);
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { id: 'm1', title: 'Dia 29', merged_at: '2026-08-01T00:00:00Z' },
                { id: 'm2', title: 'Dia 30', merged_at: '2026-08-01T00:00:00Z' },
              ],
              error: null,
            }),
        }),
      };
    });

    render(
      <UndoMergeDialog
        open={true}
        onOpenChange={() => {}}
        shell={{ id: 'shell-1', title: 'Festival Teste' }}
        onSuccess={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Dia 29, Dia 30/)).toBeInTheDocument();
    });

    expect(calledTables).not.toContain('application_logs');
  });

  it('ao confirmar, reativa os membros e inativa o card-vitrine', async () => {
    const updateCalls: { table: string; payload: unknown }[] = [];
    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ id: 'm1', title: 'Dia 29', merged_at: '2026-08-01T00:00:00Z' }],
            error: null,
          }),
      }),
      update: (payload: unknown) => ({
        eq: () => {
          updateCalls.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      }),
    }));

    render(
      <UndoMergeDialog
        open={true}
        onOpenChange={() => {}}
        shell={{ id: 'shell-1', title: 'Festival Teste' }}
        onSuccess={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar desfazer/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar desfazer/i }));

    await waitFor(() => {
      expect(updateCalls).toHaveLength(2);
    });
    expect(updateCalls[0].payload).toMatchObject({ status: 'active', merged_into_id: null });
    expect(updateCalls[1].payload).toMatchObject({ status: 'merged_inactive' });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx`
Expected: FAIL — o componente atual espera `log`, não `shell`, e lê `application_logs`.

- [ ] **Step 3: Reescrever o componente**

```tsx
// src/components/admin/UndoMergeDialog.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

export interface MergeShellSummary {
  id: string;
  title: string;
}

interface MergeMember {
  id: string;
  title: string;
  merged_at: string | null;
}

interface UndoMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shell: MergeShellSummary | null;
  onSuccess: () => void;
}

/**
 * Desfaz uma mesclagem lendo o grupo direto de `events`
 * (`merged_into_id = shell.id`) — sem nenhum snapshot/log envolvido. Como a
 * mesclagem nunca altera dado nenhum dos eventos escondidos, desfazer é
 * sempre seguro: reativa todos os membros e inativa o card-vitrine.
 */
export const UndoMergeDialog = ({ open, onOpenChange, shell, onSuccess }: UndoMergeDialogProps) => {
  const [working, setWorking] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<MergeMember[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !shell) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, merged_at')
        .eq('merged_into_id', shell.id);
      setMembers((data as MergeMember[]) || []);
      setLoadingMembers(false);
    })();
  }, [open, shell]);

  const handleUndo = async () => {
    if (!shell) return;
    setWorking(true);
    try {
      const { error: reactErr } = await supabase
        .from('events')
        .update({
          status: 'active',
          merged_into_id: null,
          merged_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('merged_into_id', shell.id);
      if (reactErr) throw reactErr;

      const { error: shellErr } = await supabase
        .from('events')
        .update({ status: 'merged_inactive', updated_at: new Date().toISOString() })
        .eq('id', shell.id);
      if (shellErr) throw shellErr;

      toast({
        title: 'Mesclagem desfeita!',
        description: `${members.length} evento(s) voltaram a ficar ativos, exatamente como estavam.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('[UndoMergeDialog] Erro ao desfazer:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer',
        description: message || 'Nada foi alterado. Tente novamente.',
      });
    } finally {
      setWorking(false);
    }
  };

  if (!shell) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" /> Desfazer mesclagem
          </DialogTitle>
          <DialogDescription>
            Vai desfazer <strong>{shell.title}</strong> por completo.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-2">
          <p>Vou:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Reativar {members.length} evento(s): {members.map((m) => m.title).join(', ') || '—'}.
              Nenhum deles teve qualquer dado alterado pela mesclagem — voltam exatamente como
              estavam.
            </li>
            <li>Deixar "{shell.title}" inativo (guardado, não aparece mais em nenhuma tela).</li>
          </ul>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Ação reversível a qualquer momento, sem limite de tempo.</AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleUndo}
            disabled={working || loadingMembers || members.length === 0}
          >
            {working ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Desfazendo...
              </>
            ) : (
              'Confirmar desfazer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UndoMergeDialog.tsx \
  src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx
git commit -m "feat(events): Desfazer mesclagem lê o grupo direto de events, sem log"
```

### Task 3.2: Reescrever `MergedEventsTab.tsx`

**Files:**
- Modify: `src/components/admin/MergedEventsTab.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `UndoMergeDialog`, `MergeShellSummary` (Task 3.1).
- Produces: mesma prop pública `onChange?: () => void` — nenhum consumidor externo muda.

- [ ] **Step 1: Reescrever o componente**

```tsx
// src/components/admin/MergedEventsTab.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Undo2, GitMerge, Loader2 } from 'lucide-react';
import { UndoMergeDialog, type MergeShellSummary } from '@/components/admin/UndoMergeDialog';
import { formatDateTimeBR } from '@/lib/formatters';

interface ShellRow {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
}

interface MemberRow {
  id: string;
  title: string;
  merged_into_id: string;
  merged_at: string | null;
}

interface MergeGroup {
  shell: ShellRow;
  memberCount: number;
  memberTitles: string[];
  latestMergedAt: string | null;
}

/**
 * Aba "Eventos Mesclados": fonte única de verdade = tabela `events`
 * (`is_merge_shell=true` pros cards, `merged_into_id` pros membros). Sem
 * nenhuma dependência de `application_logs` — funciona pra mesclagem de
 * qualquer idade.
 * Regra: só mostra grupos cujo card-vitrine ainda NÃO passou (end_date ??
 * date >= hoje).
 */
export const MergedEventsTab = ({ onChange }: { onChange?: () => void }) => {
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShell, setSelectedShell] = useState<MergeShellSummary | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data: shellRows } = await supabase
        .from('events')
        .select('id, title, date, end_date')
        .eq('is_merge_shell', true)
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(200);

      const shells = (shellRows || []) as ShellRow[];
      if (shells.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const shellIds = shells.map((s) => s.id);
      const { data: memberRows } = await supabase
        .from('events')
        .select('id, title, merged_into_id, merged_at')
        .in('merged_into_id', shellIds);

      const membersByShell = new Map<string, MemberRow[]>();
      ((memberRows || []) as MemberRow[]).forEach((m) => {
        const list = membersByShell.get(m.merged_into_id) || [];
        list.push(m);
        membersByShell.set(m.merged_into_id, list);
      });

      const groupsArr: MergeGroup[] = shells
        .map((shell) => {
          const members = membersByShell.get(shell.id) || [];
          const latestMergedAt = members.reduce<string | null>(
            (max, m) => (m.merged_at && (!max || m.merged_at > max) ? m.merged_at : max),
            null
          );
          return {
            shell,
            memberCount: members.length,
            memberTitles: members.map((m) => m.title),
            latestMergedAt,
          };
        })
        .filter((g) => g.memberCount > 0)
        .filter((g) => {
          const effectiveEnd =
            g.shell.end_date && g.shell.end_date >= g.shell.date ? g.shell.end_date : g.shell.date;
          return effectiveEnd >= todayStr;
        })
        .sort((a, b) => (b.latestMergedAt || '').localeCompare(a.latestMergedAt || ''));

      setGroups(groupsArr);
    } catch (err) {
      console.error('[MergedEventsTab] fetchGroups error:', err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <GitMerge className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">Nenhuma mesclagem ativa</h3>
          <p className="text-sm text-muted-foreground">
            Mesclagens cujos eventos ainda não ocorreram aparecem aqui e podem ser desfeitas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((g) => {
          const when = g.latestMergedAt ? formatDateTimeBR(g.latestMergedAt) : '—';
          return (
            <Card key={g.shell.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{g.shell.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.memberCount} evento(s) escondido(s) · Mesclado em {when}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    Escondidos: {g.memberTitles.join(', ')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedShell({ id: g.shell.id, title: g.shell.title })}
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Desfazer
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <UndoMergeDialog
        open={!!selectedShell}
        onOpenChange={(o) => !o && setSelectedShell(null)}
        shell={selectedShell}
        onSuccess={() => {
          setSelectedShell(null);
          fetchGroups();
          onChange?.();
        }}
      />
    </>
  );
};
```

- [ ] **Step 2: Confirmar que o guard de arquitetura já existente continua passando**

Run: `npx vitest run src/__tests__/architecture/merged-events-tab.test.ts`
Expected: PASS — o teste já exige `.from('events')` + `merged_into_id`, que continuam presentes
(agora como única fonte, o que só reforça a garantia original).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/MergedEventsTab.tsx
git commit -m "feat(events): aba Eventos Mesclados lê grupos direto de events (is_merge_shell)"
```

### Task 3.3: `useEventsManager.ts` e `EventsManager.tsx` — trocar log por shell

**Files:**
- Modify: `src/pages/admin/eventsManager/useEventsManager.ts`
- Modify: `src/pages/admin/EventsManager.tsx`

**Interfaces:**
- Consumes: `MergeShellSummary` de `@/components/admin/UndoMergeDialog` (Task 3.1).
- Produces: `useEventsManager()` agora retorna `lastMergeShell`/`fetchLastMergeShell` no lugar de
  `lastMergeLog`/`fetchLastMergeLog`.

- [ ] **Step 1: Editar `useEventsManager.ts`**

Trocar a linha de import:

```ts
import type { MergeLog } from '@/components/admin/UndoMergeDialog';
```

por:

```ts
import type { MergeShellSummary } from '@/components/admin/UndoMergeDialog';
```

Trocar o state:

```ts
const [lastMergeLog, setLastMergeLog] = useState<MergeLog | null>(null);
```

por:

```ts
const [lastMergeShell, setLastMergeShell] = useState<MergeShellSummary | null>(null);
```

Trocar toda a função `fetchLastMergeLog` (linhas 35-57 do arquivo atual) por:

```ts
  const fetchLastMergeShell = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title')
      .eq('is_merge_shell', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastMergeShell((data as MergeShellSummary | null) || null);
  }, []);
```

Trocar o `useEffect` de inicialização:

```ts
  useEffect(() => {
    fetchEvents();
    fetchLastMergeLog();
  }, [fetchEvents, fetchLastMergeLog]);
```

por:

```ts
  useEffect(() => {
    fetchEvents();
    fetchLastMergeShell();
  }, [fetchEvents, fetchLastMergeShell]);
```

E no `return` final do hook, trocar:

```ts
    lastMergeLog,
    showUndoDialog,
    setShowUndoDialog,
    showMerged,
    setShowMerged,
    mergedPrimaryTitles,
    fetchEvents,
    fetchLastMergeLog,
```

por:

```ts
    lastMergeShell,
    showUndoDialog,
    setShowUndoDialog,
    showMerged,
    setShowMerged,
    mergedPrimaryTitles,
    fetchEvents,
    fetchLastMergeShell,
```

- [ ] **Step 2: Editar `EventsManager.tsx`**

Trocar:

```tsx
                    {m.lastMergeLog && (
```

por:

```tsx
                    {m.lastMergeShell && (
```

Trocar o bloco do `UndoMergeDialog`:

```tsx
        <UndoMergeDialog
          open={m.showUndoDialog}
          onOpenChange={m.setShowUndoDialog}
          log={m.lastMergeLog}
          onSuccess={() => {
            m.setShowUndoDialog(false);
            m.fetchEvents();
            m.fetchLastMergeLog();
          }}
        />
```

por:

```tsx
        <UndoMergeDialog
          open={m.showUndoDialog}
          onOpenChange={m.setShowUndoDialog}
          shell={m.lastMergeShell}
          onSuccess={() => {
            m.setShowUndoDialog(false);
            m.fetchEvents();
            m.fetchLastMergeShell();
          }}
        />
```

Trocar o bloco do `MergedEventsTab`:

```tsx
              <TabsContent value="mesclados">
                <MergedEventsTab
                  onChange={() => {
                    m.fetchEvents();
                    m.fetchLastMergeLog();
                  }}
                />
              </TabsContent>
```

por:

```tsx
              <TabsContent value="mesclados">
                <MergedEventsTab
                  onChange={() => {
                    m.fetchEvents();
                    m.fetchLastMergeShell();
                  }}
                />
              </TabsContent>
```

- [ ] **Step 3: Verificação completa da fase**

Run: `npx tsc --noEmit && npm test && npm run test:coverage:ratchet`
Expected: tudo verde (o `tsc` pega qualquer referência esquecida a `lastMergeLog`/
`fetchLastMergeLog`).

- [ ] **Step 4: Commit e push**

```bash
git add src/pages/admin/eventsManager/useEventsManager.ts src/pages/admin/EventsManager.tsx
git commit -m "feat(events): EventsManager usa lastMergeShell em vez de log de application_logs"
git push
```

---

## Fase 4 — Trava contra mesclar um evento já mesclado (encadeamento)

### Task 4.1: Desabilitar seleção de card-vitrine / evento já escondido

**Files:**
- Modify: `src/pages/admin/eventsManager/types.ts`
- Modify: `src/pages/admin/eventsManager/EventCard.tsx`

**Interfaces:**
- Produces: `Event.is_merge_shell?: boolean` no tipo admin — consumido por `EventCard.tsx` e por
  qualquer tela futura que precise saber se um evento é um card-vitrine.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```tsx
// src/__tests__/regression/event-card-blocks-remerging-shell.test.tsx
/**
 * Regressão — um card-vitrine (is_merge_shell=true) ou um evento já
 * escondido por outra mesclagem (merged_into_id preenchido) não pode ser
 * selecionado de novo no modo "Mesclar", senão criaria mesclagens
 * encadeadas (A→B→C) que a aba "Eventos Mesclados" não sabe resolver.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/pages/admin/eventsManager/EventCard';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    title: 'Evento',
    subtitle: '',
    slug: 'evento',
    venue: 'Venue',
    address: '',
    date: '2026-12-28',
    end_date: null,
    time: '16:00',
    location_city: 'São Paulo',
    location_state: 'SP',
    genres: [],
    image_url: null,
    blog_post_id: null,
    description: '',
    lineup: [],
    ticket_link: '',
    vip_link: '',
    pix_button_enabled: false,
    views: 0,
    status: 'active',
    merged_into_id: null,
    merged_at: null,
    is_merge_shell: false,
    ...overrides,
  };
}

const noop = () => {};

describe('EventCard — trava contra re-mesclar', () => {
  it('não permite clicar pra selecionar um card-vitrine no modo mesclar', () => {
    const onToggleSelect = vi.fn();
    render(
      <EventCard
        event={baseEvent({ is_merge_shell: true })}
        mergeMode={true}
        selected={false}
        onToggleSelect={onToggleSelect}
        onEdit={noop}
        onDuplicate={noop}
        onGenerateArticle={noop}
        onReactivate={noop}
        onDelete={noop}
        generatingArticle={null}
        reactivatingId={null}
        mergedPrimaryTitles={{}}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('permite clicar normalmente num evento comum (não é shell, não está escondido)', () => {
    render(
      <EventCard
        event={baseEvent()}
        mergeMode={true}
        selected={false}
        onToggleSelect={noop}
        onEdit={noop}
        onDuplicate={noop}
        onGenerateArticle={noop}
        onReactivate={noop}
        onDelete={noop}
        generatingArticle={null}
        reactivatingId={null}
        mergedPrimaryTitles={{}}
      />
    );

    expect(screen.getByRole('checkbox')).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/__tests__/regression/event-card-blocks-remerging-shell.test.tsx`
Expected: FAIL — o checkbox hoje nunca fica `disabled`.

- [ ] **Step 3: Adicionar o campo ao tipo admin**

Em `src/pages/admin/eventsManager/types.ts`, adicionar ao `interface Event` (logo depois de
`merged_at?: string | null;`):

```ts
  is_merge_shell?: boolean;
```

- [ ] **Step 4: Aplicar a trava em `EventCard.tsx`**

Trocar o topo do componente:

```tsx
export function EventCard({
  event,
  mergeMode,
  selected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onGenerateArticle,
  onReactivate,
  onDelete,
  generatingArticle,
  reactivatingId,
  mergedPrimaryTitles,
}: Props) {
  return (
    <Card
      className={`overflow-hidden relative transition ${mergeMode && selected ? 'ring-2 ring-primary' : ''}`}
      onClick={mergeMode ? () => onToggleSelect(event.id) : undefined}
      style={mergeMode ? { cursor: 'pointer' } : undefined}
    >
      {mergeMode && (
        <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
          <Checkbox checked={selected} />
        </div>
      )}
```

por:

```tsx
export function EventCard({
  event,
  mergeMode,
  selected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onGenerateArticle,
  onReactivate,
  onDelete,
  generatingArticle,
  reactivatingId,
  mergedPrimaryTitles,
}: Props) {
  const isMergeable = event.status === 'active' && !event.is_merge_shell;

  return (
    <Card
      className={`overflow-hidden relative transition ${mergeMode && selected ? 'ring-2 ring-primary' : ''} ${mergeMode && !isMergeable ? 'opacity-50' : ''}`}
      onClick={mergeMode && isMergeable ? () => onToggleSelect(event.id) : undefined}
      style={mergeMode && isMergeable ? { cursor: 'pointer' } : undefined}
    >
      {mergeMode && (
        <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
          <Checkbox checked={selected} disabled={!isMergeable} />
        </div>
      )}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/__tests__/regression/event-card-blocks-remerging-shell.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 6: Verificação completa e commit**

Run: `npx tsc --noEmit && npm test && npm run test:coverage:ratchet`
Expected: tudo verde.

```bash
git add src/pages/admin/eventsManager/types.ts src/pages/admin/eventsManager/EventCard.tsx \
  src/__tests__/regression/event-card-blocks-remerging-shell.test.tsx
git commit -m "fix(events): trava seleção de card-vitrine/evento já mesclado no modo Mesclar"
git push
```

---

## Fase 5 — Documentação e faxina final

### Task 5.1: Teste de guarda — `/links` nunca é afetado pela mesclagem

**Files:**
- Create: `src/__tests__/regression/links-query-not-filtered-by-merge-status.test.ts`

- [ ] **Step 1: Escrever e rodar o teste**

```ts
// src/__tests__/regression/links-query-not-filtered-by-merge-status.test.ts
/**
 * Regressão — a mesclagem de eventos (status='merged_inactive'/
 * is_merge_shell) NUNCA deve vazar pra consulta pública de /links. Decisão
 * de design (confirmada pelo usuário em 17/08/2026): /links continua
 * mostrando cada evento normalmente, mesclado ou não — ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md,
 * decisão #8.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('useLinks — consulta pública não filtra por status/is_merge_shell', () => {
  it('a query de link_groups/custom_links não referencia status nem is_merge_shell', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLinks.ts'), 'utf-8');
    expect(src).not.toMatch(/is_merge_shell/);
    expect(src.split('fetchLinksData')[1]).not.toMatch(/\.eq\(\s*['"]status['"]/);
  });
});
```

Run: `npx vitest run src/__tests__/regression/links-query-not-filtered-by-merge-status.test.ts`
Expected: PASS (o arquivo atual já satisfaz isso — este teste só existe pra travar contra uma
mudança futura acidental).

- [ ] **Step 2: Commit**

```bash
git add src/__tests__/regression/links-query-not-filtered-by-merge-status.test.ts
git commit -m "test(links): trava /links contra filtro acidental por status de mesclagem"
```

### Task 5.2: Atualizar documentação do projeto

**Files:**
- Modify: `docs/TESTING.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Nova entrada em `docs/TESTING.md` → "Regressões cobertas"**

Adicionar, logo antes de `## Checklist antes de mergear`:

```markdown
### R-075 — Mesclagem de eventos redesenhada pra nunca mutar os originais (elimina a causa raiz de R-024/R-060/R-073)
- **Quando:** 18/08/2026, a pedido do usuário, depois da auditoria de 17/08/2026 (revert manual
  do merge "Parador Reveillon" + R-073/R-074).
- **Causa:** o modelo antigo de mesclagem elegia um evento "principal" e **mutava** seus campos
  (título/data/schedule/views/imagem) pra virar o festival guarda-chuva, dependendo de um
  snapshot em `application_logs` pra "Desfazer" funcionar. Mesclagens sem esse snapshot (feitas
  antes da proteção existir, ou com mais de 90 dias) ficavam sem forma de desfazer automática —
  foi exatamente isso que aconteceu com o merge "Parador Reveillon" (22/07/2026), revertido na
  mão via SQL. R-024, R-060 e R-073 são todas proteções em cima desse modelo frágil.
- **Correção:** mesclar agora **cria um evento novo** (`is_merge_shell=true`) com o nome/imagem
  escolhidos e `schedule`/`views` agregados; os eventos selecionados nunca são alterados — só
  ganham `status='merged_inactive'`/`merged_into_id` (colunas já existentes). Desfazer (total ou
  parcial) vira só reativar os membros do grupo, sempre possível, sem log nenhum envolvido. O
  cálculo do card-vitrine foi extraído pra uma função pura (`src/lib/eventMergeHelper.ts`),
  testável sem mockar Supabase. O seletor de dia de ingresso (`TicketDayPickerModal`) passou a
  ler ao vivo dos eventos escondidos em vez de uma cópia em `custom_links`.
- **Nota sobre as proteções antigas:** R-024 e R-073 continuam registradas aqui (nunca se apaga
  histórico de regressão), mas os testes que as protegiam foram adaptados/substituídos porque o
  cenário exato ("trocar o evento principal", "evento mesclado com múltiplos custom_links")
  deixou de poder acontecer por construção no modelo novo. R-060 (retenção de 90 dias de logs de
  merge) continua tecnicamente válida e inofensiva, só deixou de ser necessária — não foi
  revertida.
- **Design:** `docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md`.
- **Proteção:** `src/__tests__/lib/eventMergeHelper.test.ts`,
  `src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx`,
  `src/__tests__/regression/ticket-day-picker-reads-live-members.test.tsx`,
  `src/__tests__/regression/undo-merge-dialog-reads-group-live.test.tsx`,
  `src/__tests__/regression/event-card-blocks-remerging-shell.test.tsx`,
  `src/__tests__/regression/merge-shell-column-and-nostalgia-migration.test.ts`,
  `src/__tests__/regression/links-query-not-filtered-by-merge-status.test.ts`.
```

- [ ] **Step 2: Nova entrada em `docs/CHANGELOG.md`**

Adicionar no topo de "Entradas Detalhadas" e uma linha na tabela do mês:

```markdown
### Mesclagem de eventos redesenhada: nunca mais muta os eventos originais (R-075)
**Descrição:** depois da auditoria de 17/08/2026 (revert manual do merge "Parador Reveillon" por
falta de snapshot), a mesclagem de eventos foi reescrita do zero: mesclar agora cria 1 evento
novo ("card-vitrine") em vez de mutar um dos eventos selecionados. Os eventos escondidos nunca
têm nenhum dado próprio alterado — só ficam marcados como inativos, apontando pro card novo.
Desfazer (total ou parcial) passou a funcionar sempre, em qualquer mesclagem, sem depender de
nenhum log de auditoria — elimina pela raiz a classe de bug que já tinha exigido correção manual
duas vezes (R-024, R-073).
**Também corrigido:** o botão "Comprar Ingresso" de um festival mesclado agora busca o link de
cada dia ao vivo, direto dos eventos escondidos — editar o line-up/link de um dia depois da
mesclagem reflete na hora, sem re-mesclar nada. `/links` continua inteiramente fora dessa
feature, sem nenhuma mudança de comportamento.
**Verificação:** `npx tsc --noEmit`, `npm test`, `npm run test:coverage:ratchet` verdes em cada
uma das 5 fases; conversão do merge "Nostalgia" pro modelo novo conferida direto no banco.
**Data:** 18/08/2026
**Responsável:** IA, a pedido do usuário — desenhado com `superpowers:brainstorming`
(clarificação em 2 rodadas de perguntas + 10 exemplos práticos aprovados antes de codar) e
implementado fase a fase com `superpowers:writing-plans`/`executing-plans`.

**Arquivos alterados:** `supabase/migrations/20260818140000_add_is_merge_shell_to_events.sql`,
`src/lib/eventMergeHelper.ts`, `src/components/admin/MergeEventsDialog.tsx`,
`src/components/admin/UndoMergeDialog.tsx`, `src/components/admin/MergedEventsTab.tsx`,
`src/components/events/TicketDayPickerModal.tsx`,
`src/pages/admin/eventsManager/useEventsManager.ts`, `src/pages/admin/EventsManager.tsx`,
`src/pages/admin/eventsManager/EventCard.tsx`, `src/pages/admin/eventsManager/types.ts`,
`docs/tabelas.md`, `docs/DATABASE_SCHEMA.md`, `docs/TESTING.md`.
```

Atualizar também `**Última atualização:**` no topo do arquivo pra `18/08/2026`, e adicionar a
linha correspondente na tabela "Índice Rápido por Mês".

- [ ] **Step 3: Auditar `docs/PENDENCIAS.md`**

Ler o arquivo e confirmar que nenhum item existente menciona a mesclagem antiga/snapshot de
`application_logs` (nenhum item foi registrado lá sobre isso até 18/08/2026) — se algum item for
encontrado tocando nesse assunto, removê-lo e mover o que for relevante pro CHANGELOG.

- [ ] **Step 4: Commit e push**

```bash
git add docs/TESTING.md docs/CHANGELOG.md
git commit -m "docs: registra o redesenho não-destrutivo da mesclagem de eventos (R-075)"
git push
```

### Task 5.3: Verificação final de ponta a ponta

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1: Suíte completa**

Run: `npx tsc --noEmit && npm test && npm run test:coverage:ratchet`
Expected: tudo verde.

- [ ] **Step 2: Verificação manual no localhost**

Subir `npm run dev`, logar como admin, em `/admin/eventos`:
1. Ativar "Mesclar Eventos", selecionar 2 eventos de teste reais (não usar dados de produção
   sensíveis), confirmar que o card-vitrine novo aparece em `/eventos` com o nome/imagem
   escolhidos, e que os 2 originais somem da lista principal mas continuam intactos com "Mostrar
   mesclados (inativos)" ligado.
2. Abrir a página pública do card-vitrine, clicar "Comprar Ingresso", confirmar que o modal
   "Escolha o dia" mostra os 2 dias corretos.
3. Visitar `/links` e confirmar que os 2 eventos originais continuam aparecendo lá normalmente,
   sem nenhuma mudança.
4. Clicar "Desfazer mesclagem" (topo ou aba "Eventos Mesclados") e confirmar que os 2 eventos
   voltam pra lista principal, intactos.
5. Tentar selecionar um evento já mesclado (com "Mostrar mesclados" ligado) ou um card-vitrine no
   modo "Mesclar" — confirmar que o checkbox aparece desabilitado.

- [ ] **Step 3: Limpar os eventos de teste criados no passo anterior**

Se algum evento de teste real foi criado no banco pra validação manual, apagar via admin
(`Deletar`) pra não poluir produção.

- [ ] **Step 4: Push final (se sobrou algo sem commitar)**

```bash
git status
```

Se houver mudanças pendentes, commitar e dar `git push` antes de encerrar.
