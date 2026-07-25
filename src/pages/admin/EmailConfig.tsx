import { useState, useEffect, useMemo } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, Send, LayoutGrid, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
} from '@/lib/emailTemplates/eventAnnouncement';

import { type Block, type ArticleSummary } from '@/lib/emailTemplates/blocks';
import {
  applyEmailBlockOverrides,
  buildEventAnnouncementData,
  buildMultiEventAnnouncementData,
  composeEmail,
} from '@/lib/emailTemplates/emailComposer';
import { partitionIssues } from '@/lib/emailTemplates/issueClassifier';

import { useEmailGlobalBlocks } from '@/hooks/useEmailGlobalBlocks';

import { EmailDashboard } from '@/components/admin/EmailDashboard';
import { EmailEventsTab } from '@/components/admin/emailConfig/EmailEventsTab';
import { AutomationsTab } from '@/components/admin/emailConfig/AutomationsTab';
import { ConfigTab } from '@/components/admin/emailConfig/ConfigTab';
import { ManualSendTab } from '@/components/admin/emailConfig/ManualSendTab';
import { TemplateBrandTab } from '@/components/admin/emailConfig/TemplateBrandTab';
import { TemplateEditorTab } from '@/components/admin/emailConfig/TemplateEditorTab';
import { useEmailDispatch } from '@/components/admin/emailConfig/useEmailDispatch';
import {
  useEmailAutomation,
  DAY_LABELS,
  AUTOMATION_TEST_RECIPIENT,
} from '@/components/admin/emailConfig/useEmailAutomation';
import { useEmailConfigState } from '@/components/admin/emailConfig/useEmailConfigState';

import { formatCount } from '@/lib/formatters';

interface DigestPreviewResponse {
  skipped?: boolean;
  reason?: string;
  html?: string;
  error?: string;
  subject?: string;
  preheader?: string;
  events_count?: number;
  posts_count?: number;
  range?: string;
  render_source?: string;
  template_name?: string | null;
}


const EmailConfig = () => {
  const { toast } = useToast();
  const { globalsMap } = useEmailGlobalBlocks();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [previewData, setPreviewData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);
  const [templates, setTemplates] = useState<import('@/lib/emailTemplates/blocks').Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [selectedRealEventId, setSelectedRealEventId] = useState<string>('mock');
  const [previewArticle, setPreviewArticle] = useState<ArticleSummary | null>(null);
  const [digestTemplateId, setDigestTemplateId] = useState<string>('');
  const [digestPreviewHtml, setDigestPreviewHtml] = useState<string>('');
  const [digestPreviewMeta, setDigestPreviewMeta] = useState<{
    subject?: string;
    preheader?: string;
    events_count?: number;
    posts_count?: number;
    range?: string;
    render_source?: string;
    template_name?: string | null;
  } | null>(null);
  const [digestPreviewLoading, setDigestPreviewLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  // B.8 — Virada de lote
  const [batchEventId, setBatchEventId] = useState<string>('');
  const [batchEventIds, setBatchEventIds] = useState<string[]>([]);
  const [batchTemplateId, setBatchTemplateId] = useState<string>('');
  const [batchArtworkUrl, setBatchArtworkUrl] = useState<string>('');
  const [batchSubject, setBatchSubject] = useState<string>('');
  const [batchArticle, setBatchArticle] = useState<ArticleSummary | null>(null);
  const [batchUploadingArt, setBatchUploadingArt] = useState(false);
  const [batchDispatching, setBatchDispatching] = useState(false);
  const [batchScheduleAt, setBatchScheduleAt] = useState<string>('');
  const [batchScheduling, setBatchScheduling] = useState(false);
  /** undefined = usa o segmento global de egoi_config; null = toda a lista; number = segmento específico. */
  const [batchSegmentId, setBatchSegmentId] = useState<number | null | undefined>(undefined);

  // Automações — estado + handlers encapsulados no hook `useEmailAutomation` (Fase C).
  const {
    weeklyCfg,
    setWeeklyCfg,
    weekendCfg,
    setWeekendCfg,
    blogCfg,
    setBlogCfg,
    savingWeekly,
    savingWeekend,
    savingBlog,
    digestGenerating,
    weekendGenerating,
    blogGenerating,
    testingWeekly,
    setTestingWeekly,
    testingWeekend,
    setTestingWeekend,
    testingBlog,
    setTestingBlog,
    sendingWeekly,
    setSendingWeekly,
    sendingWeekend,
    setSendingWeekend,
    sendingBlog,
    setSendingBlog,
    digestLastResult,
    weekendLastResult,
    blogLastResult,
    setDigestLastResult,
    setWeekendLastResult,
    setBlogLastResult,
    weeklyEffectiveTemplateId,
    weekendEffectiveTemplateId,
    blogEffectiveTemplateId,
    handleSaveWeekly,
    handleSaveWeekend,
    handleSaveBlog,
    generateDigestNow,
    generateWeekendNow,
    generateBlogNow,
    sendAutomationTest,
    sendAutomationNow,
  } = useEmailAutomation({ templates, toast });

  // Camada de dados (loadAll, CRUD egoi_config, upload logo, listas/segmentos)
  // extraída para `useEmailConfigState` na Onda 9 PR-A.
  const {
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
    canEnableAuto,
    reachEstimate,
    globalSegmentLabel,
    loadAll,
    reloadTemplates,
    fetchEgoiResources,
    save,
    toggleMaster,
    saveTemplate,
    uploadLogo,
  } = useEmailConfigState({
    toast,
    templates,
    setTemplates,
    setActiveTemplateId,
    automation: {
      setWeeklyCfg,
      setWeekendCfg,
      setBlogCfg,
      setDigestLastResult,
      setWeekendLastResult,
      setBlogLastResult,
    },
  });


  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
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
      // Restaura o último rascunho gerado (se houver) pra sobreviver a reload
      // — sem isso "Enviar agora" ficava travado até gerar um rascunho novo
      // na mesma sessão, mesmo com uma campanha válida já criada na E-goi.
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
        setLists(Array.isArray(cacheRes.data.lists) ? (cacheRes.data.lists as unknown as ListItem[]) : []);
        setSenders(Array.isArray(cacheRes.data.senders) ? (cacheRes.data.senders as unknown as SenderItem[]) : []);
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
          default_event_template_id: (config.data as unknown as { default_event_template_id?: string | null }).default_event_template_id ?? null,
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
    setWeeklyCfg,
    setWeekendCfg,
    setBlogCfg,
    setDigestLastResult,
    setWeekendLastResult,
    setBlogLastResult,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Quando a lista muda, recarrega segmentos automaticamente
  useEffect(() => {
    if (cfg.list_id) void fetchSegments(cfg.list_id);
    else {
      setSegments([]);
      setListTotal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.list_id]);

  const reloadTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setTemplates((data as unknown as Template[]) ?? []);
  };

  const fetchEgoiResources = async () => {
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
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha ao buscar E-goi', description: message });
    } finally {
      setFetchingResources(false);
    }
  };

  const fetchSegments = async (listId: number) => {
    setFetchingSegments(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Sessão expirada');
      const projectUrl = 'https://xfvpuzlspvvsmmunznxw.supabase.co';
      const res = await fetch(`${projectUrl}/functions/v1/egoi-resources?list_id=${listId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSegments(Array.isArray(json?.segments) ? json.segments : []);
      setListTotal(typeof json?.list_total_contacts === 'number' ? json.list_total_contacts : null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha ao buscar segmentos', description: message });
      setSegments([]);
    } finally {
      setFetchingSegments(false);
    }
  };

  const canEnableAuto = cfg.list_id !== null && cfg.sender_id !== null;

  const save = async () => {
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
  };

  const toggleMaster = async (v: boolean) => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'egoi_email_enabled', value: v ? 'true' : 'false' }, { onConflict: 'key' });
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
  };

  // Preview usa o template ativo (por blocos) quando existir; senão cai no layout original.
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || null,
    [templates, activeTemplateId]
  );

  // Fonte do preview é derivada do TIPO do template ativo (evita 2 seletores conflitantes).
  //   digest / editorial → "digest"     (usa weekly-digest-draft com range de 7 dias)
  //   weekend_agenda    → "weekend"     (mesma função, range weekend)
  //   demais            → "event"       (mock/real do evento selecionado)
  const previewSource: 'event' | 'digest' | 'weekend' | 'blog' = useMemo(() => {
    const t = activeTemplate?.type;
    if (t === 'weekly_digest' || t === 'weekly_digest_editorial') return 'digest';
    if (t === 'weekend_agenda') return 'weekend';
    if (t === 'blog_digest') return 'blog';
    return 'event';
  }, [activeTemplate?.type]);

  const eventPreviewComposition = useMemo(
    () =>
      composeEmail({
        template: {
          blocks: (activeTemplate?.blocks as Block[] | undefined) ?? [],
          subject_template: activeTemplate?.subject_template,
          preheader_template: activeTemplate?.preheader_template,
        },
        event: previewData,
        settings: tpl,
        article: previewArticle,
        globals: globalsMap,
      }),
    [activeTemplate, previewData, tpl, previewArticle, globalsMap]
  );
  const eventPreviewMeta = useMemo(
    () => ({
      subject: eventPreviewComposition.subject,
      preheader: eventPreviewComposition.preheader,
    }),
    [eventPreviewComposition]
  );
  const previewHtml = eventPreviewComposition.html;

  const manualTemplates = useMemo(
    () =>
      templates.filter((template) =>
        ['event_new', 'courtesy', 'ticket_batch', 'ticket_batch_multi', 'custom'].includes(
          template.type
        )
      ),
    [templates]
  );
  const selectedManualTemplate = useMemo(
    () => manualTemplates.find((template) => template.id === batchTemplateId) ?? null,
    [manualTemplates, batchTemplateId]
  );
  const selectedManualEvent = useMemo(
    () => realEvents.find((event) => event.id === batchEventId) ?? null,
    [realEvents, batchEventId]
  );
  const isMultiEventTemplate = selectedManualTemplate?.type === 'ticket_batch_multi';
  const selectedManualEvents = useMemo(
    () => realEvents.filter((event) => batchEventIds.includes(event.id)),
    [realEvents, batchEventIds]
  );
  const manualComposition = useMemo(() => {
    if (!selectedManualTemplate) return null;

    if (isMultiEventTemplate) {
      if (selectedManualEvents.length === 0) return null;
      const event = buildMultiEventAnnouncementData(selectedManualEvents, {
        baseUrl: 'https://mdaccula.com',
      });
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
    // Mesmo filtro de dispatchEventDraft.ts: templates de evento único nunca
    // devem renderizar blocos de digest/agenda multi-evento — sem isso, a
    // prévia do envio manual mostra um aviso que o disparo real já não tem.
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

  // Só blockers reais devem desabilitar os botões de envio — warnings (ex.:
  // descrição vazia) já não impedem o disparo em dispatchBatch/scheduleBatch,
  // então os botões não podem ficar travados por eles também.
  const manualIssuePartition = useMemo(
    () => partitionIssues(manualComposition?.issues ?? []),
    [manualComposition]
  );

  const { dispatchBatch, scheduleBatch } = useEmailDispatch({
    batchEventId,
    batchEventIds,
    batchTemplateId,
    batchArtworkUrl,
    batchSubject,
    batchSegmentId,
    batchScheduleAt,
    isMultiEventTemplate,
    selectedManualEvents,
    selectedManualTemplate,
    manualComposition,
    loadAll,
    setBatchDispatching,
    setBatchScheduling,
    setBatchScheduleAt,
  });

  const loadDigestPreview = async (opts?: {
    source?: 'digest' | 'weekend' | 'blog';
    templateId?: string;
  }) => {
    const src =
      opts?.source ??
      (previewSource === 'weekend' ? 'weekend' : previewSource === 'blog' ? 'blog' : 'digest');
    const tplId = opts?.templateId ?? digestTemplateId;
    setDigestPreviewLoading(true);
    try {
      const body: Record<string, unknown> = { dry_run: true, force: true };
      if (src === 'weekend') body.range = 'weekend';
      if (tplId) body.template_id = tplId;
      const functionName =
        src === 'weekend'
          ? 'weekend-agenda-draft'
          : src === 'blog'
            ? 'blog-digest-draft'
            : 'weekly-digest-draft';
      const { data, error } = await supabase.functions.invoke<DigestPreviewResponse>(functionName, {
        body,
      });
      if (error) throw error;
      if (data?.skipped) {
        toast({
          title: 'Preview indisponível',
          description: `Motivo: ${data.reason}`,
          variant: 'destructive',
        });
        setDigestPreviewHtml('');
        setDigestPreviewMeta(null);
        return;
      }
      if (!data?.html) throw new Error(data?.error || 'Sem HTML retornado');
      setDigestPreviewHtml(data.html);
      setDigestPreviewMeta({
        subject: data.subject,
        preheader: data.preheader,
        events_count: data.events_count,
        posts_count: data.posts_count,
        range: data.range,
        render_source: data.render_source,
        template_name: data.template_name,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar preview',
        description: message ?? String(e),
        variant: 'destructive',
      });
    } finally {
      setDigestPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (previewSource === 'event') return;
    // Fonte digest/weekend: usa o próprio template ativo como fonte do preview.
    const tplId = activeTemplateId || '';
    setDigestTemplateId(tplId);
    loadDigestPreview({ source: previewSource, templateId: tplId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSource, activeTemplateId]);

  const saveTemplate = async () => {
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
  };

  const uploadLogo = async (file: File) => {
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
      const { error: upErr } = await supabase.storage.from('link-thumbnails').upload(path, file, {
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
  };

  // Alcance estimado: segmento tem prioridade; senão pega o total da lista (do detalhe ou do cache do select).
  const reachEstimate = useMemo(() => {
    if (cfg.segment_id) {
      const s = segments.find((x) => x.segment_id === cfg.segment_id);
      return s?.total_contacts ?? null;
    }
    if (listTotal !== null) return listTotal;
    const l = lists.find((x) => x.list_id === cfg.list_id);
    return typeof l?.total_contacts === 'number' ? l.total_contacts : null;
  }, [cfg.segment_id, segments, listTotal, lists, cfg.list_id]);

  // Rótulo do segmento global atual, exibido na opção "padrão" do seletor
  // de segmento da aba "Envio manual".
  const globalSegmentLabel = useMemo(() => {
    if (!cfg.segment_id) return 'toda a lista';
    const s = segments.find((x) => x.segment_id === cfg.segment_id);
    return s?.name ?? `segmento #${cfg.segment_id}`;
  }, [cfg.segment_id, segments]);

  // B.8 — quando templates carregarem, pré-seleciona o primeiro ticket_batch
  useEffect(() => {
    if (batchTemplateId) return;
    const tb = templates.find((t) => t.type === 'ticket_batch');
    if (tb?.id) setBatchTemplateId(tb.id);
  }, [templates, batchTemplateId]);

  useEffect(() => {
    const event = realEvents.find((item) => item.id === batchEventId);
    if (!event?.blog_post_id) {
      setBatchArticle(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('blog_posts')
      .select('title,excerpt,slug,image_url')
      .eq('id', event.blog_post_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBatchArticle(
          data
            ? {
                title: data.title,
                excerpt: data.excerpt || '',
                url: `https://mdaccula.com/blog/${data.slug}`,
                image_url: data.image_url || undefined,
              }
            : null
        );
      });
    return () => {
      cancelled = true;
    };
  }, [batchEventId, realEvents]);

  // Aplica dados de um evento real ao previewData quando seleciona no dropdown.
  useEffect(() => {
    const applyEvent = async () => {
      if (selectedRealEventId === 'mock' || !selectedRealEventId) {
        setPreviewData(MOCK_EVENT_DATA);
        setPreviewArticle(null);
        return;
      }
      const ev = realEvents.find((e) => e.id === selectedRealEventId);
      if (!ev) return;
      const baseUrl = 'https://mdaccula.com';
      const batchDeadline = new Date();
      batchDeadline.setHours(23, 59, 0, 0);
      setPreviewData(
        buildEventAnnouncementData(ev, {
          baseUrl,
          ticketBatchDeadlineIso: batchDeadline.toISOString(),
        })
      );
      // Se o evento tem matéria vinculada, busca o resumo
      if (ev.blog_post_id) {
        const { data: post } = await supabase
          .from('blog_posts')
          .select('title,excerpt,slug,image_url')
          .eq('id', ev.blog_post_id)
          .maybeSingle();
        if (post) {
          setPreviewArticle({
            title: post.title,
            excerpt: post.excerpt || '',
            url: `${baseUrl}/blog/${post.slug}`,
            image_url: post.image_url || undefined,
          });
        } else setPreviewArticle(null);
      } else setPreviewArticle(null);
    };
    void applyEvent();
  }, [selectedRealEventId, realEvents]);

  const sendTestEmail = async (html: string, subject: string) => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { html, subject },
      });
      if (error) throw error;
      if (!data?.ok || !data?.id) {
        throw new Error(data?.error || 'Resend não confirmou o envio (sem ID de mensagem)');
      }
      toast({
        title: 'E-mail de teste enviado',
        description: `Enviado para ${data.sent_to} (Resend #${data.id})`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha no envio de teste', description: message });
    } finally {
      setSendingTest(false);
    }
  };

  // B.8 — Upload da arte específica da virada de lote
  const uploadBatchArtwork = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 2MB.' });
      return;
    }
    setBatchUploadingArt(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `email-template/batch-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('link-thumbnails')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('link-thumbnails').getPublicUrl(path);
      setBatchArtworkUrl(pub.publicUrl);
      toast({
        title: 'Arte enviada',
        description: 'Ela vai substituir o flyer padrão neste disparo.',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro no upload', description: message });
    } finally {
      setBatchUploadingArt(false);
    }
  };

  // Lógica de disparo manual extraída para useEmailDispatch (Onda 2 PR-A).

  // Nota: não retornamos mais uma tela de loading que desmonta os Tabs. O
  // spinner aparece dentro do conteúdo da aba ativa, para que salvar/atualizar
  // não force o usuário de volta para "Configuração".

  return (
    <main className="w-full px-4 md:px-6 py-6 space-y-6">
      <div>
        <NavLink
          to="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </NavLink>
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de E-mails</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o disparo de e-mails via E-goi quando um evento novo é publicado.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            Atualizando dados…
          </div>
        )}
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="template">Template (marca)</TabsTrigger>
          <TabsTrigger value="editor">
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            Editor + Preview
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Send className="w-3.5 h-3.5 mr-1" />
            Envio manual
          </TabsTrigger>
          <TabsTrigger value="digest">Automações</TabsTrigger>
          <TabsTrigger value="eventos">Histórico e controle</TabsTrigger>
        </TabsList>

        {/* ================= DASHBOARD ================= */}
        <TabsContent value="dashboard" className="space-y-6">
          <EmailDashboard />
        </TabsContent>

        {/* ================= CONFIGURAÇÃO ================= */}
        <TabsContent value="config" className="space-y-6">
          <ConfigTab
            masterEnabled={masterEnabled}
            toggleMaster={toggleMaster}
            cfg={cfg}
            setCfg={setCfg}
            canEnableAuto={canEnableAuto}
            lists={lists}
            senders={senders}
            segments={segments}
            templates={templates}
            listTotal={listTotal}
            reachEstimate={reachEstimate}
            fetchingResources={fetchingResources}
            fetchingSegments={fetchingSegments}
            lastSyncedAt={lastSyncedAt}
            fetchEgoiResources={fetchEgoiResources}
            saving={saving}
            save={save}
            formatCount={formatCount}
          />
        </TabsContent>

        {/* ================= TEMPLATE (marca) ================= */}
        <TabsContent value="template" className="space-y-6">
          <TemplateBrandTab
            tpl={tpl}
            setTpl={setTpl}
            tplSaving={tplSaving}
            uploadingLogo={uploadingLogo}
            uploadLogo={uploadLogo}
            saveTemplate={saveTemplate}
            activeTemplate={activeTemplate}
            previewSource={previewSource}
            previewData={previewData}
            previewHtml={previewHtml}
            digestPreviewHtml={digestPreviewHtml}
            digestPreviewMeta={digestPreviewMeta}
          />
        </TabsContent>

        {/* ================= EDITOR + PREVIEW (unificado) ================= */}
        <TabsContent value="editor" className="space-y-4">
          <TemplateEditorTab
            previewSource={previewSource}
            digestPreviewLoading={digestPreviewLoading}
            digestPreviewHtml={digestPreviewHtml}
            digestPreviewMeta={digestPreviewMeta}
            loadDigestPreview={loadDigestPreview}
            selectedRealEventId={selectedRealEventId}
            setSelectedRealEventId={setSelectedRealEventId}
            realEvents={realEvents}
            setPreviewData={setPreviewData}
            previewHtml={previewHtml}
            eventPreviewComposition={eventPreviewComposition}
            eventPreviewMeta={eventPreviewMeta}
            sendingTest={sendingTest}
            editorDirty={editorDirty}
            sendTestEmail={sendTestEmail}
            toast={toast}
            templates={templates}
            activeTemplateId={activeTemplateId}
            setActiveTemplateId={setActiveTemplateId}
            reloadTemplates={reloadTemplates}
            tpl={tpl}
            previewData={previewData}
            previewArticle={previewArticle}
            setEditorDirty={setEditorDirty}
          />
        </TabsContent>

        {/* ================= HISTÓRICO ================= */}
        {/* ================= B.8 — VIRADA DE LOTE ================= */}
        <TabsContent value="batch" className="space-y-4">
          <ManualSendTab
            masterEnabled={masterEnabled}
            batchEventId={batchEventId}
            batchEventIds={batchEventIds}
            batchTemplateId={batchTemplateId}
            batchArtworkUrl={batchArtworkUrl}
            batchSubject={batchSubject}
            batchSegmentId={batchSegmentId}
            batchScheduleAt={batchScheduleAt}
            batchDispatching={batchDispatching}
            batchScheduling={batchScheduling}
            batchUploadingArt={batchUploadingArt}
            sendingTest={sendingTest}
            isMultiEventTemplate={isMultiEventTemplate}
            selectedManualTemplate={selectedManualTemplate}
            selectedManualEvents={selectedManualEvents}
            manualComposition={manualComposition}
            manualIssuePartition={manualIssuePartition}
            cfgListId={cfg.list_id}
            segments={segments}
            listTotal={listTotal}
            globalSegmentLabel={globalSegmentLabel}
            fetchingSegments={fetchingSegments}
            realEvents={realEvents}
            manualTemplates={manualTemplates}
            setBatchEventId={setBatchEventId}
            setBatchEventIds={setBatchEventIds}
            setBatchTemplateId={setBatchTemplateId}
            setBatchArtworkUrl={setBatchArtworkUrl}
            setBatchSubject={setBatchSubject}
            setBatchSegmentId={setBatchSegmentId}
            setBatchScheduleAt={setBatchScheduleAt}
            uploadBatchArtwork={uploadBatchArtwork}
            dispatchBatch={dispatchBatch}
            scheduleBatch={scheduleBatch}
            sendTestEmail={sendTestEmail}
          />
        </TabsContent>

        {/* ================= B.11 — DIGEST SEMANAL ================= */}
        <TabsContent value="digest" className="space-y-4">
          <AutomationsTab
            masterEnabled={masterEnabled}
            templates={templates}
            dayLabels={DAY_LABELS}
            automationTestRecipient={AUTOMATION_TEST_RECIPIENT}
            weeklyCfg={weeklyCfg}
            setWeeklyCfg={setWeeklyCfg}
            weeklyEffectiveTemplateId={weeklyEffectiveTemplateId}
            savingWeekly={savingWeekly}
            digestGenerating={digestGenerating}
            testingWeekly={testingWeekly}
            sendingWeekly={sendingWeekly}
            digestLastResult={digestLastResult}
            handleSaveWeekly={handleSaveWeekly}
            generateDigestNow={generateDigestNow}
            onTestWeekly={() =>
              sendAutomationTest(
                'weekly-digest-draft',
                'Digest semanal',
                setTestingWeekly,
                weeklyEffectiveTemplateId
              )
            }
            onSendWeeklyNow={() =>
              sendAutomationNow(
                'weekly_digest',
                digestLastResult?.egoi_campaign_id,
                'Digest semanal',
                setSendingWeekly
              )
            }
            weekendCfg={weekendCfg}
            setWeekendCfg={setWeekendCfg}
            weekendEffectiveTemplateId={weekendEffectiveTemplateId}
            savingWeekend={savingWeekend}
            weekendGenerating={weekendGenerating}
            testingWeekend={testingWeekend}
            sendingWeekend={sendingWeekend}
            weekendLastResult={weekendLastResult}
            handleSaveWeekend={handleSaveWeekend}
            generateWeekendNow={generateWeekendNow}
            onTestWeekend={() =>
              sendAutomationTest(
                'weekend-agenda-draft',
                'Agenda FDS',
                setTestingWeekend,
                weekendEffectiveTemplateId
              )
            }
            onSendWeekendNow={() =>
              sendAutomationNow(
                'weekend_agenda',
                weekendLastResult?.egoi_campaign_id,
                'Agenda FDS',
                setSendingWeekend
              )
            }
            blogCfg={blogCfg}
            setBlogCfg={setBlogCfg}
            blogEffectiveTemplateId={blogEffectiveTemplateId}
            savingBlog={savingBlog}
            blogGenerating={blogGenerating}
            testingBlog={testingBlog}
            sendingBlog={sendingBlog}
            blogLastResult={blogLastResult}
            handleSaveBlog={handleSaveBlog}
            generateBlogNow={generateBlogNow}
            onTestBlog={() =>
              sendAutomationTest(
                'blog-digest-draft',
                'Blog news',
                setTestingBlog,
                blogEffectiveTemplateId
              )
            }
            onSendBlogNow={() =>
              sendAutomationNow(
                'blog_digest',
                blogLastResult?.egoi_campaign_id,
                'Blog news',
                setSendingBlog
              )
            }
          />
        </TabsContent>

        {/* ================= HISTÓRICO E CONTROLE (unificado) ================= */}
        <TabsContent value="eventos" className="space-y-4">
          <EmailEventsTab
            templates={templates}
            masterEnabled={masterEnabled}
            prepareManualSend={(eventId) => {
              setBatchEventId(eventId);
              setActiveTab('batch');
            }}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
};

// Envolve a página com o Provider único de blocos globais para evitar
// caches divergentes entre o editor e a biblioteca (bug do preview "indisponível").
import { EmailGlobalBlocksProvider } from '@/contexts/EmailGlobalBlocksContext';
const EmailConfigWithProviders = () => (
  <EmailGlobalBlocksProvider>
    <EmailConfig />
  </EmailGlobalBlocksProvider>
);

export default EmailConfigWithProviders;
