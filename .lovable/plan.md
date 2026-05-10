## Plano

### 1) Crons de limpeza

Criar 3 jobs novos via `pg_cron` + `pg_net` (insert tool, não migração — usa anon key):

- `cleanup-egress-weekly` — todo domingo 03:30 UTC → `SELECT public.cleanup_old_egress();` (já é função SQL local, sem HTTP).
- `cleanup-storage-weekly` — todo domingo 04:00 UTC → `POST /functions/v1/cleanup-storage`.
- `cleanup-sync-logs-weekly` — todo domingo 04:15 UTC → `POST /functions/v1/cleanup-sync-logs`.

### 2) Refator do `eventDateHelper.ts`

Nova regra única para **todos** os eventos (admin, links, listagem pública):

- Entrada mínima obrigatória: `date` + `time` (início).
- `end_time` deixa de ser usado no cálculo de visibilidade (ainda é exibido na UI, mas não influencia ativo/inativo).
- Cálculo:
  - Se há `time`: `inativo` quando `agora >= inicio + defaultActiveHours` (default 12h, configurável).
  - Se **não** há `time`: `inativo` quando `agora >= dataDoEvento 00:00 + 24h` (configurável).
- Tolerância (`graceHours`) some — substituída pelos dois novos parâmetros.
- `timezoneOffset` passa a ser **realmente aplicado**: comparação feita convertendo `now` para o offset configurado em `site_settings.timezone_offset` (já existe a setting no Settings.tsx). O "agora" é calculado em UTC + offset, e o `eventStart` é montado como hora local naquele offset.

API nova:
```ts
isEventActive(event: { date; time? }, settings: {
  timezoneOffset: number;       // ex.: -3
  hoursAfterStart: number;      // default 12
  hoursWithoutTime: number;     // default 24
}): boolean
```

Manter wrappers `isEventVisible` / `filterVisibleEvents` para não quebrar imports.

### 3) Configuração no admin

Novas chaves em `site_settings`:
- `event_hours_after_start` (default `12`)
- `event_hours_without_time` (default `24`)

Remover/aposentar `event_grace_hours` da UI (manter no banco por compatibilidade, mas sem efeito).

UI: editar `src/components/admin/settings/TimezoneSettings.tsx` substituindo o campo "Horas de Tolerância" por dois inputs:
- "Horas até inativar (com horário definido)" — 1-72, default 12
- "Horas até inativar (sem horário definido)" — 1-72, default 24

Atualizar `src/pages/admin/Settings.tsx` (load + save), `SiteSettingsContext.tsx` (tipos) e os 4 consumidores (`useEvents`, `useLinks`, `Links.tsx`, `LinksManager.tsx`) para passar as duas novas configs em vez de `graceHours`.

### Detalhes técnicos

- Crons criados via insert tool (contém anon key, não pode virar migração compartilhada).
- Helper passa a aceitar `time?: string | null`; quando ausente, usa midnight + `hoursWithoutTime`.
- Conversão de timezone: construir `eventStart` como `Date.UTC(y, m, d, hh, mm) - offset*3600_000` e comparar com `Date.now()` direto (ambos em ms UTC).
- Atualizar testes em `src/__tests__/lib/eventDateHelper.test.ts` para nova assinatura.

### Pendências assumidas

- Não vou tocar em `event_grace_hours` no banco (chave fica órfã para não quebrar histórico).
- `end_time` continua sendo salvo e exibido, só deixa de afetar visibilidade.

Confirma para eu implementar?
