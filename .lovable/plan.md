## Resposta às 4 perguntas + plano de execução

### 4) Por que parece que "nada é salvo no Bunny automaticamente"?
**Está sendo salvo — você só olhou na pasta errada.** Verifiquei o banco (`image_hashes`):

```
último upload Bunny: 2026-05-10 16:23  → event-images/1778430190595-dac89dcd.webp
2026-05-05 16:04 → event-images/1777997097210-3825d4f2.webp
2026-05-04 23:36 → event-images/1777937804860-8c3dd9b3.webp
... (vários em abril/maio)
```

O que aconteceu:
- **`link-thumbnails/`** (a pasta que você abriu no print) recebeu o **bulk da migração em 16/03** e não teve uploads novos depois — porque você não criou/editou custom links com thumbnail nova nesse período. Faz sentido todos terem a mesma data.
- **`event-images/`** está recebendo upload novo a cada evento criado, post de blog gerado por IA, ou imagem regenerada. Se abrir essa pasta no Bunny e ordenar por "Date Modified" desc, vai ver os arquivos recentes.
- **`team-images/`** mesma lógica — só recebe quando você edita/adiciona membro.

Fluxo confirmado no código (todos passam pelo Bunny):
```text
EventForm / BlogForm / TeamManager / CustomLinkForm / LinksPageSettings
   → uploadImageToBunny() → edge upload-to-bunny → PUT storage.bunnycdn.com/mdaccula/<bucket>/<file>
                                                 → backup paralelo no Supabase Storage
generate-blog-post-v2 / generate-multi-event-article / regenerate-blog-image
   → PUT direto no Bunny mdaccula/event-images/
```

Não tem upload "perdido" indo direto pro Supabase fora do Bunny. **Nada para corrigir aqui.**

### 3) Bunny não tem filtro de data → ajuste UI
A aba Bunny no `/admin/egress-monitor` hoje pede `?days=7`. A API `/statistics` aceita `dateFrom/dateTo`, mas você quer "desde sempre". Vou:
- Trocar o seletor de "7/14/30 dias" por "Total acumulado (lifetime)" + opcional "Últimos N dias".
- Para "lifetime" mando `dateFrom=` bem antigo (ex.: 2020-01-01). Bunny devolve agregados desde a criação da pull zone.
- Storage continua sendo snapshot atual (não é série temporal).

### 2) Comparação com seus prints (validação)
Comparando o que a edge devolve hoje vs prints:

| Métrica | Print Supabase | Vai mostrar (Supabase tab) | Status |
|---|---|---|---|
| Database Size | 0,043 / 0,5 GB | via `tableCounts` (não em GB) | ⚠️ não mostra GB do DB — vou adicionar |
| Egress total | 0,22 GB (período) | hoje só temos requests por serviço | ⚠️ Free não expõe egress real — fica só no Bunny |
| Cached Egress | 0,26 GB | n/a | idem |
| Storage Size | <1 GB | sim, em bytes por bucket | ✅ |
| Auth users | 0 / 50k MAU | sim (`totalUsers`) | ✅ |
| Edge Func Invocations | 4.734 / 500k | hoje só rest/auth/storage/realtime | ⚠️ falta série de edge functions |

| Métrica | Print Bunny | Vai mostrar (Bunny tab) | Status |
|---|---|---|---|
| Pull zone traffic | 60.82 GB lifetime | `bandwidthBytes` com `dateFrom=2020` | ✅ depois do ajuste do item 3 |
| Cost | $2.61 lifetime | calcular no client (bytes × $/GB) | adicionar |
| Storage size | 169.95 MB / 321 files | `storageInfo.StorageUsed/FilesStored` | ✅ já existe |

**Validação manual** depois do deploy: abrir `/admin/egress-monitor`, conferir bandwidth Bunny ≈ 60.82 GB e storage ≈ 169.95 MB / 321 arquivos. Se bater até ±5% está ótimo.

### 1) Cron diário de snapshots
Para ter histórico além de 7d (limite Management API):

```text
[ pg_cron 06:00 UTC diário ]
        ↓
[ edge metrics-snapshot (verify_jwt=false, x-cron-secret) ]
        ↓
   - chama supabase-usage internamente (interval=1day)
   - chama bunny-stats internamente (days=1)
        ↓
[ tabela metrics_snapshots ]
   day date PK, supabase jsonb, bunny jsonb, captured_at timestamptz
        ↓
[ UI: nova aba "Histórico" com AreaChart 30/90/365d ]
```

---

## Plano técnico

### Migration
```sql
CREATE TABLE public.metrics_snapshots (
  day date PRIMARY KEY,
  supabase jsonb NOT NULL DEFAULT '{}'::jsonb,
  bunny jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin select" ON public.metrics_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
-- service_role bypassa RLS

-- pg_cron job (06:00 UTC = 03:00 BRT)
SELECT cron.schedule(
  'daily-metrics-snapshot','0 6 * * *',
  $$ SELECT net.http_post(
       url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/metrics-snapshot',
       headers:=jsonb_build_object('content-type','application/json','x-cron-secret', current_setting('app.cron_secret', true)),
       body:='{}'::jsonb) $$);
```
Secret nova: `CRON_SHARED_SECRET` (gero e adiciono).

### Edge functions
- **nova `metrics-snapshot/index.ts`** (`verify_jwt=false` em config.toml): valida `x-cron-secret`, busca dados de Supabase + Bunny via service-role/AccessKey, faz `upsert` em `metrics_snapshots` com `day = current_date - 1`.
- **`supabase-usage`**: adicionar query DB size (`pg_database_size('postgres')`) e contagem de invocations de edge functions (Management API `analytics/endpoints/usage.func-invocations` se disponível, senão deixar n/a).
- **`bunny-stats`**: aceitar `mode=lifetime` → `dateFrom=2020-01-01`. Adicionar campo `estimatedCostUSD` (bandwidth_GB × tier).

### UI `/admin/egress-monitor`
- Aba **Bunny CDN**: substituir slider de dias por toggle `[ Lifetime | 7d | 30d ]`. Card "Custo estimado USD".
- Aba **Supabase**: novo card "Database Size GB", novo card "Edge Functions invocations".
- Nova aba **Histórico (snapshots)**: AreaChart com bandwidth Bunny + requests Supabase ao longo dos últimos 30/90/365 dias, lendo `metrics_snapshots` direto via supabase-js (RLS admin).

### Pendências/limitações
- Edge function `metrics-snapshot` precisa de uma execução manual no primeiro dia (botão "Capturar agora" na aba Histórico) para popular o gráfico antes do cron rodar.
- Egress real Supabase (0,22 GB do print) **não é exposto na Free** sem Prometheus — só vai aparecer se fizer upgrade pra Pro. Mantemos a coluna vazia com tooltip explicando.
- Custo Bunny estimado depende do tier (Standard $0.01–0.06/GB conforme região); vou usar média $0.043/GB (alinhado com seu $2.61 / 60.82 GB ≈ $0.043).

### Prevenção de regressão
- Index único em `metrics_snapshots(day)` evita duplicar snapshot.
- Edge `metrics-snapshot` retorna 200 mesmo se uma das fontes falhar (grava parcial), pra não quebrar a série.
- Botão manual + log em `application_logs` cada execução do cron.

Aprove para eu executar: migration → secret → edge `metrics-snapshot` → ajustes em `supabase-usage` e `bunny-stats` → UI.
