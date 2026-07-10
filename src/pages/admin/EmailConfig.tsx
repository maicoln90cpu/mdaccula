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
import { ArrowLeft, RefreshCw, Save, ShieldAlert, ShieldCheck, Send, Users, Palette, Image as ImageIcon, LayoutGrid, Mail } from "lucide-react";
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

/**
 * B.7 — Botão de envio imediato com DUPLA confirmação:
 *   1) Modal explicativo + checkbox "Eu revisei o conteúdo".
 *   2) Digitação obrigatória da palavra "ENVIAR" antes do botão liberar.
 * Só chama onConfirm() depois das duas etapas.
 */
const SendNowButton = ({
  eventTitle,
  disabled,
  onConfirm,
}: {
  eventTitle: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [reviewed, setReviewed] = useState(false);
  const [typed, setTyped] = useState("");
  const reset = () => { setStep(1); setReviewed(false); setTyped(""); };
  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={disabled}>
          <Send className="w-4 h-4 mr-2" /> Enviar agora
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Envio imediato — atenção!</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Você está prestes a <b>enviar de verdade</b> o e-mail do evento{" "}
                    <b>{eventTitle}</b> para toda a lista configurada na E-goi.
                    Isso <b>não pode ser desfeito</b>.
                  </p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="mt-1"
                    />
                    <span>Eu revisei o conteúdo, o assunto e o remetente estão corretos.</span>
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button disabled={!reviewed} onClick={() => setStep(2)}>Continuar</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Última confirmação</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Para liberar o envio, digite <b>ENVIAR</b> no campo abaixo.
                  </p>
                  <Input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Digite ENVIAR"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={typed.trim().toUpperCase() !== "ENVIAR"}
                onClick={async () => { setOpen(false); reset(); await onConfirm(); }}
              >
                Sim, enviar agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * B.10 — Botão + modal para disparar teste A/B de assunto.
 * Cria DUAS campanhas na E-goi (variantes A e B) com assuntos distintos, agrupadas por ab_group_id.
 * O vencedor é apurado depois pelas métricas B.9.
 */
const AbTestButton = ({
  eventTitle,
  defaultSubject,
  disabled,
  onConfirm,
}: {
  eventTitle: string;
  defaultSubject: string;
  disabled?: boolean;
  onConfirm: (params: {
    subjectA: string;
    subjectB: string;
    winnerMetric: "opens" | "clicks";
    sendNow: boolean;
  }) => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [subjectA, setSubjectA] = useState(defaultSubject);
  const [subjectB, setSubjectB] = useState("");
  const [winnerMetric, setWinnerMetric] = useState<"opens" | "clicks">("opens");
  const [sendNow, setSendNow] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [typed, setTyped] = useState("");
  const reset = () => {
    setStep(1); setReviewed(false); setTyped("");
    setSubjectA(defaultSubject); setSubjectB(""); setWinnerMetric("opens"); setSendNow(false);
  };
  const canContinue =
    subjectA.trim().length >= 3 &&
    subjectB.trim().length >= 3 &&
    subjectA.trim() !== subjectB.trim() &&
    reviewed;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Send className="w-4 h-4 mr-2" /> Teste A/B assunto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Teste A/B de assunto — {eventTitle}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm">
                    Serão criadas <b>duas campanhas</b> na E-goi, cada uma com um assunto diferente.
                    Ambas vão para a lista completa. O vencedor é apurado depois pelas métricas
                    (abertura ou clique).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Obs.: a API v3 da E-goi não expõe split-test nativo por assunto — este é o
                    fluxo de "duas campanhas independentes". Recomendado apenas com listas ≥ 1000
                    contatos para o resultado ter significância.
                  </p>
                  <div>
                    <Label>Assunto A</Label>
                    <Input value={subjectA} onChange={(e) => setSubjectA(e.target.value)} placeholder="Ex.: Novo evento chegou 🔥" />
                  </div>
                  <div>
                    <Label>Assunto B</Label>
                    <Input value={subjectB} onChange={(e) => setSubjectB(e.target.value)} placeholder="Ex.: Você não vai querer perder este" />
                    {subjectA.trim() && subjectB.trim() && subjectA.trim() === subjectB.trim() && (
                      <p className="text-xs text-red-500 mt-1">Assuntos A e B precisam ser diferentes.</p>
                    )}
                  </div>
                  <div>
                    <Label>Métrica vencedora</Label>
                    <Select value={winnerMetric} onValueChange={(v) => setWinnerMetric(v as "opens" | "clicks")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opens">Taxa de abertura</SelectItem>
                        <SelectItem value="clicks">Taxa de cliques</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="mt-1" />
                    <span>Enviar agora (imediato). Se desmarcado, cria apenas os rascunhos na E-goi.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1" />
                    <span>Eu revisei os assuntos e sei que <b>duas campanhas</b> serão criadas.</span>
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button disabled={!canContinue} onClick={() => setStep(2)}>Continuar</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Última confirmação</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm">
                    Para liberar o {sendNow ? "envio" : "criação"} do teste A/B, digite <b>ENVIAR AB</b>.
                  </p>
                  <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Digite ENVIAR AB" />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={typed.trim().toUpperCase() !== "ENVIAR AB"}
                onClick={async () => {
                  setOpen(false); reset();
                  await onConfirm({
                    subjectA: subjectA.trim(),
                    subjectB: subjectB.trim(),
                    winnerMetric,
                    sendNow,
                  });
                }}
              >
                Sim, {sendNow ? "enviar" : "criar rascunhos"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

const EmailConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("config");
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
  const [previewSource, setPreviewSource] = useState<"event" | "digest" | "weekend">("event");
  const [digestTemplateId, setDigestTemplateId] = useState<string>("");
  const [digestPreviewHtml, setDigestPreviewHtml] = useState<string>("");
  const [digestPreviewMeta, setDigestPreviewMeta] = useState<{ subject?: string; events_count?: number; posts_count?: number; range?: string; render_source?: string; template_name?: string | null } | null>(null);
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
  // B.11 — Digest semanal
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [digestLastResult, setDigestLastResult] = useState<{
    egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string;
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
        supabase.from("site_settings").select("value").eq("key", "weekly_digest_enabled").maybeSingle(),
      ]);

      setMasterEnabled(master.data?.value === "true");
      setDigestEnabled(digestRow.data?.value === "true");
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

  // B.11 — Digest semanal
  const toggleDigestEnabled = async (v: boolean) => {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "weekly_digest_enabled", value: v ? "true" : "false" }, { onConflict: "key" });
      if (error) throw error;
      setDigestEnabled(v);
      toast({
        title: v ? "Digest semanal ligado" : "Digest semanal desligado",
        description: v
          ? "Toda quinta-feira às 18h (Cuiabá) um rascunho será criado automaticamente na E-goi."
          : "O cron semanal não criará mais rascunhos.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao alterar toggle", description: e.message });
    }
  };

  const generateDigestNow = async () => {
    setDigestGenerating(true);
    setDigestLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-digest-draft", {
        body: { force: true },
      });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Digest está desligado — ligue o toggle acima primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
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
        description: `${res.events_count ?? 0} evento(s) e ${res.posts_count ?? 0} matéria(s) no digest.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar digest", description: e.message });
    } finally {
      setDigestGenerating(false);
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
  const previewHtml = useMemo(() => {
    if (activeTemplate && Array.isArray(activeTemplate.blocks) && activeTemplate.blocks.length > 0) {
      return renderBlockedTemplate(activeTemplate.blocks as Block[], previewData, tpl, previewArticle, { preview: true });
    }
    return renderEventAnnouncementEmail(previewData, tpl);
  }, [activeTemplate, previewData, tpl, previewArticle]);

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
    // Ajusta template selecionado quando fonte muda
    const opts = previewSource === "weekend"
      ? templates.filter((t) => t.type === "weekend_agenda")
      : templates.filter((t) => t.type === "weekly_digest" || t.type === "weekly_digest_editorial");
    const defaultId = opts.find((t) => t.is_default)?.id || opts[0]?.id || "";
    setDigestTemplateId(defaultId);
    loadDigestPreview({ source: previewSource, templateId: defaultId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSource, templates]);


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
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="template">Template (marca)</TabsTrigger>
          <TabsTrigger value="editor"><LayoutGrid className="w-3.5 h-3.5 mr-1" />Editor de blocos</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="batch">Virada de lote</TabsTrigger>
          <TabsTrigger value="digest">Digest semanal</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* ================= CONFIGURAÇÃO ================= */}
        <TabsContent value="config" className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Status geral
              </CardTitle>
              <CardDescription>
                Dois níveis de segurança. Ambos precisam estar <b>ON</b> para disparos automáticos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <div className="font-medium">Master switch</div>
                  <div className="text-xs text-muted-foreground">
                    Trava global da automação. Deixe OFF enquanto valida; ligue para permitir disparos reais.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={masterEnabled ? "default" : "secondary"}>{masterEnabled ? "ON" : "OFF"}</Badge>
                  <Switch checked={masterEnabled} onCheckedChange={toggleMaster} />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-medium">Ativado pela agência</div>
                  <div className="text-xs text-muted-foreground">
                    {canEnableAuto
                      ? "Toggle disponível — lista e remetente já configurados."
                      : "Preencha lista e remetente antes de habilitar."}
                  </div>
                </div>
                <Switch
                  checked={cfg.is_enabled}
                  disabled={!canEnableAuto}
                  onCheckedChange={(v) => setCfg({ ...cfg, is_enabled: v })}
                />
              </div>

              {!masterEnabled && cfg.is_enabled && (
                <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Toggle da agência está ON, mas o Master ainda está OFF. Nada será disparado até a agência liberar.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuração */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração de envio</CardTitle>
              <CardDescription>Lista, segmento (opcional), remetente e modo de disparo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={fetchEgoiResources} disabled={fetchingResources}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${fetchingResources ? "animate-spin" : ""}`} />
                  {lists.length > 0 || senders.length > 0 ? "Atualizar da E-goi" : "Buscar listas e remetentes da E-goi"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {lists.length > 0 || senders.length > 0
                    ? `${lists.length} listas • ${senders.length} remetentes${lastSyncedAt ? ` • sincronizado ${new Date(lastSyncedAt).toLocaleString("pt-BR")}` : ""}`
                    : "Clique para popular os selects (usa sua API key)."}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Lista */}
                <div>
                  <Label>Lista (list_id)</Label>
                  {lists.length > 0 ? (
                    <Select
                      value={cfg.list_id?.toString() ?? ""}
                      onValueChange={(v) => setCfg({ ...cfg, list_id: Number(v), segment_id: null })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a lista" /></SelectTrigger>
                      <SelectContent>
                        {lists.map((l) => (
                          <SelectItem key={l.list_id} value={l.list_id.toString()}>
                            {l.internal_name || l.public_name || `Lista ${l.list_id}`}
                            {typeof l.total_contacts === "number" && ` — ${formatCount(l.total_contacts)} contatos`}
                            {" "}(#{l.list_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      placeholder="Ex: 12345"
                      value={cfg.list_id ?? ""}
                      onChange={(e) => setCfg({ ...cfg, list_id: e.target.value ? Number(e.target.value) : null, segment_id: null })}
                    />
                  )}
                </div>

                {/* Remetente */}
                <div>
                  <Label>Remetente (sender_id)</Label>
                  {senders.length > 0 ? (
                    <Select
                      value={cfg.sender_id?.toString() ?? ""}
                      onValueChange={(v) => setCfg({ ...cfg, sender_id: Number(v) })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o remetente" /></SelectTrigger>
                      <SelectContent>
                        {senders.map((s) => (
                          <SelectItem key={s.sender_id} value={s.sender_id.toString()}>
                            {s.name || s.email || `Sender ${s.sender_id}`}
                            {s.email && s.name ? ` <${s.email}>` : ""} (#{s.sender_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      placeholder="Ex: 6789"
                      value={cfg.sender_id ?? ""}
                      onChange={(e) => setCfg({ ...cfg, sender_id: e.target.value ? Number(e.target.value) : null })}
                    />
                  )}
                </div>

                {/* Segmento */}
                <div className="md:col-span-2">
                  <Label className="flex items-center gap-2">
                    Segmento (opcional)
                    {fetchingSegments && <RefreshCw className="w-3 h-3 animate-spin" />}
                  </Label>
                  <Select
                    value={cfg.segment_id?.toString() ?? "all"}
                    onValueChange={(v) => setCfg({ ...cfg, segment_id: v === "all" ? null : Number(v) })}
                    disabled={!cfg.list_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={cfg.list_id ? "Todos os contatos da lista" : "Selecione uma lista primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        Todos os contatos da lista
                        {typeof listTotal === "number" && ` — ${formatCount(listTotal)} contatos`}
                      </SelectItem>
                      {segments.map((s) => (
                        <SelectItem key={s.segment_id} value={s.segment_id.toString()}>
                          {s.name}
                          {typeof s.total_contacts === "number" && ` — ${formatCount(s.total_contacts)} contatos`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sem segmento = envia para toda a lista. Segmentos vêm direto da E-goi.
                  </p>
                </div>

                {/* Modo */}
                <div>
                  <Label>Modo de disparo</Label>
                  <Select value={cfg.mode} onValueChange={(v) => setCfg({ ...cfg, mode: v as Mode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho (admin revisa e envia manual)</SelectItem>
                      <SelectItem value="immediate">Imediato (envia direto)</SelectItem>
                      <SelectItem value="scheduled">Agendado (dias antes do evento)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recomendado: <b>Rascunho</b> nas primeiras semanas até validar o fluxo.
                  </p>
                </div>

                {cfg.mode === "scheduled" && (
                  <div>
                    <Label>Dias antes do evento</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={cfg.scheduled_days_before}
                      onChange={(e) => setCfg({ ...cfg, scheduled_days_before: Number(e.target.value) || 1 })}
                    />
                  </div>
                )}
              </div>

              {/* Alcance estimado */}
              {cfg.list_id && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    Alcance estimado: <b>{formatCount(reachEstimate)}</b> contatos
                    {cfg.segment_id ? " (segmento)" : " (lista inteira)"}
                  </span>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar configuração"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Teste — agora um atalho real, não um placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Teste de disparo</CardTitle>
              <CardDescription>
                O teste real fica na aba <b>Preview</b> ("Enviar teste agora") e o disparo de rascunhos/envios reais na aba <b>Histórico</b> (por evento) ou <b>Virada de lote</b> (com arte específica).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              A caixa "Criar rascunho de teste (em breve)" foi substituída pelo fluxo real da aba <b>Histórico</b>.
              Use "Criar rascunho" ou "Enviar agora" no evento desejado — cada disparo fica registrado com status e ID da E-goi.
            </CardContent>
          </Card>
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
                      placeholder="<p>MDAccula LTDA · Cuiabá-MT</p>"
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
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                sandbox=""
                className="mx-auto block h-[820px] w-full max-w-[640px] rounded-md border-0 bg-white"
              />
            </div>
          </div>
        </TabsContent>

        {/* ================= EDITOR DE BLOCOS ================= */}
        <TabsContent value="editor" className="space-y-4">
          <EmailTemplateEditor
            templates={templates}
            activeId={activeTemplateId}
            onActiveChange={setActiveTemplateId}
            onReload={reloadTemplates}
            settings={tpl}
            previewEvent={previewData}
            previewArticle={previewArticle}
          />
        </TabsContent>

        {/* ================= PREVIEW ================= */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview do template</CardTitle>
              <CardDescription>
                Edite os dados mock à esquerda e veja como o e-mail aparecerá na caixa de entrada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 rounded-lg border bg-muted/20 flex flex-wrap items-center gap-3">
                <Label className="text-xs whitespace-nowrap">Fonte dos dados</Label>
                <Select value={previewSource} onValueChange={(v) => setPreviewSource(v as "event" | "digest" | "weekend")}>
                  <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Evento individual (mock/real)</SelectItem>
                    <SelectItem value="digest">Digest semanal real (próximos 7 dias)</SelectItem>
                    <SelectItem value="weekend">Agenda FDS real (próximo fim de semana)</SelectItem>
                  </SelectContent>
                </Select>
                {(previewSource === "digest" || previewSource === "weekend") && (
                  <>
                    <Label className="text-xs whitespace-nowrap ml-2">Template</Label>
                    <Select
                      value={digestTemplateId || "__default__"}
                      onValueChange={(v) => {
                        const id = v === "__default__" ? "" : v;
                        setDigestTemplateId(id);
                        loadDigestPreview({ source: previewSource, templateId: id });
                      }}
                    >
                      <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">— Padrão (is_default) —</SelectItem>
                        {digestTemplateOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id!}>
                            {t.name} {t.is_default ? "· padrão" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => loadDigestPreview()} disabled={digestPreviewLoading}>
                      {digestPreviewLoading ? "Carregando…" : "Atualizar preview"}
                    </Button>
                    {digestPreviewMeta && (
                      <span className="text-xs text-muted-foreground">
                        {digestPreviewMeta.events_count ?? 0} eventos · {digestPreviewMeta.posts_count ?? 0} posts · {digestPreviewMeta.range}
                        {digestPreviewMeta.render_source && ` · ${digestPreviewMeta.render_source}${digestPreviewMeta.template_name ? ` (${digestPreviewMeta.template_name})` : ""}`}
                      </span>
                    )}
                  </>
                )}
              </div>


              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className={`space-y-3 ${previewSource !== "event" ? "opacity-60 pointer-events-none" : ""}`}>

                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <Label className="text-xs">Simular com evento real</Label>
                    <Select value={selectedRealEventId} onValueChange={setSelectedRealEventId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mock">— Dados fictícios (mock) —</SelectItem>
                        {realEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title} · {e.date}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRealEventId !== "mock" && previewArticle && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✓ Matéria vinculada: bloco "Resumo da matéria" ativo no template.
                      </p>
                    )}
                    <Label className="text-xs mt-2 block">Template</Label>
                    <Select value={activeTemplateId ?? ""} onValueChange={setActiveTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id!} value={t.id!}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Título</Label>
                    <Input value={previewData.eventTitle} onChange={(e) => setPreviewData({ ...previewData, eventTitle: e.target.value })} />
                  </div>
                  <div>
                    <Label>Subtítulo</Label>
                    <Input value={previewData.eventSubtitle ?? ""} onChange={(e) => setPreviewData({ ...previewData, eventSubtitle: e.target.value })} />
                  </div>
                  <div>
                    <Label>Flyer URL</Label>
                    <Input value={previewData.flyerUrl} onChange={(e) => setPreviewData({ ...previewData, flyerUrl: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Data</Label>
                      <Input value={previewData.dateLabel} onChange={(e) => setPreviewData({ ...previewData, dateLabel: e.target.value })} />
                    </div>
                    <div>
                      <Label>Hora</Label>
                      <Input value={previewData.timeLabel} onChange={(e) => setPreviewData({ ...previewData, timeLabel: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Local</Label>
                      <Input value={previewData.venueName} onChange={(e) => setPreviewData({ ...previewData, venueName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cidade/UF</Label>
                      <Input value={previewData.cityState} onChange={(e) => setPreviewData({ ...previewData, cityState: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea rows={3} value={previewData.description} onChange={(e) => setPreviewData({ ...previewData, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Link do ingresso</Label>
                    <Input value={previewData.ticketUrl} onChange={(e) => setPreviewData({ ...previewData, ticketUrl: e.target.value })} />
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2 mt-3">
                    <Label className="text-xs flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Enviar teste para meu e-mail</Label>
                    <Input
                      type="email"
                      placeholder="Deixe em branco para enviar ao meu e-mail admin"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={sendingTest}
                      onClick={() => sendTestEmail(previewHtml, `[Teste] ${previewData.eventTitle}`)}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {sendingTest ? "Enviando…" : "Enviar teste agora"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">Envia via Resend (não usa E-goi). O link "Descadastrar" aparece como texto porque só é substituído em envios reais pela E-goi.</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedRealEventId("mock"); setPreviewData(MOCK_EVENT_DATA); }}>
                      Restaurar mock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([previewHtml], { type: "text/html" });
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
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Para editar logo, cores e textos fixos, use a aba <b>Template (marca)</b>. Para reordenar blocos e customizar o layout, use <b>Editor de blocos</b>.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-[#050505] p-4">
                  <iframe
                    title="Email preview"
                    srcDoc={previewSource !== "event" ? (digestPreviewHtml || "<div style='padding:40px;text-align:center;font-family:sans-serif;color:#888'>Carregando preview real…</div>") : previewHtml}
                    sandbox=""
                    className="mx-auto block h-[900px] w-full max-w-[640px] rounded-md border-0 bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <CardTitle>Digest semanal — resumo automático</CardTitle>
              <CardDescription>
                Toda <b>quinta-feira às 18h de Cuiabá</b>, um rascunho é criado automaticamente na E-goi com a agenda dos próximos 7 dias e as matérias mais recentes do blog. O e-mail <b>não é enviado</b> automaticamente — você revisa e envia dentro da E-goi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!masterEnabled && (
                <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Master switch está OFF — nenhum rascunho será criado. Ligue em "Configuração" antes.</span>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <div className="text-sm font-medium">Cron automático (quinta 18h BRT)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Quando ligado, o banco de dados chama a função <code>weekly-digest-draft</code> semanalmente.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={digestEnabled ? "default" : "secondary"}>{digestEnabled ? "ON" : "OFF"}</Badge>
                  <Switch checked={digestEnabled} onCheckedChange={toggleDigestEnabled} />
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <div className="text-sm font-medium">Gerar rascunho agora</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Cria imediatamente um rascunho na E-goi usando os próximos 7 dias, sem depender do cron. Útil para testar ou disparar fora da quinta.
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={generateDigestNow}
                  disabled={!masterEnabled || digestGenerating}
                >
                  {digestGenerating ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gerando…</>
                  ) : (
                    <><Mail className="w-4 h-4 mr-2" /> Gerar rascunho agora</>
                  )}
                </Button>
                {digestLastResult && (
                  <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
                    <div><b>Rascunho criado.</b> Campanha #{digestLastResult.egoi_campaign_id || "—"}</div>
                    <div>Período: {digestLastResult.range} · {digestLastResult.events_count} evento(s) · {digestLastResult.posts_count} matéria(s)</div>
                    <div className="mt-1">Abra o painel da E-goi para revisar e enviar.</div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                O layout do digest é fixo (agenda + blog + CTA para a agenda completa) e usa as cores/logo do <b>Template (marca)</b>. Personalização por blocos virá em uma onda futura.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= HISTÓRICO ================= */}
        <TabsContent value="history" className="space-y-4">
          {/* B.6.1 — Eventos sem campanha (importados via CSV/script) */}
          {(() => {
            const dispatchedIds = new Set(campaigns.map((c) => c.event_id));
            const pending = realEvents.filter((e) => !dispatchedIds.has(e.id));
            if (pending.length === 0) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Eventos sem rascunho ({pending.length})</CardTitle>
                  <CardDescription>
                    Eventos criados via importação ou script que ainda não tiveram um rascunho de e-mail criado. Clique para criar manualmente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pending.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{ev.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(ev.date).toLocaleDateString("pt-BR")} • {ev.venue}, {ev.location_city}-{ev.location_state}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={dispatchingId === ev.id}
                            onClick={() => dispatchNow(ev.id)}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {dispatchingId === ev.id ? "Criando..." : "Criar rascunho"}
                          </Button>
                          <SendNowButton
                            eventTitle={ev.title}
                            disabled={dispatchingId === ev.id}
                            onConfirm={() => dispatchNow(ev.id, { sendNow: true, forceResend: true })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle>Histórico por evento</CardTitle>
              <CardDescription>
                {groups.length} eventos • {campaigns.length} campanhas registradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma campanha registrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map((g) => {
                    const open = expanded[g.event_id];
                    return (
                      <div key={g.event_id} className="border rounded-lg">
                        <button
                          type="button"
                          onClick={() => setExpanded({ ...expanded, [g.event_id]: !open })}
                          className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{g.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {g.total} disparo{g.total > 1 ? "s" : ""} • último em{" "}
                              {new Date(g.last.created_at).toLocaleString("pt-BR")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusBadge(g.last.status)}
                            <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
                          </div>
                        </button>

                        {open && (
                          <div className="border-t divide-y">
                            {g.items.map((c) => {
                              const s = campaignStats[c.id];
                              const canShowStats = c.status === "sent" && !!c.egoi_campaign_id;
                              return (
                              <div key={c.id} className="p-3 text-sm space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {statusBadge(c.status)}
                                      {c.campaign_type === "ab_subject" && (() => {
                                        // Determina o vencedor entre pares A/B se ambos têm stats.
                                        const cfg = (c.ab_test_config || {}) as any;
                                        const metricKey = cfg.winner_metric === "clicks" ? "click_rate" : "open_rate";
                                        const partner = g.items.find(
                                          (x) => x.id !== c.id && x.ab_group_id === c.ab_group_id,
                                        );
                                        const myStats = campaignStats[c.id];
                                        const partnerStats = partner ? campaignStats[partner.id] : null;
                                        let winnerLabel: string | null = null;
                                        if (myStats && partnerStats) {
                                          const mine = (myStats as any)[metricKey] ?? 0;
                                          const theirs = (partnerStats as any)[metricKey] ?? 0;
                                          if (mine > theirs) winnerLabel = "🏆 Venceu";
                                          else if (mine < theirs) winnerLabel = "Perdeu";
                                          else winnerLabel = "Empate";
                                        }
                                        return (
                                          <>
                                            <Badge variant="outline" className="text-xs">A/B {c.ab_variant || "?"}</Badge>
                                            {winnerLabel && (
                                              <Badge className="text-xs" variant={winnerLabel.includes("Venceu") ? "default" : "secondary"}>
                                                {winnerLabel} ({cfg.winner_metric === "clicks" ? "cliques" : "aberturas"})
                                              </Badge>
                                            )}
                                          </>
                                        );
                                      })()}
                                      <span className="text-xs text-muted-foreground">
                                        {c.mode} • {new Date(c.created_at).toLocaleString("pt-BR")}
                                      </span>
                                      {c.egoi_campaign_id && (
                                        <span className="text-xs text-muted-foreground">
                                          E-goi #{c.egoi_campaign_id}
                                        </span>
                                      )}
                                    </div>
                                    {c.error_message && (
                                      <div className="text-xs text-red-500 mt-1 break-words">{c.error_message}</div>
                                    )}
                                  </div>
                                  {canShowStats && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={!masterEnabled || refreshingStatsId === c.id}
                                      onClick={() => refreshCampaignStats(c.id)}
                                      title={masterEnabled ? "Puxar métricas da E-goi" : "Master switch desligado"}
                                    >
                                      <RefreshCw className={`w-4 h-4 mr-1 ${refreshingStatsId === c.id ? "animate-spin" : ""}`} />
                                      {s ? "Atualizar" : "Carregar métricas"}
                                    </Button>
                                  )}
                                </div>
                                {canShowStats && s && (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                                    <div className="rounded border p-2 bg-background">
                                      <div className="text-[10px] uppercase text-muted-foreground">Envios</div>
                                      <div className="text-lg font-semibold">{s.delivered || s.sent || 0}</div>
                                    </div>
                                    <div className="rounded border p-2 bg-background">
                                      <div className="text-[10px] uppercase text-muted-foreground">Abertura</div>
                                      <div className="text-lg font-semibold">{s.open_rate ?? 0}%</div>
                                      <div className="text-[10px] text-muted-foreground">{s.opens_unique || 0} únicas</div>
                                    </div>
                                    <div className="rounded border p-2 bg-background">
                                      <div className="text-[10px] uppercase text-muted-foreground">Cliques</div>
                                      <div className="text-lg font-semibold">{s.click_rate ?? 0}%</div>
                                      <div className="text-[10px] text-muted-foreground">{s.clicks_unique || 0} únicos</div>
                                    </div>
                                    <div className="rounded border p-2 bg-background">
                                      <div className="text-[10px] uppercase text-muted-foreground">Baixas</div>
                                      <div className="text-lg font-semibold">{s.unsubscribes || 0}</div>
                                      <div className="text-[10px] text-muted-foreground">{s.bounces || 0} bounces</div>
                                    </div>
                                    {s.fetched_at && (
                                      <div className="col-span-2 md:col-span-4 text-[10px] text-muted-foreground text-right">
                                        Atualizado em {new Date(s.fetched_at).toLocaleString("pt-BR")}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                            <div className="p-3 bg-muted/20 flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={dispatchingId === g.event_id}
                                onClick={() => dispatchNow(g.event_id, { forceResend: true })}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                {dispatchingId === g.event_id ? "Criando..." : "Criar rascunho agora"}
                              </Button>
                              <SendNowButton
                                eventTitle={g.title}
                                disabled={dispatchingId === g.event_id}
                                onConfirm={() => dispatchNow(g.event_id, { sendNow: true, forceResend: true })}
                              />
                              <AbTestButton
                                eventTitle={g.title}
                                defaultSubject={`Novo evento: ${g.title}`}
                                disabled={dispatchingId === g.event_id}
                                onConfirm={(p) => dispatchAbTest(g.event_id, p)}
                              />



                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Send className="w-4 h-4 mr-2" /> Liberar reenvio
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar reenvio</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Isso limpa o marcador de disparo do evento <b>{g.title}</b>. Na próxima
                                      ação de envio, uma <b>nova</b> campanha será criada (o histórico anterior é
                                      preservado). Tem certeza?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => resendEvent(g.event_id)}>
                                      Sim, liberar reenvio
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default EmailConfig;
