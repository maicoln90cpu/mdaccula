/**
 * EmailEventsTab — aba unificada "Histórico e controle" da tela Admin →
 * Gestão de e-mails.
 *
 * Substitui as antigas abas separadas "Controle pessoal"
 * (EmailPersonalControl.tsx, removido) e "Histórico" (HistoryTab.tsx,
 * removido), que liam a mesma tabela (event_email_campaigns) de formas
 * incompatíveis — uma period-scoped por evento, outra pelas últimas 200
 * campanhas globais sem filtro de data.
 *
 * Aqui: uma linha por evento no período selecionado (status da última
 * campanha + ações rápidas de marcação manual, como o Controle pessoal
 * fazia), que expande para o histórico completo daquele evento (todas as
 * campanhas, métricas sob demanda, teste A/B, liberar reenvio — como o
 * Histórico fazia). "Eventos sem rascunho" não é mais um card separado:
 * é só o filtro de status "Não disparado" (todo evento no período sem
 * nenhuma linha em event_email_campaigns cai nele).
 */
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/useToast";
import {
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink, RefreshCw, Send, Undo2,
} from "lucide-react";
import { formatDateTimeBR } from "@/lib/formatters";
import { buildEmailMeta } from "@/lib/emailTemplates/emailMeta";
import { dispatchAbSubjectTest } from "@/lib/emailTemplates/dispatchEventDraft";
import { AbTestButton } from "./AbTestButton";
import type { Template } from "@/lib/emailTemplates/blocks";
import type { Campaign, CampaignStatsMap } from "./types";

type PeriodFilter = "next7" | "next30" | "future" | "past30" | "all";
type SummaryStatus = "pending" | "draft" | "sent" | "manual" | "failed";
type StatusFilter = "all" | SummaryStatus;

type EventLite = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  slug: string | null;
  venue: string | null;
  location_city: string | null;
  location_state: string | null;
};

type EventEntry = {
  event: EventLite;
  campaigns: Campaign[]; // ordenadas created_at desc — [0] é a mais recente
};

interface EmailEventsTabProps {
  templates: Template[];
  masterEnabled: boolean;
  prepareManualSend: (eventId: string) => void;
}

function periodRange(period: PeriodFilter): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "past30") {
    const from = new Date(today); from.setDate(from.getDate() - 30);
    return { from: iso(from), to: iso(today) };
  }
  if (period === "next7") {
    const to = new Date(today); to.setDate(to.getDate() + 7);
    return { from: iso(today), to: iso(to) };
  }
  if (period === "next30") {
    const to = new Date(today); to.setDate(to.getDate() + 30);
    return { from: iso(today), to: iso(to) };
  }
  if (period === "all") {
    const from = new Date(today); from.setFullYear(from.getFullYear() - 5);
    const to = new Date(today); to.setFullYear(to.getFullYear() + 5);
    return { from: iso(from), to: iso(to) };
  }
  // future = todos os futuros (limite alto)
  const to = new Date(today); to.setFullYear(to.getFullYear() + 5);
  return { from: iso(today), to: iso(to) };
}

function summaryStatusOf(latest: Campaign | undefined): SummaryStatus {
  if (!latest) return "pending";
  if (latest.mode === "manual" && latest.status === "sent") return "manual";
  if (latest.status === "sent") return "sent";
  if (latest.status === "failed") return "failed";
  if (latest.status === "draft" || latest.status === "scheduled") return "draft";
  return "pending";
}

function summaryStatusBadge(s: SummaryStatus) {
  switch (s) {
    case "sent": return <Badge className="bg-green-600 hover:bg-green-600">Enviado</Badge>;
    case "manual": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Enviado manualmente</Badge>;
    case "draft": return <Badge variant="secondary">Rascunho na E-goi</Badge>;
    case "failed": return <Badge variant="destructive">Erro</Badge>;
    default: return <Badge variant="outline">Não disparado</Badge>;
  }
}

function campaignStatusBadge(s: Campaign["status"]) {
  const map: Record<Campaign["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>;
}

function fmtDate(date: string, time: string | null) {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return time ? `${label} • ${time.slice(0, 5)}` : label;
  } catch { return date; }
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const QUERY_KEY_PREFIX = "email-events-unified";

export function EmailEventsTab({ templates, masterEnabled, prepareManualSend }: EmailEventsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodFilter>("next30");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [campaignStats, setCampaignStats] = useState<CampaignStatsMap>({});
  const [refreshingStatsId, setRefreshingStatsId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period), [period]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [QUERY_KEY_PREFIX, period],
    queryFn: async (): Promise<EventEntry[]> => {
      const { data: events, error: evErr } = await supabase
        .from("events")
        .select("id, title, date, time, slug, venue, location_city, location_state")
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true })
        .order("time", { ascending: true });
      if (evErr) throw evErr;
      const evs = (events ?? []) as EventLite[];
      if (evs.length === 0) return [];

      const ids = evs.map((e) => e.id);
      const { data: campaigns, error: cErr } = await (supabase.from as any)("event_email_campaigns")
        .select(
          "id, event_id, egoi_campaign_id, status, mode, error_message, sent_at, created_at, " +
          "campaign_type, ab_group_id, ab_variant, ab_test_config, scheduled_at, scheduled_send_attempts",
        )
        .in("event_id", ids)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;

      const byEvent = new Map<string, Campaign[]>();
      for (const c of (campaigns ?? []) as Campaign[]) {
        const arr = byEvent.get(c.event_id);
        if (arr) arr.push(c); else byEvent.set(c.event_id, [c]);
      }
      return evs.map((e) => ({ event: e, campaigns: byEvent.get(e.id) ?? [] }));
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<SummaryStatus, number> = { pending: 0, draft: 0, sent: 0, manual: 0, failed: 0 };
    for (const r of rows) c[summaryStatusOf(r.campaigns[0])]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return rows.filter((r) => {
      if (statusFilter !== "all" && summaryStatusOf(r.campaigns[0]) !== statusFilter) return false;
      if (!q) return true;
      const hay = norm(
        `${r.event.title} ${r.event.venue || ""} ${r.event.location_city || ""} ${r.event.location_state || ""}`,
      );
      return hay.includes(q);
    });
  }, [rows, statusFilter, search]);

  const defaultEventTemplate = useMemo(
    () => templates.find((t) => t.type === "event_new" && t.is_default) || templates.find((t) => t.type === "event_new") || null,
    [templates],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX] });

  async function markManual(entry: EventEntry) {
    const latest = entry.campaigns[0] ?? null;
    try {
      if (latest) {
        const { error } = await supabase
          .from("event_email_campaigns")
          .update({
            mode: "manual",
            status: "sent",
            sent_at: new Date().toISOString(),
            campaign_type: "manual",
            error_message: null,
          })
          .eq("id", latest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_email_campaigns")
          .insert({
            event_id: entry.event.id,
            mode: "manual",
            status: "sent",
            sent_at: new Date().toISOString(),
            campaign_type: "manual",
          });
        if (error) throw error;
      }
      toast({ title: "Marcado como enviado", description: entry.event.title });
      invalidate();
    } catch (e: unknown) {
      toast({ title: "Erro ao marcar", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function undoManual(entry: EventEntry) {
    const latest = entry.campaigns[0];
    if (!latest) return;
    try {
      if (latest.mode === "manual" && latest.campaign_type === "manual" && !latest.egoi_campaign_id) {
        const { error } = await supabase.from("event_email_campaigns").delete().eq("id", latest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_email_campaigns")
          .update({ mode: "draft", status: "draft", sent_at: null })
          .eq("id", latest.id);
        if (error) throw error;
      }
      toast({ title: "Marcação desfeita", description: entry.event.title });
      invalidate();
    } catch (e: unknown) {
      toast({ title: "Erro ao desfazer", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function resendEvent(eventId: string) {
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
      invalidate();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Erro", description: message });
    }
  }

  async function refreshCampaignStats(campaignId: string) {
    setRefreshingStatsId(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("egoi-campaign-stats", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; stats?: any; error?: string };
      if (!res?.ok || !res.stats) throw new Error(res?.error || "Resposta inválida da E-goi");
      setCampaignStats((prev) => ({
        ...prev,
        [campaignId]: { ...res.stats, fetched_at: new Date().toISOString() },
      }));
      toast({ title: "Métricas atualizadas" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Erro ao atualizar métricas", description: message });
    } finally {
      setRefreshingStatsId(null);
    }
  }

  async function dispatchAbTest(
    eventId: string,
    params: { subjectA: string; subjectB: string; winnerMetric: "opens" | "clicks"; sendNow: boolean },
  ) {
    setDispatchingId(eventId);
    try {
      const defaultTemplate = templates.find((t) => t.type === "event_new" && t.is_default)
        ?? templates.find((t) => t.type === "event_new");
      if (!defaultTemplate?.id) throw new Error("Nenhum template padrão de Evento está disponível para o teste A/B.");
      const res = await dispatchAbSubjectTest(eventId, { ...params, templateIdOverride: defaultTemplate.id });
      const sentA = res.variantA.ok && res.variantA.status === "sent";
      const sentB = res.variantB.ok && res.variantB.status === "sent";
      const draftA = res.variantA.ok && res.variantA.status === "draft";
      const draftB = res.variantB.ok && res.variantB.status === "draft";
      if (sentA && sentB) {
        toast({
          title: params.sendNow ? "Teste A/B enviado!" : "Rascunhos A e B criados",
          description: `Grupo ${res.groupId.slice(0, 8)} • A #${res.variantA.egoi_campaign_id ?? "?"} • B #${res.variantB.egoi_campaign_id ?? "?"}`,
        });
      } else if (params.sendNow && (draftA || draftB) && !res.variantA.error && !res.variantB.error) {
        toast({
          variant: "destructive",
          title: "Teste A/B criado, mas não enviado",
          description: `A: ${res.variantA.status ?? "?"} • B: ${res.variantB.status ?? "?"} — a E-goi manteve como rascunho`,
        });
      } else {
        const describe = (v: typeof res.variantA, sent: boolean) => (sent ? "ok" : v.error || v.reason || v.status || "falhou");
        toast({
          variant: "destructive",
          title: "Teste A/B com falhas",
          description: `A: ${describe(res.variantA, sentA)} • B: ${describe(res.variantB, sentB)}`,
        });
      }
      invalidate();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Erro no teste A/B", description: message });
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Histórico e controle de e-mails</CardTitle>
          <CardDescription>
            Acompanhe quais eventos já receberam disparo, marque manualmente e revise o histórico completo de cada um.
          </CardDescription>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <button type="button" onClick={() => setStatusFilter("pending")} className="cursor-pointer">
              <Badge variant="outline">{counts.pending} não disparados</Badge>
            </button>
            <button type="button" onClick={() => setStatusFilter("draft")} className="cursor-pointer">
              <Badge variant="secondary">{counts.draft} rascunhos</Badge>
            </button>
            <button type="button" onClick={() => setStatusFilter("sent")} className="cursor-pointer">
              <Badge className="bg-green-600 hover:bg-green-600">{counts.sent} enviados</Badge>
            </button>
            <button type="button" onClick={() => setStatusFilter("manual")} className="cursor-pointer">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">{counts.manual} manuais</Badge>
            </button>
            {counts.failed > 0 && (
              <button type="button" onClick={() => setStatusFilter("failed")} className="cursor-pointer">
                <Badge variant="destructive">{counts.failed} com erro</Badge>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Buscar (nome, cidade)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px]"
          />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="next7">Próximos 7 dias</SelectItem>
              <SelectItem value="next30">Próximos 30 dias</SelectItem>
              <SelectItem value="future">Todos os futuros</SelectItem>
              <SelectItem value="past30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Todos (±5 anos)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Não disparados</SelectItem>
              <SelectItem value="draft">Rascunho na E-goi</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="manual">Enviados manualmente</SelectItem>
              <SelectItem value="failed">Com erro</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum evento no período/status/busca selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const latest = entry.campaigns[0];
                  const s = summaryStatusOf(latest);
                  const isSentLike = s === "sent" || s === "manual";
                  const canUndoManual = latest?.mode === "manual" && latest?.status === "sent";
                  const open = !!expanded[entry.event.id];
                  return (
                    <Fragment key={entry.event.id}>
                      <TableRow>
                        <TableCell className="w-8">
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [entry.event.id]: !open }))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={open ? "Recolher histórico" : "Expandir histórico"}
                          >
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.event.title}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(entry.event.date, entry.event.time)}</div>
                        </TableCell>
                        <TableCell>{summaryStatusBadge(s)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTimeBR(latest?.sent_at ?? null)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{latest?.mode ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          {latest?.egoi_campaign_id && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`https://app.e-goi.com/campaigns/${latest.egoi_campaign_id}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />E-goi
                              </a>
                            </Button>
                          )}
                          {!isSentLike && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Marcar enviado
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Marcar como enviado manualmente?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso registra que <strong>{entry.event.title}</strong> teve o e-mail disparado
                                    manualmente pela E-goi. Você pode desfazer depois.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => markManual(entry)}>Confirmar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {canUndoManual && (
                            <Button variant="ghost" size="sm" onClick={() => undoManual(entry)}>
                              <Undo2 className="w-3.5 h-3.5 mr-1" />Desfazer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {open && (
                        <TableRow key={`${entry.event.id}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/20 p-0">
                            <div className="p-3 space-y-2">
                              {entry.campaigns.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  Nenhuma campanha registrada ainda para este evento.
                                </p>
                              ) : (
                                <div className="divide-y">
                                  {entry.campaigns.map((c) => {
                                    const stats = campaignStats[c.id];
                                    const canShowStats = c.status === "sent" && !!c.egoi_campaign_id;
                                    return (
                                      <div key={c.id} className="py-2 text-sm space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {campaignStatusBadge(c.status)}
                                              {c.campaign_type === "ab_subject" && (() => {
                                                const cfg = (c.ab_test_config || {}) as { winner_metric?: "opens" | "clicks" };
                                                const metricKey = cfg.winner_metric === "clicks" ? "click_rate" : "open_rate";
                                                const partner = entry.campaigns.find(
                                                  (x) => x.id !== c.id && x.ab_group_id === c.ab_group_id,
                                                );
                                                const myStats = campaignStats[c.id];
                                                const partnerStats = partner ? campaignStats[partner.id] : null;
                                                let winnerLabel: string | null = null;
                                                if (myStats && partnerStats) {
                                                  const mine = (myStats[metricKey] as number) ?? 0;
                                                  const theirs = (partnerStats[metricKey] as number) ?? 0;
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
                                                {c.mode} • {formatDateTimeBR(c.created_at)}
                                              </span>
                                              {c.egoi_campaign_id && (
                                                <span className="text-xs text-muted-foreground">E-goi #{c.egoi_campaign_id}</span>
                                              )}
                                              {c.status === "scheduled" && c.scheduled_at && (
                                                <span className="text-xs text-muted-foreground">
                                                  agendado p/ {formatDateTimeBR(c.scheduled_at)}
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
                                              {stats ? "Atualizar" : "Carregar métricas"}
                                            </Button>
                                          )}
                                        </div>
                                        {canShowStats && stats && (
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                                            <div className="rounded border p-2 bg-background">
                                              <div className="text-[10px] uppercase text-muted-foreground">Envios</div>
                                              <div className="text-lg font-semibold">{stats.delivered || stats.sent || 0}</div>
                                            </div>
                                            <div className="rounded border p-2 bg-background">
                                              <div className="text-[10px] uppercase text-muted-foreground">Abertura</div>
                                              <div className="text-lg font-semibold">{stats.open_rate ?? 0}%</div>
                                              <div className="text-[10px] text-muted-foreground">{stats.opens_unique || 0} únicas</div>
                                            </div>
                                            <div className="rounded border p-2 bg-background">
                                              <div className="text-[10px] uppercase text-muted-foreground">Cliques</div>
                                              <div className="text-lg font-semibold">{stats.click_rate ?? 0}%</div>
                                              <div className="text-[10px] text-muted-foreground">{stats.clicks_unique || 0} únicos</div>
                                            </div>
                                            <div className="rounded border p-2 bg-background">
                                              <div className="text-[10px] uppercase text-muted-foreground">Baixas</div>
                                              <div className="text-lg font-semibold">{stats.unsubscribes || 0}</div>
                                              <div className="text-[10px] text-muted-foreground">{stats.bounces || 0} bounces</div>
                                            </div>
                                            {stats.fetched_at && (
                                              <div className="col-span-2 md:col-span-4 text-[10px] text-muted-foreground text-right">
                                                Atualizado em {formatDateTimeBR(stats.fetched_at)}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                                <Button size="sm" variant="secondary" onClick={() => prepareManualSend(entry.event.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Preparar novo envio
                                </Button>
                                <AbTestButton
                                  eventTitle={entry.event.title}
                                  defaultSubject={
                                    buildEmailMeta(defaultEventTemplate?.subject_template, null, {
                                      eventTitle: entry.event.title,
                                    }).subject || entry.event.title
                                  }
                                  disabled={dispatchingId === entry.event.id}
                                  onConfirm={(p) => dispatchAbTest(entry.event.id, p)}
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
                                        Isso limpa o marcador de disparo do evento <b>{entry.event.title}</b>. Na próxima
                                        ação de envio, uma <b>nova</b> campanha será criada (o histórico anterior é
                                        preservado). Tem certeza?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => resendEvent(entry.event.id)}>
                                        Sim, liberar reenvio
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EmailEventsTab;
