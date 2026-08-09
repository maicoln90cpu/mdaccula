/**
 * Regressão CRÍTICA — loop infinito de requisições a site_settings na rota
 * de Gestão de E-mails, encontrado na conferência via Chrome pós-Fase 17
 * (284 requisições em poucos segundos, várias retornando 503).
 *
 * Causa raiz: a Fase 7 (email-automation-cards-sync-state) introduziu
 * `hydrate`/`markSaved` (useConfigWithDirtyTracking, em useEmailAutomation.ts)
 * e `hydrateCfg` (useEventReminderAutomation.ts) como funções PLAIN, não
 * memoizadas. Essas funções são repassadas como `automation.setWeeklyCfg`
 * / `automation.setEventReminderCfg` para dentro da dependency array do
 * `loadAll` (useCallback) em useEmailConfigState.ts. Sem memoização, uma
 * nova identidade a cada render recriava `loadAll`, o que reexecutava o
 * `useEffect(() => { void loadAll() }, [loadAll])` — loop infinito:
 * loadAll → setState → re-render → nova identidade de hydrate → novo
 * loadAll → useEffect dispara de novo → ...
 *
 * Este teste é estático (sem render): garante que as funções continuam
 * envolvidas em useCallback, então não voltam a ter identidade instável a
 * cada render.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — hydrate/markSaved/hydrateCfg têm identidade estável entre renders', () => {
  it('useConfigWithDirtyTracking (useEmailAutomation.ts) envolve hydrate e markSaved em useCallback', () => {
    const src = read('src/components/admin/emailConfig/useEmailAutomation.ts');
    const fnBlock = src.slice(
      src.indexOf('function useConfigWithDirtyTracking'),
      src.indexOf('export const DAY_LABELS')
    );
    expect(
      fnBlock,
      'hydrate voltou a ser uma função plain (sem useCallback) — isso REINTRODUZ o loop ' +
        'infinito de requisições a site_settings: hydrate vira automation.setWeeklyCfg, que está ' +
        'na dependency array do loadAll em useEmailConfigState.ts.'
    ).toMatch(/const hydrate = useCallback\(/);
    expect(fnBlock).toMatch(/const markSaved = useCallback\(/);
  });

  it('useEventReminderAutomation.ts envolve hydrateCfg em useCallback', () => {
    const src = read('src/components/admin/emailConfig/useEventReminderAutomation.ts');
    expect(
      src,
      'hydrateCfg voltou a ser uma função plain (sem useCallback) — mesmo bug do loop infinito, ' +
        'agora via automation.setEventReminderCfg.'
    ).toMatch(/const hydrateCfg = useCallback\(/);
  });
});
