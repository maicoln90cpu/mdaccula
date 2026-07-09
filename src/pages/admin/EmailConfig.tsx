import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NavLink } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save, ShieldAlert, ShieldCheck, Send, Eye } from "lucide-react";
import { useToast } from "@/hooks/useToast";

type Mode = "draft" | "immediate" | "scheduled";

type EgoiConfig = {
  id?: string;
  list_id: number | null;
  sender_id: number | null;
  mode: Mode;
  is_enabled: boolean;
  scheduled_days_before: number;
};

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

const EmailConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [cfg, setCfg] = useState<EgoiConfig>({
    list_id: null,
    sender_id: null,
    mode: "draft",
    is_enabled: false,
    scheduled_days_before: 3,
  });
  const [lists, setLists] = useState<Array<{ list_id: number; internal_name?: string; public_name?: string }>>([]);
  const [senders, setSenders] = useState<Array<{ sender_id: number; email?: string; name?: string }>>([]);
  const [fetchingResources, setFetchingResources] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [master, config, hist] = await Promise.all([
        supabase.from("site_settings").select("value").eq("key", "egoi_email_enabled").maybeSingle(),
        supabase.from("egoi_config").select("*").maybeSingle(),
        supabase
          .from("event_email_campaigns")
          .select("*, events(title)")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      setMasterEnabled(master.data?.value === "true");
      if (config.data) {
        setCfg({
          id: config.data.id,
          list_id: config.data.list_id,
          sender_id: config.data.sender_id,
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

  const fetchEgoiResources = async () => {
    setFetchingResources(true);
    try {
      const { data, error } = await supabase.functions.invoke("egoi-resources");
      if (error) throw error;
      const l = data?.lists?.body;
      const s = data?.senders?.body;
      const listItems = Array.isArray(l) ? l : Array.isArray(l?.items) ? l.items : [];
      const senderItems = Array.isArray(s) ? s : Array.isArray(s?.items) ? s.items : [];
      setLists(listItems);
      setSenders(senderItems);
      toast({ title: "Recursos E-goi carregados", description: `${listItems.length} listas, ${senderItems.length} remetentes.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha ao buscar E-goi", description: e.message });
    } finally {
      setFetchingResources(false);
    }
  };

  const canEnableAuto = cfg.list_id !== null && cfg.sender_id !== null;

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        list_id: cfg.list_id,
        sender_id: cfg.sender_id,
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
  const groups: EventGroup[] = (() => {
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
  })();

  const statusBadge = (s: Campaign["status"]) => {
    const map: Record<Campaign["status"], string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>;
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

      {/* Seção 1 — Status (kill switch 2 níveis) */}
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

      {/* Seção 2 — Configuração */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de envio</CardTitle>
          <CardDescription>Lista de destino, remetente e modo de disparo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchEgoiResources} disabled={fetchingResources}>
              <RefreshCw className={`w-4 h-4 mr-2 ${fetchingResources ? "animate-spin" : ""}`} />
              Buscar listas e remetentes da E-goi
            </Button>
            <span className="text-xs text-muted-foreground">
              {lists.length > 0 || senders.length > 0
                ? `${lists.length} listas • ${senders.length} remetentes carregados`
                : "Clique para popular os selects (usa sua API key)."}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Lista (list_id)</Label>
              {lists.length > 0 ? (
                <Select
                  value={cfg.list_id?.toString() ?? ""}
                  onValueChange={(v) => setCfg({ ...cfg, list_id: Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a lista" /></SelectTrigger>
                  <SelectContent>
                    {lists.map((l) => (
                      <SelectItem key={l.list_id} value={l.list_id.toString()}>
                        {l.internal_name || l.public_name || `Lista ${l.list_id}`} (#{l.list_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  placeholder="Ex: 12345"
                  value={cfg.list_id ?? ""}
                  onChange={(e) => setCfg({ ...cfg, list_id: e.target.value ? Number(e.target.value) : null })}
                />
              )}
            </div>

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
                        {s.name || s.email || `Sender ${s.sender_id}`} (#{s.sender_id})
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

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Teste */}
      <Card>
        <CardHeader>
          <CardTitle>Teste e preview</CardTitle>
          <CardDescription>Valide o visual antes de qualquer disparo real.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <NavLink to="/admin/email-preview">
              <Eye className="w-4 h-4 mr-2" /> Abrir preview do template
            </NavLink>
          </Button>
          <Button variant="outline" disabled title="Disponível após a Fase B.3 (integração de disparo)">
            <Send className="w-4 h-4 mr-2" /> Criar rascunho de teste (em breve)
          </Button>
        </CardContent>
      </Card>

      {/* Seção 4 — Histórico agrupado */}
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
    </main>
  );
};

export default EmailConfig;
