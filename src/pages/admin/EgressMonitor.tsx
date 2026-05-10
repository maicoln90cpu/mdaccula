import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, HardDrive, Gauge, TrendingUp, RefreshCw, ExternalLink, Server, Database, Globe, Users, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

// ---------------- Types ----------------
interface EgressRow {
  id: string; period_start: string; api_path: string; source: string;
  egress_bytes: number; cache_hits: number; cache_misses: number; created_at: string;
}
interface SupabaseUsageResp {
  apiCounts: { totals: { auth: number; rest: number; storage: number; realtime: number }; series: Array<{ timestamp: string; auth: number; rest: number; storage: number; realtime: number }>; totalRequests: number };
  health: Array<{ name: string; healthy: boolean; status: string }>;
  auth: { totalUsers: number };
  storage: { buckets: Array<{ bucket: string; bytes: number; files: number }>; totalBytes: number; totalFiles: number };
  tables: Record<string, number>;
  db?: { sizeBytes: number };
  edgeFunctions?: { totalInvocations: number; source?: string; windowDays?: number | null };
  fetchedAt: string;
}
interface BunnyResp {
  window: { dateFrom: string; dateTo: string; days: number; mode?: string };
  chunks?: { ok: number; errors: number; stopReason?: string };
  estimatedCostUSD?: number;
  pullZone: {
    bandwidthBytes: number; originBytes: number; requests: number; cacheHitRate: number; avgOriginResponseMs: number;
    errors: { err3xx: number; err4xx: number; err5xx: number };
    charts: Record<string, Array<{ t: string; v: number }>>;
    geo: Record<string, number>;
  };
  storage: { bytesUsed: number; files: number; region: string; charts: { storageUsed: Array<{ t: string; v: number }>; fileCount: Array<{ t: string; v: number }> } };
  fetchedAt: string;
}
interface SnapshotRow {
  day: string;
  supabase: { requests?: { total: number }; storage?: { totalBytes: number; totalFiles: number }; users?: number };
  bunny: { lifetime?: { bandwidthBytes: number; requests: number; cacheHitRate: number }; storage?: { bytesUsed: number; files: number } };
  captured_at: string;
}

// ---------------- Helpers ----------------
const formatBytes = (b: number) => {
  if (!b) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
const formatBytesShort = (b: number) => {
  if (!b) return "0";
  const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + sizes[i];
};
const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)", "hsl(340, 65%, 50%)", "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)", "hsl(15, 75%, 50%)",
];
const SERVICE_COLORS: Record<string, string> = {
  auth: "hsl(210, 70%, 55%)", rest: "hsl(var(--primary))",
  storage: "hsl(150, 60%, 45%)", realtime: "hsl(280, 60%, 55%)",
};

const BILLING_URL = "https://supabase.com/dashboard/project/xfvpuzlspvvsmmunznxw/settings/billing/usage";
const BUNNY_DASHBOARD = "https://dash.bunny.net/cdn";

// ---------------- Component ----------------
const EgressMonitor = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // Tab 1 — internal SW estimate
  const [internalRows, setInternalRows] = useState<EgressRow[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);

  // Tab 2 — Supabase official
  const [sbData, setSbData] = useState<SupabaseUsageResp | null>(null);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState<string | null>(null);

  // Tab 3 — Bunny official
  const [bunny, setBunny] = useState<BunnyResp | null>(null);
  const [bunnyLoading, setBunnyLoading] = useState(false);
  const [bunnyError, setBunnyError] = useState<string | null>(null);
  const [bunnyMode, setBunnyMode] = useState<"lifetime" | "range">("lifetime");

  // Tab 4 — snapshots history
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const fetchInternal = useCallback(async () => {
    setInternalLoading(true);
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data: rows } = await supabase.from("egress_metrics").select("*")
      .gte("period_start", since.toISOString()).order("period_start", { ascending: true });
    setInternalRows((rows as EgressRow[]) || []);
    setInternalLoading(false);
  }, [days]);

  const fetchSupabase = useCallback(async () => {
    setSbLoading(true); setSbError(null);
    const { data, error } = await supabase.functions.invoke("supabase-usage", { body: { interval: "7day" } });
    if (error) { setSbError(error.message || "Falha ao consultar"); }
    else if ((data as { error?: string })?.error) { setSbError((data as { error: string }).error); }
    else setSbData(data as SupabaseUsageResp);
    setSbLoading(false);
  }, []);

  const fetchBunny = useCallback(async () => {
    setBunnyLoading(true); setBunnyError(null);
    const body = bunnyMode === "lifetime" ? { mode: "lifetime" } : { mode: "range", days };
    const { data, error } = await supabase.functions.invoke("bunny-stats", { body });
    if (error) setBunnyError(error.message || "Falha ao consultar Bunny");
    else if ((data as { error?: string })?.error) setBunnyError((data as { error: string }).error);
    else setBunny(data as BunnyResp);
    setBunnyLoading(false);
  }, [days, bunnyMode]);

  const fetchSnapshots = useCallback(async () => {
    setSnapLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("metrics_snapshots").select("*").order("day", { ascending: true }).limit(365);
    setSnapshots((data as SnapshotRow[]) || []);
    setSnapLoading(false);
  }, []);

  const captureNow = useCallback(async () => {
    setCapturing(true); setCaptureMsg(null);
    const { data, error } = await supabase.functions.invoke("metrics-snapshot", { body: {} });
    if (error) setCaptureMsg("Erro: " + error.message);
    else if ((data as { error?: string })?.error) setCaptureMsg("Erro: " + (data as { error: string }).error);
    else { setCaptureMsg("Snapshot capturado: " + (data as { day: string }).day); await fetchSnapshots(); }
    setCapturing(false);
  }, [fetchSnapshots]);

  useEffect(() => { fetchInternal(); fetchSupabase(); fetchBunny(); fetchSnapshots(); }, [fetchInternal, fetchSupabase, fetchBunny, fetchSnapshots]);

  // ---- Computed: internal ----
  const totalInternalBytes = internalRows.reduce((s, r) => s + r.egress_bytes, 0);
  const totalHits = internalRows.reduce((s, r) => s + r.cache_hits, 0);
  const totalMisses = internalRows.reduce((s, r) => s + r.cache_misses, 0);
  const cacheRate = totalHits + totalMisses > 0 ? Math.round((totalHits / (totalHits + totalMisses)) * 100) : 0;
  const dailyAvg = totalInternalBytes / (days || 1);
  const monthlyProjection = dailyAvg * 30;
  const FREE_TIER = 5 * 1024 * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((monthlyProjection / FREE_TIER) * 100));

  const dailyMap = new Map<string, number>();
  internalRows.forEach((r) => {
    const day = r.period_start.substring(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + r.egress_bytes);
  });
  const dailyChart = Array.from(dailyMap.entries()).map(([date, bytes]) => ({ date, bytes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const resourceMap = new Map<string, number>();
  internalRows.forEach((r) => {
    const key = r.api_path.replace("/rest/v1/", "").split("?")[0];
    resourceMap.set(key, (resourceMap.get(key) || 0) + r.egress_bytes);
  });
  const resourceRanking = Array.from(resourceMap.entries())
    .map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes).slice(0, 10);

  // ---- Combined real total ----
  const bunnyEgressGB = bunny ? bunny.pullZone.bandwidthBytes / (1024 ** 3) : 0;

  // ---- Geo (top 10) ----
  const geoTop = bunny ? Object.entries(bunny.pullZone.geo).map(([country, v]) => ({ country, v: Number(v) }))
    .sort((a, b) => b.v - a.v).slice(0, 10) : [];

  const chartConfig = {
    bytes: { label: "Bytes", color: "hsl(var(--primary))" },
    v: { label: "Valor", color: "hsl(var(--primary))" },
    rate: { label: "Cache %", color: "hsl(150, 60%, 45%)" },
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold hero-text">Métricas Reais</h1>
                  <p className="text-muted-foreground text-sm">Supabase + Bunny CDN consolidados</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                  <TabsList>
                    <TabsTrigger value="7d">7 dias</TabsTrigger>
                    <TabsTrigger value="30d">30 dias</TabsTrigger>
                    <TabsTrigger value="90d">90 dias</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="outline" size="icon" onClick={() => { fetchInternal(); fetchSupabase(); fetchBunny(); }}>
                  <RefreshCw className={`h-4 w-4 ${(internalLoading || sbLoading || bunnyLoading) ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* (banner global removido — métricas Bunny ficam apenas dentro da aba Bunny CDN) */}

            <Tabs defaultValue="bunny" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="bunny">Bunny CDN (oficial)</TabsTrigger>
                <TabsTrigger value="supabase">Supabase (oficial)</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="internal">Estimativa Interna (SW)</TabsTrigger>
              </TabsList>

              {/* ============ BUNNY TAB ============ */}
              <TabsContent value="bunny" className="space-y-6">
                <div className="flex items-center gap-2">
                  <Tabs value={bunnyMode} onValueChange={(v) => setBunnyMode(v as "lifetime" | "range")}>
                    <TabsList>
                      <TabsTrigger value="lifetime">Lifetime (total)</TabsTrigger>
                      <TabsTrigger value="range">Últimos {days}d</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {bunnyError ? (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {bunnyError}
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Custo estimado (USD)</CardDescription>
                      <CardTitle className="text-2xl">${(bunny?.estimatedCostUSD || 0).toFixed(2)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">@ ~$0.043/GB · {bunnyEgressGB.toFixed(2)} GB</p></CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Bandwidth</CardDescription>
                      <CardTitle className="text-2xl">{bunnyLoading ? "..." : formatBytes(bunny?.pullZone.bandwidthBytes || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{bunnyEgressGB.toFixed(2)} GB · {bunnyMode === "lifetime" ? "lifetime" : `${days}d`}</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Requests</CardDescription>
                      <CardTitle className="text-2xl">{bunnyLoading ? "..." : formatNumber(bunny?.pullZone.requests || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{bunny?.pullZone.requests.toLocaleString() || "0"} total</p></CardContent>
                  </Card>
                  <Card variant="success">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Cache Hit</CardDescription>
                      <CardTitle className="text-2xl">{bunnyLoading ? "..." : (bunny?.pullZone.cacheHitRate || 0).toFixed(1)}%</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">Origin: {formatBytes(bunny?.pullZone.originBytes || 0)}</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Storage</CardDescription>
                      <CardTitle className="text-2xl">{bunnyLoading ? "..." : formatBytes(bunny?.storage.bytesUsed || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{bunny?.storage.files || 0} arquivos · {bunny?.storage.region}</p></CardContent>
                  </Card>
                  <Card variant={(bunny?.pullZone.errors.err5xx || 0) > 100 ? "warning" : "metric"}>
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Erros</CardDescription>
                      <CardTitle className="text-2xl">{(bunny?.pullZone.errors.err4xx || 0) + (bunny?.pullZone.errors.err5xx || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">4xx: {bunny?.pullZone.errors.err4xx || 0} · 5xx: {bunny?.pullZone.errors.err5xx || 0}</p></CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Bandwidth Diário</CardTitle>
                      <CardDescription>Total vs Cached</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ChartContainer config={chartConfig} className="h-[260px] w-full">
                        <AreaChart data={(bunny?.pullZone.charts.bandwidth || []).map((d, i) => ({
                          date: d.t.substring(5, 10),
                          total: d.v,
                          cached: bunny?.pullZone.charts.bandwidthCached[i]?.v || 0,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                          <Area type="monotone" dataKey="total" stackId="1" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" />
                          <Area type="monotone" dataKey="cached" stackId="2" fill="hsl(150, 60%, 45% / 0.3)" stroke="hsl(150, 60%, 45%)" />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Cache Hit Rate</CardTitle>
                      <CardDescription>Eficiência diária do CDN</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ChartContainer config={chartConfig} className="h-[260px] w-full">
                        <LineChart data={(bunny?.pullZone.charts.cacheHitRate || []).map((d) => ({ date: d.t.substring(5, 10), rate: d.v }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" width={45} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${(v as number).toFixed(1)}%`} />} />
                          <Line type="monotone" dataKey="rate" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Distribuição Geográfica</CardTitle>
                      <CardDescription>Top 10 países por tráfego</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {geoTop.length ? (
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                          <BarChart data={geoTop} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis type="number" tickFormatter={(v) => formatBytesShort(v)} className="text-xs" />
                            <YAxis type="category" dataKey="country" width={50} className="text-xs" />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                            <Bar dataKey="v" radius={[0, 4, 4, 0]}>
                              {geoTop.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">Sem dados</div>)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Storage</CardTitle>
                      <CardDescription>Crescimento ao longo do período</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <AreaChart data={(bunny?.storage.charts.storageUsed || []).map((d) => ({ date: d.t.substring(5, 10), v: d.v }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                          <Area type="monotone" dataKey="v" fill="hsl(150, 60%, 45% / 0.2)" stroke="hsl(150, 60%, 45%)" />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={BUNNY_DASHBOARD} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir Bunny Dashboard
                    </a>
                  </Button>
                </div>
              </TabsContent>

              {/* ============ SUPABASE TAB ============ */}
              <TabsContent value="supabase" className="space-y-6">
                {sbError ? (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {sbError}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    <strong className="text-foreground">Plano Free:</strong> Supabase só expõe contagem de requisições (não bytes) e janela máxima de 7 dias via Management API.
                    O endpoint Prometheus/metrics requer plano Pro. Para egress real consulte sempre a aba Bunny CDN.
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> DB Size</CardDescription>
                      <CardTitle className="text-2xl">{sbLoading ? "..." : formatBytes(sbData?.db?.sizeBytes || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">de 0,5 GB Free</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Edge Funcs</CardDescription>
                      <CardTitle className="text-2xl">{sbLoading ? "..." : formatNumber(sbData?.edgeFunctions?.totalInvocations || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">Invocations · de 500k Free</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> Total Requests (7d)</CardDescription>
                      <CardTitle className="text-2xl">{sbLoading ? "..." : formatNumber(sbData?.apiCounts.totalRequests || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">REST + Auth + Storage + Realtime</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Storage</CardDescription>
                      <CardTitle className="text-2xl">{sbLoading ? "..." : formatBytes(sbData?.storage.totalBytes || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{sbData?.storage.totalFiles || 0} arquivos em {sbData?.storage.buckets.length || 0} buckets</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Auth Users</CardDescription>
                      <CardTitle className="text-2xl">{sbLoading ? "..." : (sbData?.auth.totalUsers || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">Usuários cadastrados</p></CardContent>
                  </Card>
                  <Card variant={sbData?.health.every(h => h.healthy) ? "success" : "warning"}>
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Health</CardDescription>
                      <CardTitle className="text-2xl">{sbData?.health.filter(h => h.healthy).length || 0}/{sbData?.health.length || 5}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">Serviços saudáveis</p></CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Requests por Serviço (série horária)</CardTitle>
                      <CardDescription>REST predomina; Storage geralmente vem da CDN, então fica próximo de zero</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ChartContainer config={chartConfig} className="h-[280px] w-full">
                        <AreaChart data={(sbData?.apiCounts.series || []).map(s => ({ ...s, date: s.timestamp.substring(5, 16) }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis tickFormatter={(v) => formatNumber(v)} className="text-xs" width={50} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area type="monotone" dataKey="rest" stackId="1" stroke={SERVICE_COLORS.rest} fill={SERVICE_COLORS.rest + "33"} />
                          <Area type="monotone" dataKey="auth" stackId="1" stroke={SERVICE_COLORS.auth} fill={SERVICE_COLORS.auth + "33"} />
                          <Area type="monotone" dataKey="storage" stackId="1" stroke={SERVICE_COLORS.storage} fill={SERVICE_COLORS.storage + "33"} />
                          <Area type="monotone" dataKey="realtime" stackId="1" stroke={SERVICE_COLORS.realtime} fill={SERVICE_COLORS.realtime + "33"} />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Storage por Bucket</CardTitle>
                      <CardDescription>Volume e contagem real por bucket público</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-3">
                        {(sbData?.storage.buckets || []).map((b, i) => (
                          <div key={b.bucket} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-sm font-medium">{b.bucket}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-mono">{formatBytes(b.bytes)}</div>
                              <div className="text-xs text-muted-foreground">{b.files} arquivos</div>
                            </div>
                          </div>
                        ))}
                        {!sbData?.storage.buckets.length && <div className="text-sm text-muted-foreground text-center py-8">Sem dados</div>}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Tabelas (contagem de registros)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {Object.entries(sbData?.tables || {}).map(([name, count]) => (
                        <div key={name} className="p-3 rounded bg-muted/30">
                          <div className="text-xs text-muted-foreground truncate">{name}</div>
                          <div className="text-lg font-semibold">{formatNumber(count)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={BILLING_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir Supabase Billing
                    </a>
                  </Button>
                </div>
              </TabsContent>

              {/* ============ HISTORY TAB ============ */}
              <TabsContent value="history" className="space-y-6">
                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <strong className="text-foreground">Snapshots diários</strong> capturados às 06:00 UTC (03:00 BRT) via cron.
                      Use o botão para forçar uma captura agora (popula o gráfico antes do primeiro cron rodar).
                    </div>
                    <div className="flex items-center gap-2">
                      {captureMsg && <span className="text-xs">{captureMsg}</span>}
                      <Button size="sm" onClick={captureNow} disabled={capturing}>
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${capturing ? "animate-spin" : ""}`} />
                        Capturar agora
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Snapshots</CardDescription>
                      <CardTitle className="text-2xl">{snapshots.length}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{snapLoading ? "..." : `${snapshots.length} dias gravados`}</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Primeiro</CardDescription>
                      <CardTitle className="text-lg">{snapshots[0]?.day || "—"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">início da série</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription>Último</CardDescription>
                      <CardTitle className="text-lg">{snapshots[snapshots.length - 1]?.day || "—"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">captura mais recente</p></CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">Bunny Bandwidth (lifetime acumulado)</CardTitle>
                    <CardDescription>Bytes totais entregues pela CDN ao longo do tempo</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {snapshots.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <AreaChart data={snapshots.map(s => ({ date: s.day.substring(5), v: s.bunny?.lifetime?.bandwidthBytes || 0 }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                          <Area type="monotone" dataKey="v" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                        Sem snapshots ainda. Clique em "Capturar agora" para gerar o primeiro.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Bunny Storage</CardTitle>
                      <CardDescription>Crescimento de arquivos armazenados</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {snapshots.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[260px] w-full">
                          <AreaChart data={snapshots.map(s => ({ date: s.day.substring(5), v: s.bunny?.storage?.bytesUsed || 0 }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                            <Area type="monotone" dataKey="v" fill="hsl(150, 60%, 45% / 0.2)" stroke="hsl(150, 60%, 45%)" strokeWidth={2} />
                          </AreaChart>
                        </ChartContainer>
                      ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Supabase Requests (acumulado)</CardTitle>
                      <CardDescription>Total agregado por dia</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {snapshots.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[260px] w-full">
                          <LineChart data={snapshots.map(s => ({ date: s.day.substring(5), v: s.supabase?.requests?.total || 0 }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis tickFormatter={(v) => formatNumber(v)} className="text-xs" width={50} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatNumber(v as number)} />} />
                            <Line type="monotone" dataKey="v" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ChartContainer>
                      ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ============ INTERNAL TAB (mantido) ============ */}
              <TabsContent value="internal" className="space-y-6">
                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-3">
                    <Activity className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground mb-1">⚠️ Estimativa baseada no Service Worker</p>
                      <p>Cobertura ~80%. Não inclui primeira visita, dashboard, bots e preview Lovable. Use como tendência interna; valores oficiais estão nas outras abas.</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2"><CardDescription>Egress estimado</CardDescription>
                      <CardTitle className="text-2xl">{formatBytes(totalInternalBytes)}</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{days}d · média {formatBytes(dailyAvg)}/dia</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2"><CardDescription>Cache rate</CardDescription>
                      <CardTitle className="text-2xl">{cacheRate}%</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">{totalHits} hits / {totalMisses} misses</p></CardContent>
                  </Card>
                  <Card variant="metric">
                    <CardHeader className="p-4 pb-2"><CardDescription>Projeção mensal</CardDescription>
                      <CardTitle className="text-2xl">{formatBytes(monthlyProjection)}</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">Baseado nos {days}d</p></CardContent>
                  </Card>
                  <Card variant={usagePercent > 80 ? "warning" : usagePercent > 50 ? "note" : "success"}>
                    <CardHeader className="p-4 pb-2"><CardDescription>Uso Free Tier</CardDescription>
                      <CardTitle className="text-2xl">{usagePercent}%</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`h-2 rounded-full ${usagePercent > 80 ? "bg-destructive" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${usagePercent}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">de 5 GB/mês</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Consumo Diário (estimado)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                      {dailyChart.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[260px] w-full">
                          <AreaChart data={dailyChart}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis dataKey="date" tickFormatter={(v) => v.substring(5)} className="text-xs" />
                            <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                            <Area type="monotone" dataKey="bytes" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                          </AreaChart>
                        </ChartContainer>
                      ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground">Sem dados</div>)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Top 10 Endpoints</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                      {resourceRanking.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[260px] w-full">
                          <BarChart data={resourceRanking} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis type="number" tickFormatter={(v) => formatBytesShort(v)} className="text-xs" />
                            <YAxis type="category" dataKey="name" width={120} className="text-xs" tick={{ fontSize: 11 }} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                            <Bar dataKey="bytes" radius={[0, 4, 4, 0]}>
                              {resourceRanking.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground">Sem dados</div>)}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Bunny atualizado: {bunny ? new Date(bunny.fetchedAt).toLocaleString("pt-BR") : "—"} ·
              Supabase atualizado: {sbData ? new Date(sbData.fetchedAt).toLocaleString("pt-BR") : "—"}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default EgressMonitor;
