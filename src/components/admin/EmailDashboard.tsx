import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, BarChart3, Mail, MousePointerClick, Eye, TrendingUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { formatCount } from "@/lib/formatters";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/** Métricas cacheadas em event_email_campaign_stats.stats_json (formato retornado pela edge egoi-campaign-stats). */
type CampaignStats = {
  sent?: number;
  delivered?: number;
  opens_unique?: number;
  clicks_unique?: number;
  bounces?: number;
  unsubscribes?: number;
  open_rate?: number;
  click_rate?: number;
};

type Row = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  status: string;
  mode: string;
  campaign_type: string | null;
  sent_at: string | null;
  created_at: string;
  event_title: string | null;
  stats: CampaignStats | null;
  fetched_at: string | null;
};

type Period = "7" | "30" | "90" | "365" | "custom";

const TYPE_LABEL: Record<string, string> = {
  standard: "Evento",
  ticket_batch: "Virada de lote",
  weekly_digest: "Digest semanal",
  weekend_agenda: "Agenda FDS",
  blog_digest: "Blog news",
  courtesy: "Cortesia",
  custom: "Custom",
  ab_test_a: "A/B (A)",
  ab_test_b: "A/B (B)",
};

const rateFmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(1)}%`;

export function EmailDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [period, setPeriod] = useState<Period>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const range = useMemo(() => {
    const now = new Date();
    if (period === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    }
    const days = period === "custom" ? 30 : parseInt(period, 10);
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return { from, to: now };
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Enviadas via sistema (exclui campaign_type = 'manual' — controle pessoal fica separado)
      const { data: camps, error } = await supabase
        .from("event_email_campaigns")
        .select("id,event_id,egoi_campaign_id,status,mode,campaign_type,sent_at,created_at,events(title)")
        .eq("status", "sent")
        .gte("sent_at", range.from.toISOString())
        .lte("sent_at", range.to.toISOString())
        .neq("campaign_type", "manual")
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const ids = (camps ?? []).map((c: any) => c.id);
      const statsMap = new Map<string, { stats: CampaignStats; fetched_at: string | null }>();
      if (ids.length > 0) {
        const { data: stats } = await (supabase.from as any)("event_email_campaign_stats")
          .select("campaign_id, stats_json, fetched_at")
          .in("campaign_id", ids);
        for (const s of stats ?? []) {
          statsMap.set(s.campaign_id, { stats: s.stats_json as CampaignStats, fetched_at: s.fetched_at });
        }
      }

      const built: Row[] = (camps ?? []).map((c: any) => ({
        id: c.id,
        event_id: c.event_id,
        egoi_campaign_id: c.egoi_campaign_id,
        status: c.status,
        mode: c.mode,
        campaign_type: c.campaign_type,
        sent_at: c.sent_at,
        created_at: c.created_at,
        event_title: c.events?.title ?? null,
        stats: statsMap.get(c.id)?.stats ?? null,
        fetched_at: statsMap.get(c.id)?.fetched_at ?? null,
      }));
      setRows(built);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao carregar dashboard", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => typeFilter === "all" ? rows : rows.filter((r) => (r.campaign_type || "standard") === typeFilter),
    [rows, typeFilter],
  );

  const kpis = useMemo(() => {
    let total = filtered.length;
    let sent = 0, delivered = 0, opens = 0, clicks = 0, bounces = 0, unsubs = 0;
    let withStats = 0;
    let openRateSum = 0, clickRateSum = 0;
    for (const r of filtered) {
      if (!r.stats) continue;
      withStats++;
      sent += r.stats.sent ?? 0;
      delivered += r.stats.delivered ?? 0;
      opens += r.stats.opens_unique ?? 0;
      clicks += r.stats.clicks_unique ?? 0;
      bounces += r.stats.bounces ?? 0;
      unsubs += r.stats.unsubscribes ?? 0;
      openRateSum += r.stats.open_rate ?? 0;
      clickRateSum += r.stats.click_rate ?? 0;
    }
    return {
      total,
      withStats,
      sent,
      delivered,
      opens,
      clicks,
      bounces,
      unsubs,
      openRateAvg: withStats > 0 ? openRateSum / withStats : null,
      clickRateAvg: withStats > 0 ? clickRateSum / withStats : null,
    };
  }, [filtered]);

  const chartData = useMemo(() => {
    // Envios agrupados por dia
    const map = new Map<string, number>();
    for (const r of filtered) {
      if (!r.sent_at) continue;
      const key = r.sent_at.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: date.slice(5), // MM-DD
        count,
      }));
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const t = r.campaign_type || "standard";
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type: TYPE_LABEL[type] ?? type, count }));
  }, [filtered]);

  const refreshAll = async () => {
    const targets = filtered.filter((r) => r.egoi_campaign_id);
    if (targets.length === 0) {
      toast({ title: "Nada para atualizar", description: "Nenhuma campanha com ID da E-goi no filtro atual." });
      return;
    }
    setRefreshingAll(true);
    let ok = 0, fail = 0;
    try {
      for (const r of targets) {
        try {
          const { data, error } = await supabase.functions.invoke("egoi-campaign-stats", {
            body: { campaign_id: r.id },
          });
          if (error) throw error;
          const res = data as { ok?: boolean; error?: string };
          if (res?.ok) ok++; else fail++;
        } catch {
          fail++;
        }
        // rate limit soft — 400ms entre chamadas
        await new Promise((r) => setTimeout(r, 400));
      }
      toast({
        title: "Métricas atualizadas",
        description: `${ok} sucesso · ${fail} falha(s).`,
        variant: fail > 0 ? "destructive" : undefined,
      });
      await load();
    } finally {
      setRefreshingAll(false);
    }
  };

  const availableTypes = useMemo(() => {
    // Combina tipos conhecidos (fixos) com tipos vistos nas campanhas — garante
    // que o filtro sempre exponha as opções mesmo antes de existir envio.
    const s = new Set<string>(Object.keys(TYPE_LABEL));
    for (const r of rows) s.add(r.campaign_type || "standard");
    return [...s];
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Dashboard de e-mails
          </CardTitle>
          <CardDescription>
            Métricas das campanhas <b>efetivamente enviadas pelo sistema</b> (via E-goi). Envios marcados manualmente ficam na aba Controle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div>
                  <Label>De</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Até</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label>Tipo de template</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t] ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
            </Button>
            <Button size="sm" onClick={refreshAll} disabled={refreshingAll || filtered.length === 0}>
              <TrendingUp className={`w-4 h-4 mr-2 ${refreshingAll ? "animate-spin" : ""}`} />
              {refreshingAll ? "Atualizando métricas..." : "Atualizar métricas do período"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {kpis.withStats}/{kpis.total} campanhas com métricas coletadas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Mail} label="Campanhas enviadas" value={formatCount(kpis.total)} />
        <Kpi icon={Mail} label="Contatos alcançados" value={formatCount(kpis.sent)} sub={`entregues: ${formatCount(kpis.delivered)}`} />
        <Kpi icon={Eye} label="Aberturas únicas" value={formatCount(kpis.opens)} sub={`taxa média: ${rateFmt(kpis.openRateAvg)}`} />
        <Kpi icon={MousePointerClick} label="Cliques únicos" value={formatCount(kpis.clicks)} sub={`taxa média: ${rateFmt(kpis.clickRateAvg)}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={AlertTriangle} label="Bounces" value={formatCount(kpis.bounces)} />
        <Kpi icon={AlertTriangle} label="Descadastros" value={formatCount(kpis.unsubs)} />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envios por dia</CardTitle>
            <CardDescription>Quantidade de campanhas disparadas por dia no período.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem envios no período selecionado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por tipo de template</CardTitle>
            <CardDescription>Distribuição de envios por categoria.</CardDescription>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhe por campanha</CardTitle>
          <CardDescription>
            Clique em "Atualizar métricas do período" para puxar dados atualizados da E-goi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma campanha enviada encontrada no período/filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Data</th>
                    <th className="pr-3">Tipo</th>
                    <th className="pr-3">Título / Evento</th>
                    <th className="pr-3 text-right">Enviados</th>
                    <th className="pr-3 text-right">Aberturas</th>
                    <th className="pr-3 text-right">Cliques</th>
                    <th className="pr-3 text-right">% Abertura</th>
                    <th className="pr-3 text-right">% Clique</th>
                    <th className="pr-3">E-goi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="pr-3">
                        <Badge variant="secondary" className="font-normal">
                          {TYPE_LABEL[r.campaign_type || "standard"] ?? r.campaign_type}
                        </Badge>
                      </td>
                      <td className="pr-3 max-w-[280px] truncate">{r.event_title ?? "—"}</td>
                      <td className="pr-3 text-right tabular-nums">{formatCount(r.stats?.sent)}</td>
                      <td className="pr-3 text-right tabular-nums">{formatCount(r.stats?.opens_unique)}</td>
                      <td className="pr-3 text-right tabular-nums">{formatCount(r.stats?.clicks_unique)}</td>
                      <td className="pr-3 text-right tabular-nums">{rateFmt(r.stats?.open_rate)}</td>
                      <td className="pr-3 text-right tabular-nums">{rateFmt(r.stats?.click_rate)}</td>
                      <td className="pr-3">
                        {r.egoi_campaign_id ? (
                          <span className="text-xs text-muted-foreground">#{r.egoi_campaign_id}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
