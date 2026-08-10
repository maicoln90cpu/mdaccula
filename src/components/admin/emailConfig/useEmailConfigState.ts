import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { getEdgeFunctionErrorMessage, createLoadGuard } from '@/lib';
import type { useToast } from '@/hooks/useToast';
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '@/lib/emailTemplates/eventAnnouncement';
import type { Template, ArticleSummary } from '@/lib/emailTemplates/blocks';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';
import type {
  Mode,
  EgoiConfig,
  ListItem,
  SenderItem,
  SegmentItem,
} from './types';
import { parseRunHistory, type RunHistoryEntry } from './automationRunHistory';

type ToastFn = ReturnType<typeof useToast>['toast'];

type AutomationSetters = {
  setWeeklyCfg: (v: {
    enabled: boolean;
    day: number;
    hour: number;
    templateId: string;
    sendOnCron: boolean;
  }) => void;
  setWeekendCfg: (v: {
    enabled: boolean;
    day: number;
    hour: number;
    templateId: string;
    sendOnCron: boolean;
  }) => void;
  setBlogCfg: (v: {
    enabled: boolean;
    day: number;
    hour: number;
    templateId: string;
    sendOnCron: boolean;
  }) => void;
  setDigestLastResult: (v: unknown) => void;
  setWeekendLastResult: (v: unknown) => void;
  setBlogLastResult: (v: unknown) => void;
  setEventReminderCfg: (v: {
    enabled: boolean;
    daysBefore: number;
    hour: number;
    templateId: string;
    sendOnCron: boolean;
  }) => void;
  setDigestRunHistory: (v: RunHistoryEntry[]) => void;
  setWeekendRunHistory: (v: RunHistoryEntry[]) => void;
  setBlogRunHistory: (v: RunHistoryEntry[]) => void;
  setEventReminderRunHistory: (v: RunHistoryEntry[]) => void;
};

/**
 * Camada de dados do EmailConfig — encapsula loadAll + CRUD do config +
 * upload de logo + fetch de listas/segmentos + estado de templates.
 * Extraído da página em Onda 9 PR-A (mudança apenas estrutural).
 */
export function useEmailConfigState({
  toast,
  automation,
  templates,
  setTemplates,
  setActiveTemplateId,
}: {
  toast: ToastFn;
  automation: AutomationSetters;
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  setActiveTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [cfg, setCfg] = useState<EgoiConfig>({
    list_id: null,
    sender_id: null,
    segment_id: null,
    mode: 'draft',
    is_enabled: false,
    scheduled_days_before: 3,
  });
  const [lists, setLists] = useState<ListItem[]>([]);
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [listTotal, setListTotal] = useState<number | null>(null);
  const [fetchingResources, setFetchingResources] = useState(false);
  const [fetchingSegments, setFetchingSegments] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [tpl, setTpl] = useState<EmailTemplateSettings & { id?: string }>({});
  const [tplSaving, setTplSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [realEvents, setRealEvents] = useState<
    Array<EmailEventRow & { blog_post_id: string | null }>
  >([]);


  const {
    setWeeklyCfg,
    setWeekendCfg,
    setBlogCfg,
    setDigestLastResult,
    setWeekendLastResult,
    setBlogLastResult,
    setEventReminderCfg,
    setDigestRunHistory,
    setWeekendRunHistory,
    setBlogRunHistory,
    setEventReminderRunHistory,
  } = automation;

  // Trava contra loop infinito (ver R-013/incidente de 09/08/2026): se algo
  // fizer loadAll disparar repetidamente em vez de uma vez por mount, aborta
  // cedo em vez de martelar egress real — páginas /admin bypassam o cache do
  // service worker por design (REGRA 2), então cada chamada aqui é rede de
  // verdade nas 6 tabelas abaixo.
  const loadGuard = useMemo(() => createLoadGuard('EmailConfig.loadAll'), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      loadGuard();
      const [master, config, tplRes, cacheRes, tplList, evts, digestRow] = await Promise.all([
        supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'egoi_email_enabled')
          .maybeSingle(),
        supabase.from('egoi_config').select('*').maybeSingle(),
        supabase.from('email_template_settings').select('*').maybeSingle(),
        supabase.from('egoi_resources_cache').select('*').maybeSingle(),
        supabase
          .from('email_templates')
          .select('*')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('events')
          .select(
            'id,title,slug,date,time,venue,location_city,location_state,image_url,description,subtitle,ticket_link,vip_link,cta_type,blog_post_id,lineup,latitude,longitude,venue_lat,venue_lng,status,pix_button_enabled'
          )
          // Só eventos ativos e futuros — descarta merged_inactive, arquivados
          // e passados (não faz sentido enviar e-mail de evento que já aconteceu).
          .eq('status', 'active')
          .gte('date', new Date().toISOString().slice(0, 10))
          // Mais próximos primeiro (crescente por data e hora).
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(500),

        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', [
            'weekly_digest_enabled',
            'weekly_digest_cron_day',
            'weekly_digest_cron_hour',
            'weekly_digest_template_id',
            'weekly_digest_send_on_cron',
            'weekend_agenda_enabled',
            'weekend_agenda_cron_day',
            'weekend_agenda_cron_hour',
            'weekend_agenda_template_id',
            'weekend_agenda_send_on_cron',
            'blog_digest_enabled',
            'blog_digest_cron_day',
            'blog_digest_cron_hour',
            'blog_digest_template_id',
            'blog_digest_send_on_cron',
            'weekly_digest_last_result',
            'weekend_agenda_last_result',
            'blog_digest_last_result',
            'event_reminder_enabled',
            'event_reminder_days_before',
            'event_reminder_hour',
            'event_reminder_template_id',
            'event_reminder_send_on_cron',
            'weekly_digest_run_history',
            'weekend_agenda_run_history',
            'blog_digest_run_history',
            'event_reminder_run_history',
          ]),
      ]);

      setMasterEnabled(master.data?.value === 'true');
      const settingsMap: Record<string, string> = {};
      for (const r of digestRow.data ?? []) settingsMap[r.key] = r.value ?? '';
      const parseInt10 = (v: string | undefined, fallback: number) => {
        const n = parseInt(v ?? '', 10);
        return Number.isFinite(n) ? n : fallback;
      };
      setWeeklyCfg({
        enabled: settingsMap.weekly_digest_enabled === 'true',
        day: parseInt10(settingsMap.weekly_digest_cron_day, 4),
        hour: parseInt10(settingsMap.weekly_digest_cron_hour, 18),
        templateId: settingsMap.weekly_digest_template_id || '',
        sendOnCron: settingsMap.weekly_digest_send_on_cron === 'true',
      });
      setWeekendCfg({
        enabled: settingsMap.weekend_agenda_enabled === 'true',
        day: parseInt10(settingsMap.weekend_agenda_cron_day, 4),
        hour: parseInt10(settingsMap.weekend_agenda_cron_hour, 12),
        templateId: settingsMap.weekend_agenda_template_id || '',
        sendOnCron: settingsMap.weekend_agenda_send_on_cron === 'true',
      });
      setBlogCfg({
        enabled: settingsMap.blog_digest_enabled === 'true',
        day: parseInt10(settingsMap.blog_digest_cron_day, 0),
        hour: parseInt10(settingsMap.blog_digest_cron_hour, 12),
        templateId: settingsMap.blog_digest_template_id || '',
        sendOnCron: settingsMap.blog_digest_send_on_cron === 'true',
      });
      setEventReminderCfg({
        enabled: settingsMap.event_reminder_enabled === 'true',
        daysBefore: parseInt10(settingsMap.event_reminder_days_before, 3),
        hour: parseInt10(settingsMap.event_reminder_hour, 10),
        templateId: settingsMap.event_reminder_template_id || '',
        sendOnCron: settingsMap.event_reminder_send_on_cron === 'true',
      });
      setDigestRunHistory(parseRunHistory(settingsMap.weekly_digest_run_history));
      setWeekendRunHistory(parseRunHistory(settingsMap.weekend_agenda_run_history));
      setBlogRunHistory(parseRunHistory(settingsMap.blog_digest_run_history));
      setEventReminderRunHistory(parseRunHistory(settingsMap.event_reminder_run_history));
      const parseLastResult = (raw: string | undefined) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };
      setDigestLastResult(parseLastResult(settingsMap.weekly_digest_last_result));
      setWeekendLastResult(parseLastResult(settingsMap.weekend_agenda_last_result));
      setBlogLastResult(parseLastResult(settingsMap.blog_digest_last_result));
      if (tplRes?.data) setTpl(tplRes.data);
      if (cacheRes?.data) {
        setLists(
          Array.isArray(cacheRes.data.lists)
            ? (cacheRes.data.lists as unknown as ListItem[])
            : []
        );
        setSenders(
          Array.isArray(cacheRes.data.senders)
            ? (cacheRes.data.senders as unknown as SenderItem[])
            : []
        );
        setLastSyncedAt(cacheRes.data.last_synced_at ?? null);
      }
      const tplArr = (tplList?.data as unknown as Template[]) ?? [];
      setTemplates(tplArr);
      setActiveTemplateId(
        (prev) => prev || tplArr.find((t) => t.is_default)?.id || tplArr[0]?.id || null
      );
      setRealEvents(evts.data ?? []);
      if (config.data) {
        setCfg({
          id: config.data.id,
          list_id: config.data.list_id,
          sender_id: config.data.sender_id,
          segment_id: config.data.segment_id ?? null,
          mode: (config.data.mode as Mode) ?? 'draft',
          is_enabled: !!config.data.is_enabled,
          scheduled_days_before: config.data.scheduled_days_before ?? 3,
          default_event_template_id:
            (config.data as unknown as { default_event_template_id?: string | null })
              .default_event_template_id ?? null,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao carregar', description: message });
    } finally {
      setLoading(false);
    }
  }, [
    toast,
    loadGuard,
    setWeeklyCfg,
    setWeekendCfg,
    setBlogCfg,
    setDigestLastResult,
    setWeekendLastResult,
    setBlogLastResult,
    setEventReminderCfg,
    setDigestRunHistory,
    setWeekendRunHistory,
    setBlogRunHistory,
    setEventReminderRunHistory,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const fetchSegments = useCallback(
    async (listId: number) => {
      setFetchingSegments(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error('Sessão expirada');
        const projectUrl = 'https://xfvpuzlspvvsmmunznxw.supabase.co';
        const res = await fetch(
          `${projectUrl}/functions/v1/egoi-resources?list_id=${listId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSegments(Array.isArray(json?.segments) ? json.segments : []);
        setListTotal(
          typeof json?.list_total_contacts === 'number' ? json.list_total_contacts : null
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erro desconhecido';
        toast({
          variant: 'destructive',
          title: 'Falha ao buscar segmentos',
          description: message,
        });
        setSegments([]);
      } finally {
        setFetchingSegments(false);
      }
    },
    [toast]
  );

  // Quando a lista muda, recarrega segmentos automaticamente
  useEffect(() => {
    if (cfg.list_id) void fetchSegments(cfg.list_id);
    else {
      setSegments([]);
      setListTotal(null);
    }
  }, [cfg.list_id, fetchSegments]);

  const reloadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setTemplates((data as unknown as Template[]) ?? []);
  }, []);

  const fetchEgoiResources = useCallback(async () => {
    setFetchingResources(true);
    try {
      const { data, error } = await supabase.functions.invoke('egoi-resources');
      if (error) throw error;
      setLists(Array.isArray(data?.lists) ? data.lists : []);
      setSenders(Array.isArray(data?.senders) ? data.senders : []);
      setLastSyncedAt(data?.last_synced_at ?? new Date().toISOString());
      toast({
        title: 'Recursos E-goi atualizados',
        description: `${data?.lists?.length ?? 0} listas · ${data?.senders?.length ?? 0} remetentes.`,
      });
    } catch (e: unknown) {
      const message = await getEdgeFunctionErrorMessage(e);
      toast({ variant: 'destructive', title: 'Falha ao buscar E-goi', description: message });
    } finally {
      setFetchingResources(false);
    }
  }, [toast]);

  const canEnableAuto = cfg.list_id !== null && cfg.sender_id !== null;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        list_id: cfg.list_id,
        sender_id: cfg.sender_id,
        segment_id: cfg.segment_id,
        mode: cfg.mode,
        is_enabled: canEnableAuto ? cfg.is_enabled : false,
        scheduled_days_before: cfg.scheduled_days_before,
        default_event_template_id: cfg.default_event_template_id || null,
        singleton: true,
      };
      const { error } = cfg.id
        ? await supabase.from('egoi_config').update(payload).eq('id', cfg.id)
        : await supabase.from('egoi_config').insert(payload);
      if (error) throw error;
      toast({ title: 'Configuração salva' });
      void loadAll();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: message });
    } finally {
      setSaving(false);
    }
  }, [cfg, canEnableAuto, loadAll, toast]);

  const toggleMaster = useCallback(
    async (v: boolean) => {
      try {
        const { error } = await supabase
          .from('site_settings')
          .upsert(
            { key: 'egoi_email_enabled', value: v ? 'true' : 'false' },
            { onConflict: 'key' }
          );
        if (error) throw error;
        setMasterEnabled(v);
        toast({
          title: v ? 'Master ligado' : 'Master desligado',
          description: v
            ? 'Automação de e-mail habilitada globalmente.'
            : 'Nenhum disparo automático será feito.',
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erro desconhecido';
        toast({
          variant: 'destructive',
          title: 'Erro ao alterar master switch',
          description: message,
        });
      }
    },
    [toast]
  );

  const saveTemplate = useCallback(async () => {
    setTplSaving(true);
    try {
      const { id, ...payload } = tpl;
      const table = supabase.from('email_template_settings');
      const { error } = id
        ? await table.update(payload).eq('id', id)
        : await table.insert({ ...payload, singleton: true });
      if (error) throw error;
      toast({ title: 'Template salvo' });
      void loadAll();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao salvar template', description: message });
    } finally {
      setTplSaving(false);
    }
  }, [tpl, loadAll, toast]);

  const uploadLogo = useCallback(
    async (file: File) => {
      if (file.size > 500 * 1024) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'Máximo 500KB para logos.',
        });
        return;
      }
      setUploadingLogo(true);
      try {
        const ext = file.name.split('.').pop() || 'png';
        const path = `email-template/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('link-thumbnails')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: true,
          });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('link-thumbnails').getPublicUrl(path);
        setTpl({ ...tpl, logo_url: pub.publicUrl });
        toast({ title: 'Logo enviada', description: 'Clique em Salvar para aplicar.' });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erro desconhecido';
        toast({ variant: 'destructive', title: 'Erro no upload', description: message });
      } finally {
        setUploadingLogo(false);
      }
    },
    [tpl, toast]
  );

  // Alcance estimado: segmento tem prioridade; senão pega o total da lista.
  const reachEstimate = useMemo(() => {
    if (cfg.segment_id) {
      const s = segments.find((x) => x.segment_id === cfg.segment_id);
      return s?.total_contacts ?? null;
    }
    if (listTotal !== null) return listTotal;
    const l = lists.find((x) => x.list_id === cfg.list_id);
    return typeof l?.total_contacts === 'number' ? l.total_contacts : null;
  }, [cfg.segment_id, segments, listTotal, lists, cfg.list_id]);

  // Rótulo do segmento global atual, para o seletor de "Envio manual".
  const globalSegmentLabel = useMemo(() => {
    if (!cfg.segment_id) return 'toda a lista';
    const s = segments.find((x) => x.segment_id === cfg.segment_id);
    return s?.name ?? `segmento #${cfg.segment_id}`;
  }, [cfg.segment_id, segments]);

  return {
    // state
    loading,
    saving,
    masterEnabled,
    cfg,
    setCfg,
    lists,
    senders,
    segments,
    listTotal,
    lastSyncedAt,
    fetchingResources,
    fetchingSegments,
    tpl,
    setTpl,
    tplSaving,
    uploadingLogo,
    realEvents,

    // derived
    canEnableAuto,
    reachEstimate,
    globalSegmentLabel,
    // actions
    loadAll,
    reloadTemplates,
    fetchEgoiResources,
    fetchSegments,
    save,
    toggleMaster,
    saveTemplate,
    uploadLogo,
  };
}
