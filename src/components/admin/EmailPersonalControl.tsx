import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CheckCircle2, ExternalLink, RefreshCw, Undo2 } from "lucide-react";

type PeriodFilter = "next7" | "next30" | "future" | "past30";
type StatusFilter = "all" | "pending" | "sent" | "draft" | "failed" | "manual";

type CampaignRow = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  status: string | null;
  mode: string | null;
  campaign_type: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  slug: string | null;
};

type Combined = {
  event: EventRow;
  campaign: CampaignRow | null;
};

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
  // future = todos os futuros (limite alto)
  const to = new Date(today); to.setFullYear(to.getFullYear() + 5);
  return { from: iso(today), to: iso(to) };
}

function statusOf(c: CampaignRow | null): StatusFilter {
  if (!c) return "pending";
  if (c.mode === "manual" && c.status === "sent") return "manual";
  if (c.status === "sent") return "sent";
  if (c.status === "failed") return "failed";
  if (c.status === "draft" || c.status === "scheduled") return "draft";
  return "pending";
}

function statusBadge(s: StatusFilter) {
  switch (s) {
    case "sent": return <Badge className="bg-green-600 hover:bg-green-600">Enviado</Badge>;
    case "manual": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Enviado manualmente</Badge>;
    case "draft": return <Badge variant="secondary">Rascunho na E-goi</Badge>;
    case "failed": return <Badge variant="destructive">Erro</Badge>;
    default: return <Badge variant="outline">Não disparado</Badge>;
  }
}

function fmtDate(date: string, time: string | null) {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return time ? `${label} • ${time.slice(0, 5)}` : label;
  } catch { return date; }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

export function EmailPersonalControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodFilter>("next30");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const range = useMemo(() => periodRange(period), [period]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["email-personal-control", period],
    queryFn: async (): Promise<Combined[]> => {
      const { data: events, error: evErr } = await supabase
        .from("events")
        .select("id, title, date, time, slug")
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true })
        .order("time", { ascending: true });
      if (evErr) throw evErr;
      const evs = (events ?? []) as EventRow[];
      if (evs.length === 0) return [];

      const ids = evs.map((e) => e.id);
      const { data: campaigns, error: cErr } = await supabase
        .from("event_email_campaigns")
        .select("id, event_id, egoi_campaign_id, status, mode, campaign_type, sent_at, created_at, updated_at")
        .in("event_id", ids)
        .order("updated_at", { ascending: false });
      if (cErr) throw cErr;

      const latestByEvent = new Map<string, CampaignRow>();
      for (const c of (campaigns ?? []) as CampaignRow[]) {
        if (!latestByEvent.has(c.event_id)) latestByEvent.set(c.event_id, c);
      }
      return evs.map((e) => ({ event: e, campaign: latestByEvent.get(e.id) ?? null }));
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => statusOf(r.campaign) === statusFilter);
  }, [rows, statusFilter]);

  const counts = useMemo(() => {
    const c = { pending: 0, draft: 0, sent: 0, manual: 0, failed: 0 };
    for (const r of rows) {
      const s = statusOf(r.campaign);
      c[s as keyof typeof c] = (c[s as keyof typeof c] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  async function markManual(row: Combined) {
    try {
      if (row.campaign) {
        const { error } = await supabase
          .from("event_email_campaigns")
          .update({
            mode: "manual",
            status: "sent",
            sent_at: new Date().toISOString(),
            campaign_type: "manual",
            error_message: null,
          })
          .eq("id", row.campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_email_campaigns")
          .insert({
            event_id: row.event.id,
            mode: "manual",
            status: "sent",
            sent_at: new Date().toISOString(),
            campaign_type: "manual",
          });
        if (error) throw error;
      }
      toast({ title: "Marcado como enviado", description: row.event.title });
      queryClient.invalidateQueries({ queryKey: ["email-personal-control"] });
    } catch (e: any) {
      toast({ title: "Erro ao marcar", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function undoManual(row: Combined) {
    if (!row.campaign) return;
    try {
      // Se a campanha só existe por causa da marcação manual, apagamos.
      // Caso contrário (existia rascunho/envio real antes), apenas revertemos.
      if (row.campaign.mode === "manual" && row.campaign.campaign_type === "manual" && !row.campaign.egoi_campaign_id) {
        const { error } = await supabase.from("event_email_campaigns").delete().eq("id", row.campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_email_campaigns")
          .update({ mode: "draft", status: "draft", sent_at: null })
          .eq("id", row.campaign.id);
        if (error) throw error;
      }
      toast({ title: "Marcação desfeita", description: row.event.title });
      queryClient.invalidateQueries({ queryKey: ["email-personal-control"] });
    } catch (e: any) {
      toast({ title: "Erro ao desfazer", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Controle pessoal de e-mails</CardTitle>
          <CardDescription>
            Acompanhe quais eventos já receberam disparo e marque manualmente enquanto a automação estiver desligada.
          </CardDescription>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{counts.pending} não disparados</Badge>
            <Badge variant="secondary">{counts.draft} rascunhos</Badge>
            <Badge className="bg-green-600 hover:bg-green-600">{counts.sent} enviados</Badge>
            <Badge className="bg-emerald-600 hover:bg-emerald-600">{counts.manual} manuais</Badge>
            {counts.failed > 0 && <Badge variant="destructive">{counts.failed} com erro</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="next7">Próximos 7 dias</SelectItem>
              <SelectItem value="next30">Próximos 30 dias</SelectItem>
              <SelectItem value="future">Todos os futuros</SelectItem>
              <SelectItem value="past30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
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
            Nenhum evento no período/status selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const s = statusOf(row.campaign);
                  const isSentLike = s === "sent" || s === "manual";
                  const canUndoManual = row.campaign?.mode === "manual" && row.campaign?.status === "sent";
                  return (
                    <TableRow key={row.event.id}>
                      <TableCell>
                        <div className="font-medium">{row.event.title}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(row.event.date, row.event.time)}</div>
                      </TableCell>
                      <TableCell>{statusBadge(s)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDateTime(row.campaign?.sent_at ?? null)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">{row.campaign?.mode ?? "—"}</TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {row.campaign?.egoi_campaign_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`https://app.e-goi.com/campaigns/${row.campaign.egoi_campaign_id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
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
                                  Isso registra que <strong>{row.event.title}</strong> teve o e-mail disparado
                                  manualmente pela E-goi. Você pode desfazer depois.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => markManual(row)}>Confirmar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {canUndoManual && (
                          <Button variant="ghost" size="sm" onClick={() => undoManual(row)}>
                            <Undo2 className="w-3.5 h-3.5 mr-1" />Desfazer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
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

export default EmailPersonalControl;
