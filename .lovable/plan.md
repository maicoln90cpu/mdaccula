

## Auditoria: Por que o Cached Egress do Supabase está alto (8.45 GB)

### Correções Aplicadas

**A. Requests redundantes eliminados**
- `SiteSettingsContext.tsx`: removido background refresh manual — React Query gerencia sozinho
- `GoogleTagManager.tsx`: agora lê do `useSiteSettings()` em vez de fazer query própria
- Resultado: **-2 requests por pageview**

**B. Cache endurecido nas queries públicas**
- `FeaturedEvents.tsx`, `LatestNews.tsx`, `useEvents.ts`: `staleTime: 5min`, `refetchOnWindowFocus: false`
- Service Worker v8: Cache First com TTL para APIs REST

**C. Redirecionamentos corrigidos**
- `Redirect.tsx`: normaliza URLs sem protocolo (`https://` automático)
- `RedirectsManager.tsx`: normaliza ao salvar
- Migração SQL: corrigiu registros existentes com `→` e sem protocolo

### Distribuição Estimada do Egress (pós-correção)

| Fonte | Antes | Depois |
|-------|-------|--------|
| API REST (stale-while-revalidate) | ~2-3 GB | ~0.3-0.5 GB |
| GTM query duplicada | ~0.2 GB | 0 |
| Background refresh settings | ~0.3 GB | 0 |
| Refetch on focus | ~0.5 GB | 0 |
