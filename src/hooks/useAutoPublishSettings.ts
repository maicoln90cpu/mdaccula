import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Chaves de `site_settings` que controlam, por tipo de geração, se um artigo
 * nasce publicado na hora ou como rascunho pra revisão. Todas defaultam pra
 * "false" (rascunho) no banco — ver migração `content_generation_publish_settings`.
 */
export type AutoPublishKey =
  | 'auto_publish_generate_tab'
  | 'auto_publish_suggestions_topic'
  | 'auto_publish_suggestions_template'
  | 'auto_publish_topic_search'
  | 'auto_publish_auto_cron'
  | 'auto_publish_multi_event'
  | 'auto_publish_single_event'
  | 'event_watcher_auto_publish';

export type AutoPublishMap = Partial<Record<AutoPublishKey, boolean>>;

/**
 * Busca (e opcionalmente atualiza) um subconjunto das chaves de publicação
 * por tipo de geração. Passe só as chaves que a tela em questão precisa —
 * ex.: a aba "Gerar" só precisa de `auto_publish_generate_tab`, já o painel
 * de controle em "Automático" pede as 8.
 */
export function useAutoPublishSettings(keys: AutoPublishKey[]) {
  const [settings, setSettings] = useState<AutoPublishMap>({});
  const [loading, setLoading] = useState(true);
  const keysKey = keys.join(',');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', keysKey.split(',').filter(Boolean));
      if (error) throw error;

      const next: AutoPublishMap = {};
      for (const row of data || []) {
        next[row.key as AutoPublishKey] = row.value === 'true';
      }
      setSettings(next);
    } catch (error) {
      logger.error('[useAutoPublishSettings] Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  }, [keysKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSetting = useCallback(async (key: AutoPublishKey, value: boolean) => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' });
    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, loading, refresh, updateSetting };
}
