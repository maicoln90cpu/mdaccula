import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NavLink } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save, ShieldAlert, ShieldCheck, Send, Users, Palette, Image as ImageIcon, LayoutGrid, Mail, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import {
  renderEventAnnouncementEmail,
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from "@/lib/emailTemplates/eventAnnouncement";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { renderBlockedTemplate, type Template, type Block, type ArticleSummary } from "@/lib/emailTemplates/blocks";
import { dispatchEventDraftEmail, dispatchAbSubjectTest } from "@/lib/emailTemplates/dispatchEventDraft";
import { buildEmailMeta } from "@/lib/emailTemplates/emailMeta";
import { useEmailGlobalBlocks } from "@/hooks/useEmailGlobalBlocks";
import { InboxPreviewHeader } from "@/components/admin/InboxPreviewHeader";
import { EmailDashboard } from "@/components/admin/EmailDashboard";
import { EmailPersonalControl } from "@/components/admin/EmailPersonalControl";
import { SendNowButton } from "@/components/admin/emailConfig/SendNowButton";
import { AbTestButton } from "@/components/admin/emailConfig/AbTestButton";
import { HistoryTab } from "@/components/admin/emailConfig/HistoryTab";
import { AutomationsTab } from "@/components/admin/emailConfig/AutomationsTab";
import { ConfigTab } from "@/components/admin/emailConfig/ConfigTab";

type Mode = "draft" | "immediate" | "scheduled";

type EgoiConfig = {
  id?: string;
  list_id: number | null;
  sender_id: number | null;
  segment_id: number | null;
  mode: Mode;
  is_enabled: boolean;
  scheduled_days_before: number;
};

type ListItem = { list_id: number; internal_name?: string; public_name?: string; total_contacts?: number | null };
type SenderItem = { sender_id: number; name?: string; email?: string };
type SegmentItem = { segment_id: number; name: string; total_contacts?: number | null };

type Campaign = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  status: "draft" | "scheduled" | "sent" | "failed";
  mode: Mode;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  campaign_type?: string | null;
  ab_group_id?: string | null;
  ab_variant?: string | null;
  ab_test_config?: Record<string, unknown> | null;
  events?: { title: string | null } | null;
};

type EventGroup = {
  event_id: string;
  title: string;
  total: number;
  last: Campaign;
  items: Campaign[];
};

const formatCount = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "—";

const EmailConfig = () => {
  const { toast } = useToast();
  const { globalsMap } = useEmailGlobalBlocks();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [saving, setSaving] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [cfg, setCfg] = useState<EgoiConfig>({
    list_id: null,
    sender_id: null,
    segment_id: null,
    mode: "draft",
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [historySearch, setHistorySearch] = useState("");
  // B.9 — métricas E-goi por campaign_id
  const [campaignStats, setCampaignStats] = useState<Record<string, {
    sent: number; delivered: number; opens_unique: number; clicks_unique: number;
    bounces: number; unsubscribes: number; open_rate: number; click_rate: number;
    fetched_at?: string;
  }>>({});
  const [refreshingStatsId, setRefreshingStatsId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);
  const [tpl, setTpl] = useState<EmailTemplateSettings & { id?: string }>({});
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [realEvents, setRealEvents] = useState<Array<{ id: string; title: string; slug: string; date: string; time: string; venue: string; location_city: string; location_state: string; image_url: string | null; description: string | null; subtitle: string | null; ticket_link: string | null; vip_link: string | null; blog_post_id: string | null; lineup: string[] | null; venue_lat: number | null; venue_lng: number | null }>>([]);
  const [selectedRealEventId, setSelectedRealEventId] = useState<string>("mock");
  const [previewArticle, setPreviewArticle] = useState<ArticleSummary | null>(null);
  const [digestTemplateId, setDigestTemplateId] = useState<string>("");
  const [digestPreviewHtml, setDigestPreviewHtml] = useState<string>("");
  const [digestPreviewMeta, setDigestPreviewMeta] = useState<{ subject?: string; preheader?: string; events_count?: number; posts_count?: number; range?: string; render_source?: string; template_name?: string | null } | null>(null);
  const [digestPreviewLoading, setDigestPreviewLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  // B.8 — Virada de lote
  const [batchEventId, setBatchEventId] = useState<string>("");
  const [batchTemplateId, setBatchTemplateId] = useState<string>("");
  const [batchArtworkUrl, setBatchArtworkUrl] = useState<string>("");
  const [batchSubject, setBatchSubject] = useState<string>("");
  const [batchUploadingArt, setBatchUploadingArt] = useState(false);
  const [batchDispatching, setBatchDispatching] = useState(false);
  // Automações (Digest semanal + Agenda FDS + Blog news)
  type AutomationCfg = { enabled: boolean; day: number; hour: number; templateId: string };
  const [weeklyCfg, setWeeklyCfg] = useState<AutomationCfg>({ enabled: false, day: 4, hour: 18, templateId: "" });
  const [weekendCfg, setWeekendCfg] = useState<AutomationCfg>({ enabled: false, day: 4, hour: 12, templateId: "" });
  const [blogCfg, setBlogCfg] = useState<AutomationCfg>({ enabled: false, day: 0, hour: 12, templateId: "" });
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingWeekend, setSavingWeekend] = useState(false);
  const [savingBlog, setSavingBlog] = useState(false);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [weekendGenerating, setWeekendGenerating] = useState(false);
  const [blogGenerating, setBlogGenerating] = useState(false);
  const [digestLastResult, setDigestLastResult] = useState<{
    egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string;
  } | null>(null);
  const [weekendLastResult, setWeekendLastResult] = useState<{
    egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string;
  } | null>(null);
  const [blogLastResult, setBlogLastResult] = useState<{
    egoi_campaign_id?: string | null; posts_count?: number; range?: string;
  } | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  // Quando a lista muda, recarrega segmentos automaticamente
  useEffect(() => {
    if (cfg.list_id) void fetchSegments(cfg.list_id);
    else {
      setSegments([]);
      setListTotal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.list_id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [master, config, hist, tplRes, cacheRes, tplList, evts, digestRow] = await Promise.all([
        supabase.from("site_settings").select("value").eq("key", "egoi_email_enabled").maybeSingle(),
        supabase.from("egoi_config").select("*").maybeSingle(),
        supabase
          .from("event_email_campaigns")
          .select("*, events(title)")
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase.from as any)("email_template_settings").select("*").maybeSingle(),
        (supabase.from as any)("egoi_resources_cache").select("*").maybeSingle(),
        (supabase.from as any)("email_templates").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: true }),
        supabase.from("events")
          .select("id,title,slug,date,time,venue,location_city,location_state,image_url,description,subtitle,ticket_link,vip_link,blog_post_id,lineup,venue_lat,venue_lng")
          .order("date", { ascending: false })
          .limit(30),
        supabase.from("site_settings").select("key, value").in("key", [
          "weekly_digest_enabled", "weekly_digest_cron_day", "weekly_digest_cron_hour", "weekly_digest_template_id",
          "weekend_agenda_enabled", "weekend_agenda_cron_day", "weekend_agenda_cron_hour", "weekend_agenda_template_id",
          "blog_digest_enabled", "blog_digest_cron_day", "blog_digest_cron_hour", "blog_digest_template_id",
        ]),
      ]);

      setMasterEnabled(master.data?.value === "true");
      const settingsMap: Record<string, string> = {};
      for (const r of ((digestRow.data as any[]) ?? [])) settingsMap[r.key] = r.value ?? "";
      const parseInt10 = (v: string | undefined, fallback: number) => {
        const n = parseInt(v ?? "", 10);
        return Number.isFinite(n) ? n : fallback;
      };
      setWeeklyCfg({
        enabled: settingsMap.weekly_digest_enabled === "true",
        day: parseInt10(settingsMap.weekly_digest_cron_day, 4),
        hour: parseInt10(settingsMap.weekly_digest_cron_hour, 18),
        templateId: settingsMap.weekly_digest_template_id || "",
      });
      setWeekendCfg({
        enabled: settingsMap.weekend_agenda_enabled === "true",
        day: parseInt10(settingsMap.weekend_agenda_cron_day, 4),
        hour: parseInt10(settingsMap.weekend_agenda_cron_hour, 12),
        templateId: settingsMap.weekend_agenda_template_id || "",
      });
      setBlogCfg({
        enabled: settingsMap.blog_digest_enabled === "true",
        day: parseInt10(settingsMap.blog_digest_cron_day, 0),
        hour: parseInt10(settingsMap.blog_digest_cron_hour, 12),
        templateId: settingsMap.blog_digest_template_id || "",
      });
      if (tplRes?.data) setTpl(tplRes.data);
      if (cacheRes?.data) {
        setLists(Array.isArray(cacheRes.data.lists) ? cacheRes.data.lists : []);
        setSenders(Array.isArray(cacheRes.data.senders) ? cacheRes.data.senders : []);
        setLastSyncedAt(cacheRes.data.last_synced_at ?? null);
      }
      const tplArr = (tplList?.data as Template[]) ?? [];
      setTemplates(tplArr);
      setActiveTemplateId((prev) => prev || tplArr.find((t) => t.is_default)?.id || tplArr[0]?.id || null);
      setRealEvents((evts.data as any) ?? []);
      if (config.data) {
        setCfg({
          id: config.data.id,
          list_id: config.data.list_id,
          sender_id: config.data.sender_id,
          segment_id: (config.data as any).segment_id ?? null,
          mode: (config.data.mode as Mode) ?? "draft",
          is_enabled: !!config.data.is_enabled,
          scheduled_days_before: config.data.scheduled_days_before ?? 3,
        });
      }
      setCampaigns((hist.data as Campaign[]) ?? []);

      // B.9 — carrega estatísticas persistidas
      const sentIds = ((hist.data as Campaign[]) ?? [])
        .filter((c) => c.status === "sent")
        .map((c) => c.id);
      if (sentIds.length > 0) {
        const { data: statsRows } = await (supabase.from as any)("event_email_campaign_stats")
          .select("campaign_id, stats_json, fetched_at")
          .in("campaign_id", sentIds);
        if (Array.isArray(statsRows)) {
          const map: Record<string, any> = {};
          for (const r of statsRows) {
            map[r.campaign_id] = { ...(r.stats_json || {}), fetched_at: r.fetched_at };
          }
          setCampaignStats(map);
        }
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao carregar", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const reloadTemplates = async () => {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*").order("is_default", { ascending: false }).order("created_at", { ascending: true });
    setTemplates((data as Template[]) ?? []);
  };

  // B.9 — Atualiza métricas de uma campanha específica na E-goi
  const refreshCampaignStats = async (campaignId: string) => {
    setRefreshingStatsId(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("egoi-campaign-stats", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; stats?: any; error?: string };
      if (!res?.ok || !res.stats) {
        throw new Error(res?.error || "Resposta inválida da E-goi");
      }
      setCampaignStats((prev) => ({
        ...prev,
        [campaignId]: { ...res.stats, fetched_at: new Date().toISOString() },
      }));
      toast({ title: "Métricas atualizadas" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar métricas", description: e.message });
    } finally {
      setRefreshingStatsId(null);
    }
  };

  const fetchEgoiResources = async () => {
    setFetchingResources(true);
    try {
      const { data, error } = await supabase.functions.invoke("egoi-resources");
      if (error) throw error;
      setLists(Array.isArray(data?.lists) ? data.lists : []);
      setSenders(Array.isArray(data?.senders) ? data.senders : []);
      setLastSyncedAt(data?.last_synced_at ?? new Date().toISOString());
      toast({
        title: "Recursos E-goi atualizados",
        description: `${data?.lists?.length ?? 0} listas · ${data?.senders?.length ?? 0} remetentes.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha ao buscar E-goi", description: e.message });
    } finally {
      setFetchingResources(false);
    }
  };

  const fetchSegments = async (listId: number) => {
    setFetchingSegments(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const projectUrl = "https://xfvpuzlspvvsmmunznxw.supabase.co";
      const res = await fetch(
        `${projectUrl}/functions/v1/egoi-resources?list_id=${listId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSegments(Array.isArray(json?.segments) ? json.segments : []);
      setListTotal(typeof json?.list_total_contacts === "number" ? json.list_total_contacts : null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha ao buscar segmentos", description: e.message });
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
        singleton: true,
      };
      const { error } = cfg.id
        ? await supabase.from("egoi_config").update(payload).eq("id", cfg.id)
        : await supabase.from("egoi_config").insert(payload);
      if (error) throw error;
      toast({ title: "Configuração salva" });
      void loadAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const resendEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ email_campaign_dispatched_at: null })
        .eq("id", eventId);
      if (error) throw error;
      toast({
        title: "Evento liberado para reenvio",
        description: "Na próxima ação de disparo, será gerada uma nova campanha.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const dispatchNow = async (eventId: string, opts: { forceResend?: boolean; sendNow?: boolean } = {}) => {
    setDispatchingId(eventId);
    try {
      const res = await dispatchEventDraftEmail(eventId, opts);
      if (res.ok) {
        toast({
          title: res.status === "sent" ? "E-mail enviado!" : "Rascunho criado na E-goi",
          description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
        });
      } else if (res.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          already_dispatched: "Este evento já teve rascunho criado. Use \"Reenviar\" para forçar um novo.",
          event_not_active: "O evento não está com status ativo.",
          no_egoi_config: "Nenhuma configuração da E-goi encontrada.",
          agency_disabled: "Toggle da agência está OFF.",
          list_or_sender_missing: "Lista ou remetente ainda não configurados.",
        };
        toast({ variant: "destructive", title: "Não disparado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
      } else {
        toast({ variant: "destructive", title: "Falha ao criar rascunho", description: res.error || "Erro desconhecido" });
      }
      void loadAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setDispatchingId(null);
    }
  };

  // B.10 — dispara teste A/B de assunto (duas campanhas na E-goi).
  const dispatchAbTest = async (
    eventId: string,
    params: { subjectA: string; subjectB: string; winnerMetric: "opens" | "clicks"; sendNow: boolean },
  ) => {
    setDispatchingId(eventId);
    try {
      const res = await dispatchAbSubjectTest(eventId, params);
      const okA = res.variantA.ok;
      const okB = res.variantB.ok;
      if (okA && okB) {
        toast({
          title: params.sendNow ? "Teste A/B enviado!" : "Rascunhos A e B criados",
          description: `Grupo ${res.groupId.slice(0, 8)} • A #${res.variantA.egoi_campaign_id ?? "?"} • B #${res.variantB.egoi_campaign_id ?? "?"}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Teste A/B com falhas",
          description: `A: ${okA ? "ok" : res.variantA.error || res.variantA.reason || "falhou"} • B: ${okB ? "ok" : res.variantB.error || res.variantB.reason || "falhou"}`,
        });
      }
      void loadAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no teste A/B", description: e.message });
    } finally {
      setDispatchingId(null);
    }
  };



  const toggleMaster = async (v: boolean) => {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "egoi_email_enabled", value: v ? "true" : "false" }, { onConflict: "key" });
      if (error) throw error;
      setMasterEnabled(v);
      toast({ title: v ? "Master ligado" : "Master desligado", description: v ? "Automação de e-mail habilitada globalmente." : "Nenhum disparo automático será feito." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao alterar master switch", description: e.message });
    }
  };

  // Automações — helpers
  const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const upsertSettings = async (rows: Array<{ key: string; value: string }>) => {
    for (const r of rows) {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: r.key, value: r.value }, { onConflict: "key" });
      if (error) throw error;
    }
  };

  const saveAutomation = async (
    job: "weekly_digest" | "weekend_agenda" | "blog_digest",
    cfg: AutomationCfg,
  ) => {
    const prefix = job;
    await upsertSettings([
      { key: `${prefix}_enabled`, value: cfg.enabled ? "true" : "false" },
      { key: `${prefix}_cron_day`, value: String(cfg.day) },
      { key: `${prefix}_cron_hour`, value: String(cfg.hour) },
      { key: `${prefix}_template_id`, value: cfg.templateId || "" },
    ]);
    const { data, error } = await supabase.functions.invoke("update-digest-schedule", {
      body: { job },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const weeklyEffectiveTemplateId = useMemo(
    () => weeklyCfg.templateId || templates.find((t) => (t.type === "weekly_digest" || t.type === "weekly_digest_editorial") && t.is_default)?.id || templates.find((t) => t.type === "weekly_digest" || t.type === "weekly_digest_editorial")?.id || "",
    [weeklyCfg.templateId, templates],
  );
  const weekendEffectiveTemplateId = useMemo(
    () => weekendCfg.templateId || templates.find((t) => t.type === "weekend_agenda" && t.is_default)?.id || templates.find((t) => t.type === "weekend_agenda")?.id || "",
    [weekendCfg.templateId, templates],
  );
  const blogEffectiveTemplateId = useMemo(
    () => blogCfg.templateId || templates.find((t) => t.type === "blog_digest" && t.is_default)?.id || templates.find((t) => t.type === "blog_digest")?.id || "",
    [blogCfg.templateId, templates],
  );

  const handleSaveWeekly = async () => {
    setSavingWeekly(true);
    try {
      await saveAutomation("weekly_digest", { ...weeklyCfg, templateId: weeklyEffectiveTemplateId });
      toast({
        title: weeklyCfg.enabled ? "Digest semanal agendado" : "Digest semanal salvo (desligado)",
        description: weeklyCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[weeklyCfg.day]} ${String(weeklyCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSavingWeekly(false);
    }
  };

  const handleSaveWeekend = async () => {
    setSavingWeekend(true);
    try {
      await saveAutomation("weekend_agenda", { ...weekendCfg, templateId: weekendEffectiveTemplateId });
      toast({
        title: weekendCfg.enabled ? "Agenda FDS agendada" : "Agenda FDS salva (desligada)",
        description: weekendCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[weekendCfg.day]} ${String(weekendCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSavingWeekend(false);
    }
  };

  const generateDigestNow = async () => {
    setDigestGenerating(true);
    setDigestLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (weeklyEffectiveTemplateId) body.template_id = weeklyEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("weekly-digest-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Digest está desligado — ligue o toggle acima primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_content_in_range: "Nenhum evento ou matéria encontrado no período.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) {
        throw new Error(res?.error || "Falha ao criar rascunho");
      }
      setDigestLastResult(res);
      toast({
        title: "Rascunho criado na E-goi",
        description: `${res.events_count ?? 0} evento(s) e ${res.posts_count ?? 0} matéria(s) no digest${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar digest", description: e.message });
    } finally {
      setDigestGenerating(false);
    }
  };

  const generateWeekendNow = async () => {
    setWeekendGenerating(true);
    setWeekendLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (weekendEffectiveTemplateId) body.template_id = weekendEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("weekend-agenda-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          agenda_disabled: "Agenda FDS está desligada — ligue o toggle primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_events_in_range: "Nenhum evento encontrado para este fim de semana.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar rascunho");
      setWeekendLastResult(res);
      toast({
        title: "Rascunho FDS criado na E-goi",
        description: `${res.events_count ?? 0} evento(s) no fim de semana${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar agenda FDS", description: e.message });
    } finally {
      setWeekendGenerating(false);
    }
  };

  const handleSaveBlog = async () => {
    setSavingBlog(true);
    try {
      await saveAutomation("blog_digest", { ...blogCfg, templateId: blogEffectiveTemplateId });
      toast({
        title: blogCfg.enabled ? "Blog news agendado" : "Blog news salvo (desligado)",
        description: blogCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[blogCfg.day]} ${String(blogCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSavingBlog(false);
    }
  };

  const generateBlogNow = async () => {
    setBlogGenerating(true);
    setBlogLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (blogEffectiveTemplateId) body.template_id = blogEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("blog-digest-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Blog news está desligado — ligue o toggle primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_posts_in_range: "Nenhuma matéria publicada no período. Publique posts no blog primeiro.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar rascunho");
      setBlogLastResult(res);
      toast({
        title: "Rascunho Blog news criado na E-goi",
        description: `${res.posts_count ?? 0} matéria(s) no digest${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar Blog news", description: e.message });
    } finally {
      setBlogGenerating(false);
    }
  };

  // Envio de teste das automações — usa dry_run da edge function para renderizar
  // com EXATAMENTE o mesmo pipeline do rascunho/envio real (mesmo helper de
  // preheader, mesmos blocos, mesmas correções Outlook). Não toca a E-goi.
  const [testingWeekly, setTestingWeekly] = useState(false);
  const [testingWeekend, setTestingWeekend] = useState(false);
  const [testingBlog, setTestingBlog] = useState(false);

  const AUTOMATION_TEST_RECIPIENT = "contato@mdaccula.com";

  const sendAutomationTest = async (
    fnName: "weekly-digest-draft" | "weekend-agenda-draft" | "blog-digest-draft",
    label: string,
    setBusy: (v: boolean) => void,
    templateId?: string,
  ) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { force: true, dry_run: true };
      if (templateId) body.template_id = templateId;
      const { data, error } = await supabase.functions.invoke(fnName, {
        body,
      });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        subject?: string; html?: string; preheader?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Automação desligada — ligue o toggle primeiro.",
          agenda_disabled: "Automação desligada — ligue o toggle primeiro.",
          no_posts_in_range: "Nenhuma matéria publicada no período.",
          no_events_in_range: "Nenhum evento encontrado no período.",
          no_content_in_range: "Nenhum evento ou matéria encontrado no período.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok || !res.html || !res.subject) {
        throw new Error(res?.error || "Renderização vazia");
      }
      const { data: sent, error: sendErr } = await supabase.functions.invoke("send-test-email", {
        body: { html: res.html, subject: `[TESTE] ${res.subject}`, to_email: AUTOMATION_TEST_RECIPIENT },
      });
      if (sendErr) throw sendErr;
      toast({
        title: `Teste de ${label} enviado`,
        description: `Enviado para ${sent?.sent_to || AUTOMATION_TEST_RECIPIENT}${res.template_name ? ` · ${res.template_name}` : ""}`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: `Erro no teste de ${label}`, description: e.message });
    } finally {
      setBusy(false);
    }
  };







  // Agrupamento por evento
  const groups: EventGroup[] = useMemo(() => {
    const map = new Map<string, EventGroup>();
    for (const c of campaigns) {
      const g = map.get(c.event_id);
      if (!g) {
        map.set(c.event_id, {
          event_id: c.event_id,
          title: c.events?.title || "(evento sem título)",
          total: 1,
          last: c,
          items: [c],
        });
      } else {
        g.total += 1;
        g.items.push(c);
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
    );
  }, [campaigns]);

  const statusBadge = (s: Campaign["status"]) => {
    const map: Record<Campaign["status"], string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>;
  };

  // Preview usa o template ativo (por blocos) quando existir; senão cai no layout original.
  const activeTemplate = useMemo(() => templates.find((t) => t.id === activeTemplateId) || null, [templates, activeTemplateId]);
  const defaultEventTemplate = useMemo(
    () => templates.find((t) => t.type === "event_new" && t.is_default) || templates.find((t) => t.type === "event_new") || null,
    [templates],
  );

  // Fonte do preview é derivada do TIPO do template ativo (evita 2 seletores conflitantes).
  //   digest / editorial → "digest"     (usa weekly-digest-draft com range de 7 dias)
  //   weekend_agenda    → "weekend"     (mesma função, range weekend)
  //   demais            → "event"       (mock/real do evento selecionado)
  const previewSource: "event" | "digest" | "weekend" = useMemo(() => {
    const t = activeTemplate?.type;
    if (t === "weekly_digest" || t === "weekly_digest_editorial") return "digest";
    if (t === "weekend_agenda") return "weekend";
    return "event";
  }, [activeTemplate?.type]);

  const eventPreviewMeta = useMemo(
    () => buildEmailMeta(activeTemplate?.subject_template, activeTemplate?.preheader_template, {
      eventTitle: previewData.eventTitle,
      dateLabel: previewData.dateLabel,
      timeLabel: previewData.timeLabel,
      venueName: previewData.venueName,
      cityState: previewData.cityState,
    }),
    [activeTemplate?.subject_template, activeTemplate?.preheader_template, previewData],
  );

  const previewHtml = useMemo(() => {
    if (activeTemplate && Array.isArray(activeTemplate.blocks) && activeTemplate.blocks.length > 0) {
      return renderBlockedTemplate(activeTemplate.blocks as Block[], previewData, tpl, previewArticle, { preview: true, globals: globalsMap, preheader: eventPreviewMeta.preheader });
    }
    return renderEventAnnouncementEmail(previewData, tpl, { preheader: eventPreviewMeta.preheader });
  }, [activeTemplate, previewData, tpl, previewArticle, globalsMap, eventPreviewMeta.preheader]);

  const loadDigestPreview = async (opts?: { source?: "digest" | "weekend"; templateId?: string }) => {
    const src = opts?.source ?? (previewSource === "weekend" ? "weekend" : "digest");
    const tplId = opts?.templateId ?? digestTemplateId;
    setDigestPreviewLoading(true);
    try {
      const body: Record<string, unknown> = { dry_run: true, force: true };
      if (src === "weekend") body.range = "weekend";
      if (tplId) body.template_id = tplId;
      const { data, error } = await supabase.functions.invoke("weekly-digest-draft", { body });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast({ title: "Preview indisponível", description: `Motivo: ${(data as any).reason}`, variant: "destructive" });
        setDigestPreviewHtml("");
        setDigestPreviewMeta(null);
        return;
      }
      if (!(data as any)?.html) throw new Error((data as any)?.error || "Sem HTML retornado");
      setDigestPreviewHtml((data as any).html);
      setDigestPreviewMeta({
        subject: (data as any).subject,
        preheader: (data as any).preheader,
        events_count: (data as any).events_count,
        posts_count: (data as any).posts_count,
        range: (data as any).range,
        render_source: (data as any).render_source,
        template_name: (data as any).template_name,
      });
    } catch (e: any) {
      toast({ title: "Erro ao carregar preview", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setDigestPreviewLoading(false);
    }
  };

  // Templates filtrados pela fonte selecionada
  const digestTemplateOptions = useMemo(() => {
    if (previewSource === "digest") {
      return templates.filter((t) => t.type === "weekly_digest" || t.type === "weekly_digest_editorial");
    }
    if (previewSource === "weekend") {
      return templates.filter((t) => t.type === "weekend_agenda");
    }
    return [];
  }, [templates, previewSource]);

  useEffect(() => {
    if (previewSource === "event") return;
    // Fonte digest/weekend: usa o próprio template ativo como fonte do preview.
    const tplId = activeTemplateId || "";
    setDigestTemplateId(tplId);
    loadDigestPreview({ source: previewSource, templateId: tplId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSource, activeTemplateId]);


  const saveTemplate = async () => {
    setTplSaving(true);
    try {
      const { id, ...payload } = tpl as any;
      const table = (supabase.from as any)("email_template_settings");
      const { error } = id
        ? await table.update(payload).eq("id", id)
        : await table.insert({ ...payload, singleton: true });
      if (error) throw error;
      toast({ title: "Template salvo" });
      void loadAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar template", description: e.message });
    } finally {
      setTplSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (file.size > 500 * 1024) {
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "Máximo 500KB para logos." });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `email-template/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("link-thumbnails").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("link-thumbnails").getPublicUrl(path);
      setTpl({ ...tpl, logo_url: pub.publicUrl });
      toast({ title: "Logo enviada", description: "Clique em Salvar para aplicar." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no upload", description: e.message });
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
    return typeof l?.total_contacts === "number" ? l.total_contacts : null;
  }, [cfg.segment_id, segments, listTotal, lists, cfg.list_id]);

  // B.8 — quando templates carregarem, pré-seleciona o primeiro ticket_batch
  useEffect(() => {
    if (batchTemplateId) return;
    const tb = templates.find((t) => (t as any).type === "ticket_batch");
    if (tb?.id) setBatchTemplateId(tb.id);
  }, [templates, batchTemplateId]);

  // Aplica dados de um evento real ao previewData quando seleciona no dropdown.
  useEffect(() => {
    const applyEvent = async () => {
      if (selectedRealEventId === "mock" || !selectedRealEventId) {
        setPreviewData(MOCK_EVENT_DATA);
        setPreviewArticle(null);
        return;
      }
      const ev = realEvents.find((e) => e.id === selectedRealEventId);
      if (!ev) return;
      const dateObj = new Date(`${ev.date}T${ev.time || "00:00"}`);
      const dateLabel = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      const timeLabel = (ev.time || "").slice(0, 5);
      const baseUrl = "https://mdaccula.com";
      const batchDeadline = new Date();
      batchDeadline.setHours(23, 59, 0, 0);
      setPreviewData({
        eventTitle: ev.title,
        eventSubtitle: ev.subtitle ?? undefined,
        flyerUrl: ev.image_url || MOCK_EVENT_DATA.flyerUrl,
        dateLabel,
        timeLabel: timeLabel ? `${timeLabel}` : "22h",
        venueName: ev.venue,
        cityState: `${ev.location_city}-${ev.location_state}`,
        description: ev.description || "",
        ticketUrl: ev.ticket_link || `${baseUrl}/eventos/${ev.slug}`,
        eventUrl: `${baseUrl}/eventos/${ev.slug}`,
        agendaUrl: `${baseUrl}/eventos`,
        instagramUrl: MOCK_EVENT_DATA.instagramUrl,
        youtubeUrl: MOCK_EVENT_DATA.youtubeUrl,
        tiktokUrl: MOCK_EVENT_DATA.tiktokUrl,
        unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
        lineup: Array.isArray(ev.lineup) ? ev.lineup : undefined,
        eventStartIso: dateObj.toISOString(),
        ticketBatchDeadlineIso: batchDeadline.toISOString(),
        venueLat: typeof ev.venue_lat === "number" ? ev.venue_lat : undefined,
        venueLng: typeof ev.venue_lng === "number" ? ev.venue_lng : undefined,
      });
      // Se o evento tem matéria vinculada, busca o resumo
      if (ev.blog_post_id) {
        const { data: post } = await supabase.from("blog_posts")
          .select("title,excerpt,slug,image_url")
          .eq("id", ev.blog_post_id).maybeSingle();
        if (post) {
          setPreviewArticle({
            title: post.title,
            excerpt: post.excerpt || "",
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
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { html, subject, to_email: testEmail || undefined },
      });
      if (error) throw error;
      toast({ title: "E-mail de teste enviado", description: `Enviado para ${data?.sent_to || testEmail || "seu e-mail"}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha no envio de teste", description: e.message });
    } finally {
      setSendingTest(false);
    }
  };

  // B.8 — Upload da arte específica da virada de lote
  const uploadBatchArtwork = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "Máximo 2MB." });
      return;
    }
    setBatchUploadingArt(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `email-template/batch-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("link-thumbnails")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("link-thumbnails").getPublicUrl(path);
      setBatchArtworkUrl(pub.publicUrl);
      toast({ title: "Arte enviada", description: "Ela vai substituir o flyer padrão neste disparo." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no upload", description: e.message });
    } finally {
      setBatchUploadingArt(false);
    }
  };

  // B.8 — Dispara virada de lote (rascunho ou envio real)
  const dispatchBatch = async (sendNow: boolean) => {
    if (!batchEventId) {
      toast({ variant: "destructive", title: "Selecione um evento" });
      return;
    }
    setBatchDispatching(true);
    try {
      const res = await dispatchEventDraftEmail(batchEventId, {
        forceResend: true,
        sendNow,
        templateIdOverride: batchTemplateId || undefined,
        flyerOverrideUrl: batchArtworkUrl || undefined,
        subjectOverride: batchSubject || undefined,
      });
      if (res.ok) {
        toast({
          title: sendNow ? "E-mail de virada enviado!" : "Rascunho de virada criado",
          description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
        });
        void loadAll();
      } else {
        toast({ variant: "destructive", title: "Falha", description: res.error || res.reason || "Erro desconhecido" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setBatchDispatching(false);
    }
  };



  // Nota: não retornamos mais uma tela de loading que desmonta os Tabs. O
  // spinner aparece dentro do conteúdo da aba ativa, para que salvar/atualizar
  // não force o usuário de volta para "Configuração".


  return (
    <main className="w-full px-4 md:px-6 py-6 space-y-6">
      <div>
        <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2">
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
          <TabsTrigger value="dashboard"><BarChart3 className="w-3.5 h-3.5 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="template">Template (marca)</TabsTrigger>
          <TabsTrigger value="editor"><LayoutGrid className="w-3.5 h-3.5 mr-1" />Editor + Preview</TabsTrigger>
          <TabsTrigger value="batch">Virada de lote</TabsTrigger>
          <TabsTrigger value="digest">Automações</TabsTrigger>
          <TabsTrigger value="controle">Controle pessoal</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
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
                  <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Marca</CardTitle>
                  <CardDescription>Logo e nome exibidos no topo do e-mail.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Nome da marca (fallback sem logo)</Label>
                    <Input
                      value={tpl.brand_name ?? ""}
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
                        <img src={tpl.logo_url} alt="Logo" className="h-10 w-auto bg-black rounded" />
                        <Button size="sm" variant="ghost" onClick={() => setTpl({ ...tpl, logo_url: null })}>
                          Remover
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Cores</CardTitle>
                  <CardDescription>Base do gradiente do CTA e destaques.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {([
                    ["primary_color", "Cor primária"],
                    ["accent_color", "Cor de acento"],
                    ["background_color", "Fundo do e-mail"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <Label className="w-40 shrink-0">{label}</Label>
                      <input
                        type="color"
                        value={(tpl as any)[key] ?? "#000000"}
                        onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
                        className="h-9 w-14 rounded border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={(tpl as any)[key] ?? ""}
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
                    Valores usados como padrão. Se o <b>Editor de blocos</b> tem um botão CTA ou link secundário
                    com texto próprio, o texto do bloco tem prioridade sobre este campo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Texto do botão principal (CTA) — fallback</Label>
                    <Input
                      value={tpl.cta_label ?? ""}
                      placeholder="Garantir ingresso"
                      onChange={(e) => setTpl({ ...tpl, cta_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Texto do link secundário — fallback</Label>
                    <Input
                      value={tpl.secondary_link_label ?? ""}
                      placeholder="Ver agenda completa no site"
                      onChange={(e) => setTpl({ ...tpl, secondary_link_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Rodapé (aviso de descadastro)</Label>
                    <Textarea
                      rows={3}
                      value={tpl.footer_text ?? ""}
                      onChange={(e) => setTpl({ ...tpl, footer_text: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Redes sociais agora são configuradas dentro de cada template, no bloco <b>Redes sociais</b> do
                    <b> Editor de blocos</b>. Assim cada template pode ter suas próprias redes.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>HTML no topo e no rodapé (opcional)</CardTitle>
                  <CardDescription>
                    Cola HTML fixo antes da logo (ex.: "Newsletter #12 · Maio 2026") e depois do descadastro
                    (ex.: razão social, CNPJ). Aplicado a <b>todos</b> os templates. Scripts, styles e handlers
                    on* são removidos automaticamente por segurança.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>HTML no topo (antes da logo)</Label>
                    <Textarea
                      rows={4}
                      className="font-mono text-xs"
                      placeholder="<p>Newsletter #12 · Maio 2026</p>"
                      value={tpl.custom_html_header ?? ""}
                      onChange={(e) => setTpl({ ...tpl, custom_html_header: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>HTML no rodapé (após descadastro)</Label>
                    <Textarea
                      rows={4}
                      className="font-mono text-xs"
                      placeholder="<p>MDAccula LTDA · São Paulo-SP</p>"
                      value={tpl.custom_html_footer ?? ""}
                      onChange={(e) => setTpl({ ...tpl, custom_html_footer: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>


              <div className="flex justify-end sticky bottom-4">
                <Button onClick={saveTemplate} disabled={tplSaving} size="lg">
                  <Save className="w-4 h-4 mr-2" />
                  {tplSaving ? "Salvando..." : "Salvar template"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-[#050505] p-4 lg:sticky lg:top-4 lg:self-start">
              <div className="text-xs text-muted-foreground mb-2 px-1">Preview ao vivo (dados mock)</div>
              <InboxPreviewHeader
                subjectTemplate={activeTemplate?.subject_template}
                preheaderTemplate={activeTemplate?.preheader_template}
                overrideSubject={
                  previewSource !== "event" ? digestPreviewMeta?.subject ?? null : null
                }
                overridePreheader={
                  previewSource !== "event" ? digestPreviewMeta?.preheader ?? null : null
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
                srcDoc={previewSource !== "event" ? (digestPreviewHtml || previewHtml) : previewHtml}
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
                  Fonte do preview: {previewSource === "digest" ? "Digest semanal real (7 dias)" : previewSource === "weekend" ? "Agenda FDS real (próximo FDS)" : "Evento individual (mock/real)"}
                </span>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  determinada pelo tipo do template selecionado no editor abaixo
                </span>

                {(previewSource === "digest" || previewSource === "weekend") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => loadDigestPreview()} disabled={digestPreviewLoading}>
                      {digestPreviewLoading ? "Carregando…" : "Atualizar preview"}
                    </Button>
                    {digestPreviewMeta && (
                      <span className="text-xs text-muted-foreground">
                        {digestPreviewMeta.events_count ?? 0} eventos · {digestPreviewMeta.posts_count ?? 0} posts · {digestPreviewMeta.range}
                      </span>
                    )}
                  </>
                )}

                {previewSource === "event" && (
                  <>
                    <Label className="text-xs whitespace-nowrap ml-2">Simular com evento real</Label>
                    <Select value={selectedRealEventId} onValueChange={setSelectedRealEventId}>
                      <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
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
                  <Button size="sm" variant="outline" onClick={() => { setSelectedRealEventId("mock"); setPreviewData(MOCK_EVENT_DATA); }}>
                    Restaurar mock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const html = previewSource !== "event" ? (digestPreviewHtml || previewHtml) : previewHtml;
                      const blob = new Blob([html], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "mdaccula-email-preview.html";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Baixar HTML
                  </Button>
                  <Button
                    size="sm"
                    disabled={sendingTest}
                    onClick={() => {
                      const html = previewSource !== "event" ? (digestPreviewHtml || previewHtml) : previewHtml;
                      const subject = previewSource !== "event" ? (digestPreviewMeta?.subject || "") : eventPreviewMeta.subject;
                      if (!subject) {
                        toast({ variant: "destructive", title: "Assunto vazio", description: "Salve um assunto no template antes de enviar teste." });
                        return;
                      }
                      void sendTestEmail(html, subject);
                    }}
                  >
                    <Send className="w-4 h-4 mr-1" />
                    {sendingTest ? "Enviando…" : "Enviar teste"}
                  </Button>
                </div>
              </div>
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
            overrideHtml={previewSource !== "event" ? digestPreviewHtml : null}
          />
        </TabsContent>


        {/* ================= HISTÓRICO ================= */}
        {/* ================= B.8 — VIRADA DE LOTE ================= */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Virada de lote — disparo pontual</CardTitle>
              <CardDescription>
                Envia um e-mail de urgência ("lote atual acabando") para um evento específico, com opção de <b>arte diferente</b> do flyer padrão. Usa por padrão o template do tipo "ticket_batch".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!masterEnabled && (
                <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Master switch está OFF — o disparo será recusado. Ligue em "Configuração" antes de tentar.</span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Evento</Label>
                  <Select value={batchEventId} onValueChange={setBatchEventId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                    <SelectContent>
                      {realEvents.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title} · {new Date(e.date).toLocaleDateString("pt-BR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Template</Label>
                  <Select value={batchTemplateId} onValueChange={setBatchTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Selecione template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id!} value={t.id!}>
                          {t.name}{(t as any).type === "ticket_batch" ? " · recomendado" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Dica: crie um template do preset "Virada de lote" na aba "Editor de blocos" para reaproveitar.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label>Assunto do e-mail (opcional)</Label>
                  <Input
                    value={batchSubject}
                    placeholder="Ex.: ÚLTIMAS HORAS — lote 2 acabando"
                    onChange={(e) => setBatchSubject(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Se vazio, usa o assunto padrão do template.
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
                      <Button size="sm" variant="ghost" onClick={() => setBatchArtworkUrl("")}>
                        Remover
                      </Button>
                    )}
                  </div>
                  {batchArtworkUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={batchArtworkUrl} alt="Preview arte virada" className="w-32 h-32 object-contain rounded border bg-muted/30" />
                      <p className="text-[11px] text-muted-foreground">
                        Esta arte substitui o flyer padrão neste disparo. Se não enviar nada, o flyer atual do evento é usado.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  disabled={!batchEventId || batchDispatching}
                  onClick={() => dispatchBatch(false)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {batchDispatching ? "Criando..." : "Criar rascunho na E-goi"}
                </Button>
                <SendNowButton
                  eventTitle={realEvents.find((e) => e.id === batchEventId)?.title || "(selecione)"}
                  disabled={!batchEventId || batchDispatching}
                  onConfirm={() => dispatchBatch(true)}
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                O disparo é registrado no <b>Histórico</b> como uma nova campanha (o histórico anterior do evento é preservado).
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
            onTestWeekly={() => sendAutomationTest("weekly-digest-draft", "Digest semanal", setTestingWeekly, weeklyEffectiveTemplateId)}
            weekendCfg={weekendCfg}
            setWeekendCfg={setWeekendCfg}
            weekendEffectiveTemplateId={weekendEffectiveTemplateId}
            savingWeekend={savingWeekend}
            weekendGenerating={weekendGenerating}
            testingWeekend={testingWeekend}
            weekendLastResult={weekendLastResult}
            handleSaveWeekend={handleSaveWeekend}
            generateWeekendNow={generateWeekendNow}
            onTestWeekend={() => sendAutomationTest("weekend-agenda-draft", "Agenda FDS", setTestingWeekend, weekendEffectiveTemplateId)}
            blogCfg={blogCfg}
            setBlogCfg={setBlogCfg}
            blogEffectiveTemplateId={blogEffectiveTemplateId}
            savingBlog={savingBlog}
            blogGenerating={blogGenerating}
            testingBlog={testingBlog}
            blogLastResult={blogLastResult}
            handleSaveBlog={handleSaveBlog}
            generateBlogNow={generateBlogNow}
            onTestBlog={() => sendAutomationTest("blog-digest-draft", "Blog news", setTestingBlog, blogEffectiveTemplateId)}
          />
        </TabsContent>


        {/* ================= HISTÓRICO ================= */}
        {/* ================= CONTROLE PESSOAL ================= */}
        <TabsContent value="controle" className="space-y-4">
          <EmailPersonalControl />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            campaigns={campaigns}
            realEvents={realEvents}
            groups={groups}
            campaignStats={campaignStats}
            expanded={expanded}
            setExpanded={setExpanded}
            dispatchingId={dispatchingId}
            refreshingStatsId={refreshingStatsId}
            masterEnabled={masterEnabled}
            defaultEventTemplate={defaultEventTemplate}
            dispatchNow={dispatchNow}
            dispatchAbTest={dispatchAbTest}
            resendEvent={resendEvent}
            refreshCampaignStats={refreshCampaignStats}
            statusBadge={statusBadge}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
};

// Envolve a página com o Provider único de blocos globais para evitar
// caches divergentes entre o editor e a biblioteca (bug do preview "indisponível").
import { EmailGlobalBlocksProvider } from "@/contexts/EmailGlobalBlocksContext";
const EmailConfigWithProviders = () => (
  <EmailGlobalBlocksProvider>
    <EmailConfig />
  </EmailGlobalBlocksProvider>
);

export default EmailConfigWithProviders;
