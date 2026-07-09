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
  const [loading, setLoading] = useState(true);
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
  const [previewData, setPreviewData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);
  const [tpl, setTpl] = useState<EmailTemplateSettings & { id?: string }>({});
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [realEvents, setRealEvents] = useState<Array<{ id: string; title: string; slug: string; date: string; time: string; venue: string; location_city: string; location_state: string; image_url: string | null; description: string | null; subtitle: string | null; ticket_link: string | null; vip_link: string | null; blog_post_id: string | null }>>([]);
  const [selectedRealEventId, setSelectedRealEventId] = useState<string>("mock");
  const [previewArticle, setPreviewArticle] = useState<ArticleSummary | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");

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
      const [master, config, hist, tplRes, cacheRes, tplList, evts] = await Promise.all([
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
          .select("id,title,slug,date,time,venue,location_city,location_state,image_url,description,subtitle,ticket_link,vip_link,blog_post_id")
          .order("date", { ascending: false })
          .limit(30),
      ]);

      setMasterEnabled(master.data?.value === "true");
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

  const previewHtml = useMemo(() => renderEventAnnouncementEmail(previewData, tpl), [previewData, tpl]);

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


  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

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

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="template">Template (marca)</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
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
                  <div className="font-medium">Master (Lovable)</div>
                  <div className="text-xs text-muted-foreground">
                    Controlado pela agência. Trave global — só a Lovable/agência altera.
                  </div>
                </div>
                <Badge variant={masterEnabled ? "default" : "secondary"}>
                  {masterEnabled ? "ON" : "OFF"}
                </Badge>
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

          {/* Teste */}
          <Card>
            <CardHeader>
              <CardTitle>Teste de disparo</CardTitle>
              <CardDescription>Criar campanha real na E-goi como rascunho para revisão.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled title="Disponível após a Fase B.3 (integração de disparo)">
                <Send className="w-4 h-4 mr-2" /> Criar rascunho de teste (em breve)
              </Button>
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
                  <CardTitle>Textos e links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Texto do botão principal (CTA)</Label>
                    <Input
                      value={tpl.cta_label ?? ""}
                      placeholder="Garantir ingresso"
                      onChange={(e) => setTpl({ ...tpl, cta_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Texto do link secundário</Label>
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
                  <div>
                    <Label>Instagram URL</Label>
                    <Input value={tpl.instagram_url ?? ""} onChange={(e) => setTpl({ ...tpl, instagram_url: e.target.value })} />
                  </div>
                  <div>
                    <Label>YouTube URL</Label>
                    <Input value={tpl.youtube_url ?? ""} onChange={(e) => setTpl({ ...tpl, youtube_url: e.target.value })} />
                  </div>
                  <div>
                    <Label>TikTok URL</Label>
                    <Input value={tpl.tiktok_url ?? ""} onChange={(e) => setTpl({ ...tpl, tiktok_url: e.target.value })} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Blocos visíveis</CardTitle>
                  <CardDescription>Ligue/desligue seções do template.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {([
                    ["show_subtitle", "Subtítulo do evento"],
                    ["show_description", "Descrição do evento"],
                    ["show_socials", "Links de redes sociais no rodapé"],
                    ["show_secondary_link", "Link secundário (agenda)"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <Label className="cursor-pointer">{label}</Label>
                      <Switch
                        checked={(tpl as any)[key] !== false}
                        onCheckedChange={(v) => setTpl({ ...tpl, [key]: v })}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>HTML customizado (avançado)</CardTitle>
                  <CardDescription>
                    Blocos extras acima/abaixo do e-mail. <b>Scripts, styles e handlers on* são removidos automaticamente.</b>
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
              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="space-y-3">
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
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewData(MOCK_EVENT_DATA)}>
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
                    Para editar logo, cores e textos fixos, use a aba <b>Template (marca)</b>.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-[#050505] p-4">
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="mx-auto block h-[900px] w-full max-w-[640px] rounded-md border-0 bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= HISTÓRICO ================= */}
        <TabsContent value="history" className="space-y-4">
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
                            {g.items.map((c) => (
                              <div key={c.id} className="p-3 text-sm flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {statusBadge(c.status)}
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
                              </div>
                            ))}
                            <div className="p-3 bg-muted/20 flex justify-end">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Send className="w-4 h-4 mr-2" /> Reenviar para este evento
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
