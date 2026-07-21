import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Save,
  ShieldAlert,
  Send,
  Palette,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  BarChart3,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '@/lib/emailTemplates/eventAnnouncement';
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { type Template, type Block, type ArticleSummary } from '@/lib/emailTemplates/blocks';
import {
  applyEmailBlockOverrides,
  buildEventAnnouncementData,
  composeEmail,
  type EmailEventRow,
} from '@/lib/emailTemplates/emailComposer';
import { dispatchEventDraftEmail } from '@/lib/emailTemplates/dispatchEventDraft';
import { partitionIssues } from '@/lib/emailTemplates/issueClassifier';

import { useEmailGlobalBlocks } from '@/hooks/useEmailGlobalBlocks';
import { InboxPreviewHeader } from '@/components/admin/InboxPreviewHeader';
import { EmailDashboard } from '@/components/admin/EmailDashboard';
import { SendNowButton } from '@/components/admin/emailConfig/SendNowButton';
import { ScheduleSendPanel } from '@/components/admin/emailConfig/ScheduleSendPanel';
import { EmailEventsTab } from '@/components/admin/emailConfig/EmailEventsTab';
import { AutomationsTab } from '@/components/admin/emailConfig/AutomationsTab';
import { ConfigTab } from '@/components/admin/emailConfig/ConfigTab';
import {
  useEmailAutomation,
  DAY_LABELS,
  AUTOMATION_TEST_RECIPIENT,
} from '@/components/admin/emailConfig/useEmailAutomation';
import type {
  Mode,
  EgoiConfig,
  ListItem,
  SenderItem,
  SegmentItem,
} from '@/components/admin/emailConfig/types';

import { formatCount, formatDateTimeBR } from '@/lib/formatters';

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
  const queryClient = useQueryClient();
  const { globalsMap } = useEmailGlobalBlocks();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
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
  const [previewData, setPreviewData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);
  const [tpl, setTpl] = useState<EmailTemplateSettings & { id?: string }>({});
  const [tplSaving, setTplSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [realEvents, setRealEvents] = useState<
    Array<EmailEventRow & { blog_post_id: string | null }>
  >([]);
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
  const [batchTemplateId, setBatchTemplateId] = useState<string>('');
  const [batchArtworkUrl, setBatchArtworkUrl] = useState<string>('');
  const [batchSubject, setBatchSubject] = useState<string>('');
  const [batchArticle, setBatchArticle] = useState<ArticleSummary | null>(null);
  const [batchUploadingArt, setBatchUploadingArt] = useState(false);
  const [batchDispatching, setBatchDispatching] = useState(false);
  const [batchScheduleAt, setBatchScheduleAt] = useState<string>('');
  const [batchScheduling, setBatchScheduling] = useState(false);
  // Automações (Digest semanal + Agenda FDS + Blog news)
  // Automações (Digest semanal + Agenda FDS + Blog news) — estado + handlers
  // encapsulados no hook `useEmailAutomation` (Fase C).
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
    digestLastResult,
    weekendLastResult,
    blogLastResult,
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
  } = useEmailAutomation({ templates, toast });

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
            'id,title,slug,date,time,venue,location_city,location_state,image_url,description,subtitle,ticket_link,vip_link,cta_type,blog_post_id,lineup,latitude,longitude,venue_lat,venue_lng,status'
          )
          // Oculta eventos inativados por mesclagem (senão o "nome antigo" da
          // duplicata volta a aparecer no select depois de mesclar um festival).
          .neq('status', 'merged_inactive')
          // Mantém eventos recém-passados (últimos 7 dias) para reenvios/cortesias.
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
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
  }, [toast, setWeeklyCfg, setWeekendCfg, setBlogCfg]);

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
        ['event_new', 'courtesy', 'ticket_batch', 'custom'].includes(template.type)
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
  const manualComposition = useMemo(() => {
    if (!selectedManualTemplate || !selectedManualEvent) return null;
    const deadline = new Date();
    deadline.setHours(23, 59, 0, 0);
    const event = buildEventAnnouncementData(selectedManualEvent, {
      flyerOverrideUrl:
        selectedManualTemplate.type === 'ticket_batch' ? batchArtworkUrl || undefined : undefined,
      ticketBatchDeadlineIso: deadline.toISOString(),
    });
    const blocks = applyEmailBlockOverrides(selectedManualTemplate.blocks as Block[], {
      artworkUrl:
        selectedManualTemplate.type === 'ticket_batch'
          ? batchArtworkUrl || event.flyerUrl || undefined
          : undefined,
      defaultLink: event.ticketUrl,
    });
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
    batchArtworkUrl,
    batchSubject,
    tpl,
    batchArticle,
    globalsMap,
  ]);

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

  // B.8 — Dispara virada de lote (rascunho ou envio real)
  const dispatchBatch = async (sendNow: boolean) => {
    if (!batchEventId || !batchTemplateId || !manualComposition) {
      toast({ variant: 'destructive', title: 'Selecione o evento e o template' });
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
      toast({
        title: 'Aviso',
        description: preCheck.warnings.map((item) => item.message).join(' '),
      });
    }
    setBatchDispatching(true);

    try {
      const res = await dispatchEventDraftEmail(batchEventId, {
        forceResend: true,
        sendNow,
        templateIdOverride: batchTemplateId || undefined,
        flyerOverrideUrl:
          selectedManualTemplate?.type === 'ticket_batch'
            ? batchArtworkUrl || undefined
            : undefined,
        subjectOverride:
          selectedManualTemplate?.type === 'ticket_batch' ? batchSubject || undefined : undefined,
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
          // Ainda que sendNow tenha sido pedido, a E-goi manteve a campanha em rascunho
          // (envio não confirmado) — nunca comemorar isso como "enviado" (regressão R-007).
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

  // Agenda o disparo do envio manual para uma data/hora futura em vez de
  // enviar agora — o poller send-scheduled-email-campaigns dispara depois.
  const scheduleBatch = async () => {
    if (!batchEventId || !batchTemplateId || !manualComposition || !batchScheduleAt) {
      toast({ variant: 'destructive', title: 'Selecione o evento, o template e a data/hora' });
      return;
    }
    const preCheckSched = partitionIssues(manualComposition.issues);
    if (preCheckSched.blockers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Agendamento bloqueado',
        description: preCheckSched.blockers.map((item) => item.message).join(' '),
      });
      return;
    }
    if (preCheckSched.warnings.length > 0) {
      toast({
        title: 'Aviso',
        description: preCheckSched.warnings.map((item) => item.message).join(' '),
      });
    }

    setBatchScheduling(true);
    try {
      const scheduleAtIso = new Date(batchScheduleAt).toISOString();
      const res = await dispatchEventDraftEmail(batchEventId, {
        forceResend: true,
        scheduleAt: scheduleAtIso,
        templateIdOverride: batchTemplateId || undefined,
        flyerOverrideUrl:
          selectedManualTemplate?.type === 'ticket_batch'
            ? batchArtworkUrl || undefined
            : undefined,
        subjectOverride:
          selectedManualTemplate?.type === 'ticket_batch' ? batchSubject || undefined : undefined,
        preparedComposition: {
          html: manualComposition.html,
          subject: manualComposition.subject,
          preheader: manualComposition.preheader,
        },
      });
      if (res.ok && res.status === 'scheduled') {
        toast({
          title: 'Disparo agendado!',
          description: `Será enviado em ${formatDateTimeBR(res.scheduled_at ?? scheduleAtIso)}.`,
        });
        setBatchScheduleAt('');
        queryClient.invalidateQueries({ queryKey: ['scheduled-sends', batchEventId] });
        void loadAll();
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao agendar',
          description: res.error || res.reason || 'Erro desconhecido',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    } finally {
      setBatchScheduling(false);
    }
  };

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
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" /> Marca
                  </CardTitle>
                  <CardDescription>Logo e nome exibidos no topo do e-mail.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Nome da marca (fallback sem logo)</Label>
                    <Input
                      value={tpl.brand_name ?? ''}
                      placeholder="MDACCULA"
                      onChange={(e) => setTpl({ ...tpl, brand_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Logo (PNG/SVG, máx 500KB)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        disabled={uploadingLogo}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadLogo(f);
                        }}
                      />
                      {uploadingLogo && <RefreshCw className="w-4 h-4 animate-spin" />}
                    </div>
                    {tpl.logo_url && (
                      <div className="mt-2 flex items-center gap-3 p-2 rounded border bg-muted/20">
                        <img
                          src={tpl.logo_url}
                          alt="Logo"
                          className="h-10 w-auto bg-black rounded"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTpl({ ...tpl, logo_url: null })}
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" /> Cores
                  </CardTitle>
                  <CardDescription>Base do gradiente do CTA e destaques.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(
                    [
                      ['primary_color', 'Cor primária'],
                      ['accent_color', 'Cor de acento'],
                      ['background_color', 'Fundo do e-mail'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <Label className="w-40 shrink-0">{label}</Label>
                      <input
                        type="color"
                        value={tpl[key] ?? '#000000'}
                        onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
                        className="h-9 w-14 rounded border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={tpl[key] ?? ''}
                        onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
                        placeholder="#a855f7"
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Textos e links (fallback global)</CardTitle>
                  <CardDescription>
                    Valores usados como padrão. Se o <b>Editor de blocos</b> tem um botão CTA ou
                    link secundário com texto próprio, o texto do bloco tem prioridade sobre este
                    campo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Texto do botão principal (CTA) — fallback</Label>
                    <Input
                      value={tpl.cta_label ?? ''}
                      placeholder="Garantir ingresso"
                      onChange={(e) => setTpl({ ...tpl, cta_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Texto do link secundário — fallback</Label>
                    <Input
                      value={tpl.secondary_link_label ?? ''}
                      placeholder="Ver agenda completa no site"
                      onChange={(e) => setTpl({ ...tpl, secondary_link_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Rodapé (aviso de descadastro)</Label>
                    <Textarea
                      rows={3}
                      value={tpl.footer_text ?? ''}
                      onChange={(e) => setTpl({ ...tpl, footer_text: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Redes sociais agora são configuradas dentro de cada template, no bloco{' '}
                    <b>Redes sociais</b> do
                    <b> Editor de blocos</b>. Assim cada template pode ter suas próprias redes.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>HTML no topo e no rodapé (opcional)</CardTitle>
                  <CardDescription>
                    Cola HTML fixo antes da logo (ex.: "Newsletter #12 · Maio 2026") e depois do
                    descadastro (ex.: razão social, CNPJ). Aplicado a <b>todos</b> os templates.
                    Scripts, styles e handlers on* são removidos automaticamente por segurança.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>HTML no topo (antes da logo)</Label>
                    <Textarea
                      rows={4}
                      className="font-mono text-xs"
                      placeholder="<p>Newsletter #12 · Maio 2026</p>"
                      value={tpl.custom_html_header ?? ''}
                      onChange={(e) => setTpl({ ...tpl, custom_html_header: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>HTML no rodapé (após descadastro)</Label>
                    <Textarea
                      rows={4}
                      className="font-mono text-xs"
                      placeholder="<p>MDAccula LTDA · São Paulo-SP</p>"
                      value={tpl.custom_html_footer ?? ''}
                      onChange={(e) => setTpl({ ...tpl, custom_html_footer: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end sticky bottom-4">
                <Button onClick={saveTemplate} disabled={tplSaving} size="lg">
                  <Save className="w-4 h-4 mr-2" />
                  {tplSaving ? 'Salvando...' : 'Salvar template'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-[#050505] p-4 lg:sticky lg:top-4 lg:self-start">
              <div className="text-xs text-muted-foreground mb-2 px-1">
                Preview ao vivo (dados mock)
              </div>
              <InboxPreviewHeader
                subjectTemplate={activeTemplate?.subject_template}
                preheaderTemplate={activeTemplate?.preheader_template}
                overrideSubject={
                  previewSource !== 'event' ? (digestPreviewMeta?.subject ?? null) : null
                }
                overridePreheader={
                  previewSource !== 'event' ? (digestPreviewMeta?.preheader ?? null) : null
                }
                data={{
                  eventTitle: previewData.eventTitle,
                  dateLabel: previewData.dateLabel,
                  timeLabel: previewData.timeLabel,
                  venueName: previewData.venueName,
                  cityState: previewData.cityState,
                }}
              />
              <iframe
                title="Template preview"
                srcDoc={previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml}
                sandbox=""
                className="mx-auto block h-[820px] w-full max-w-[640px] rounded-md border-0 bg-white"
              />
            </div>
          </div>
        </TabsContent>

        {/* ================= EDITOR + PREVIEW (unificado) ================= */}
        <TabsContent value="editor" className="space-y-4">
          {/* Barra de contexto do preview.
              A fonte (evento / digest / agenda FDS) é DERIVADA do tipo do template selecionado no editor,
              para evitar 2 seletores conflitantes. */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 whitespace-nowrap">
                  Fonte do preview:{' '}
                  {previewSource === 'digest'
                    ? 'Digest semanal real (7 dias)'
                    : previewSource === 'weekend'
                      ? 'Agenda FDS real (próximo FDS)'
                      : previewSource === 'blog'
                        ? 'Blog news real'
                        : 'Evento individual (mock/real)'}
                </span>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  determinada pelo tipo do template selecionado no editor abaixo
                </span>

                {previewSource !== 'event' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadDigestPreview()}
                      disabled={digestPreviewLoading}
                    >
                      {digestPreviewLoading ? 'Carregando…' : 'Atualizar preview'}
                    </Button>
                    {digestPreviewMeta && (
                      <span className="text-xs text-muted-foreground">
                        {digestPreviewMeta.events_count ?? 0} eventos ·{' '}
                        {digestPreviewMeta.posts_count ?? 0} posts · {digestPreviewMeta.range}
                      </span>
                    )}
                  </>
                )}

                {previewSource === 'event' && (
                  <>
                    <Label className="text-xs whitespace-nowrap ml-2">
                      Simular com evento real
                    </Label>
                    <Select value={selectedRealEventId} onValueChange={setSelectedRealEventId}>
                      <SelectTrigger className="w-[280px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mock">— Dados fictícios (mock) —</SelectItem>
                        {realEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title} · {e.date}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRealEventId('mock');
                      setPreviewData(MOCK_EVENT_DATA);
                    }}
                  >
                    Restaurar mock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const html =
                        previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml;
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'mdaccula-email-preview.html';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Baixar HTML
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      sendingTest ||
                      editorDirty ||
                      (previewSource === 'event' && eventPreviewComposition.issues.length > 0)
                    }
                    onClick={() => {
                      const html =
                        previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml;
                      const subject =
                        previewSource !== 'event'
                          ? digestPreviewMeta?.subject || ''
                          : eventPreviewMeta.subject;
                      if (!subject) {
                        toast({
                          variant: 'destructive',
                          title: 'Assunto vazio',
                          description: 'Salve um assunto no template antes de enviar teste.',
                        });
                        return;
                      }
                      void sendTestEmail(html, subject);
                    }}
                  >
                    <Send className="w-4 h-4 mr-1" />
                    {sendingTest ? 'Enviando…' : 'Enviar teste'}
                  </Button>
                </div>
              </div>
              {editorDirty && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Salve as alterações do template para liberar o envio de teste. Somente a versão
                  salva pode ser enviada.
                </div>
              )}
              {!editorDirty &&
                previewSource === 'event' &&
                eventPreviewComposition.issues.length > 0 && (
                  <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    <div className="font-semibold">Envio bloqueado:</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {eventPreviewComposition.issues.map((item) => (
                        <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </CardContent>
          </Card>

          <EmailTemplateEditor
            templates={templates}
            activeId={activeTemplateId}
            onActiveChange={setActiveTemplateId}
            onReload={reloadTemplates}
            settings={tpl}
            previewEvent={previewData}
            previewArticle={previewArticle}
            overrideHtml={previewSource !== 'event' ? digestPreviewHtml : null}
            onDirtyChange={setEditorDirty}
          />
        </TabsContent>

        {/* ================= HISTÓRICO ================= */}
        {/* ================= B.8 — VIRADA DE LOTE ================= */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Envio manual</CardTitle>
              <CardDescription>
                Escolha um evento e um modelo salvo. A prévia abaixo é exatamente o HTML usado no
                teste, no rascunho e no envio pela E-goi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!masterEnabled && (
                <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Master switch está OFF — o disparo será recusado. Ligue em "Configuração" antes
                    de tentar.
                  </span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Evento</Label>
                  <Select value={batchEventId} onValueChange={setBatchEventId}>
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
                </div>

                <div>
                  <Label>Template</Label>
                  <Select
                    value={batchTemplateId}
                    onValueChange={(id) => {
                      setBatchTemplateId(id);
                      setBatchSubject('');
                      setBatchArtworkUrl('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione template" />
                    </SelectTrigger>
                    <SelectContent>
                      {manualTemplates.map((t) => (
                        <SelectItem key={t.id!} value={t.id!}>
                          {t.name} ·{' '}
                          {t.type === 'event_new'
                            ? 'Evento'
                            : t.type === 'courtesy'
                              ? 'Cortesia'
                              : t.type === 'ticket_batch'
                                ? 'Virada'
                                : 'Custom'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Digest, Agenda FDS e Blog news ficam exclusivamente na aba Automações.
                  </p>
                </div>

                {selectedManualTemplate?.type === 'ticket_batch' && (
                  <>
                    <div className="md:col-span-2">
                      <Label>Assunto desta virada (opcional)</Label>
                      <Input
                        value={batchSubject}
                        placeholder="Ex.: ÚLTIMAS HORAS — lote 2 acabando"
                        onChange={(e) => setBatchSubject(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Se vazio, usa o assunto salvo no template.
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Arte específica da virada (opcional)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={batchUploadingArt}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadBatchArtwork(f);
                          }}
                        />
                        {batchArtworkUrl && (
                          <Button size="sm" variant="ghost" onClick={() => setBatchArtworkUrl('')}>
                            Remover
                          </Button>
                        )}
                      </div>
                      {batchArtworkUrl && (
                        <div className="mt-2 flex items-center gap-3">
                          <img
                            src={batchArtworkUrl}
                            alt="Preview arte virada"
                            className="w-32 h-32 object-contain rounded border bg-muted/30"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Esta arte substitui o flyer padrão somente neste disparo.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {manualComposition && (
                <div className="grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,600px)]">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Revisão final
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {manualComposition.subject || 'Assunto não preenchido'}
                      </div>
                      {manualComposition.preheader && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {manualComposition.preheader}
                        </div>
                      )}
                    </div>
                    {manualComposition.issues.length > 0 ? (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                        <div className="font-semibold">Corrija antes de enviar:</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {manualComposition.issues.map((item) => (
                            <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                        Modelo validado. Teste, rascunho e envio usarão exatamente esta prévia.
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border bg-[#050505] p-2">
                    <iframe
                      title="Prévia final do envio manual"
                      srcDoc={manualComposition.html}
                      sandbox=""
                      width={600}
                      className="mx-auto block h-[720px] bg-white"
                      style={{ width: 600, minWidth: 600, border: 0 }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="secondary"
                  disabled={
                    !manualComposition || manualComposition.issues.length > 0 || sendingTest
                  }
                  onClick={() =>
                    manualComposition &&
                    void sendTestEmail(manualComposition.html, manualComposition.subject)
                  }
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {sendingTest ? 'Enviando...' : 'Enviar teste'}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !manualComposition || manualComposition.issues.length > 0 || batchDispatching
                  }
                  onClick={() => dispatchBatch(false)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {batchDispatching ? 'Criando...' : 'Criar rascunho na E-goi'}
                </Button>
                <SendNowButton
                  eventTitle={realEvents.find((e) => e.id === batchEventId)?.title || '(selecione)'}
                  disabled={
                    !manualComposition || manualComposition.issues.length > 0 || batchDispatching
                  }
                  onConfirm={() => dispatchBatch(true)}
                />
              </div>

              {batchEventId && (
                <ScheduleSendPanel
                  eventId={batchEventId}
                  scheduleAt={batchScheduleAt}
                  onScheduleAtChange={setBatchScheduleAt}
                  disabled={
                    !masterEnabled || !manualComposition || manualComposition.issues.length > 0
                  }
                  scheduling={batchScheduling}
                  onSchedule={scheduleBatch}
                />
              )}

              <p className="text-[11px] text-muted-foreground">
                O disparo é registrado no <b>Histórico</b> como uma nova campanha (o histórico
                anterior do evento é preservado).
              </p>
            </CardContent>
          </Card>
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
            weekendCfg={weekendCfg}
            setWeekendCfg={setWeekendCfg}
            weekendEffectiveTemplateId={weekendEffectiveTemplateId}
            savingWeekend={savingWeekend}
            weekendGenerating={weekendGenerating}
            testingWeekend={testingWeekend}
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
            blogCfg={blogCfg}
            setBlogCfg={setBlogCfg}
            blogEffectiveTemplateId={blogEffectiveTemplateId}
            savingBlog={savingBlog}
            blogGenerating={blogGenerating}
            testingBlog={testingBlog}
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
