import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, HardDrive, Gauge, TrendingUp, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ResponsiveContainer } from "recharts";

interface EgressRow {
  id: string;
  period_start: string;
  api_path: string;
  source: string;
  egress_bytes: number;
  cache_hits: number;
  cache_misses: number;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatBytesShort(bytes: number): string {
  if (bytes === 0) return "0";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(340, 65%, 50%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(15, 75%, 50%)",
];

const EgressMonitor = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<EgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const fetchData = async () => {
    setLoading(true);
    const daysAgo = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - daysAgo);

    const { data: rows } = await supabase
      .from("egress_metrics")
      .select("*")
      .gte("period_start", since.toISOString())
      .order("period_start", { ascending: true });

    setData((rows as EgressRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  // --- Computed metrics ---
  const totalBytes = data.reduce((s, r) => s + r.egress_bytes, 0);
  const totalHits = data.reduce((s, r) => s + r.cache_hits, 0);
  const totalMisses = data.reduce((s, r) => s + r.cache_misses, 0);
  const cacheRate = totalHits + totalMisses > 0
    ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
    : 0;

  // Monthly projection
  const daysInPeriod = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const dailyAvg = totalBytes / (daysInPeriod || 1);
  const monthlyProjection = dailyAvg * 30;

  // Supabase free tier = 5GB egress
  const FREE_TIER_LIMIT = 5 * 1024 * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((monthlyProjection / FREE_TIER_LIMIT) * 100));

  // --- Daily consumption chart ---
  const dailyMap = new Map<string, number>();
  data.forEach((r) => {
    const day = r.period_start.substring(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + r.egress_bytes);
  });
  const dailyChart = Array.from(dailyMap.entries())
    .map(([date, bytes]) => ({ date, bytes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- Resource ranking ---
  const resourceMap = new Map<string, number>();
  data.forEach((r) => {
    const key = r.api_path.replace("/rest/v1/", "").split("?")[0];
    resourceMap.set(key, (resourceMap.get(key) || 0) + r.egress_bytes);
  });
  const resourceRanking = Array.from(resourceMap.entries())
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  // --- Source distribution (sw vs edge) ---
  const sourceMap = new Map<string, number>();
  data.forEach((r) => {
    sourceMap.set(r.source, (sourceMap.get(r.source) || 0) + r.egress_bytes);
  });
  const sourceChart = Array.from(sourceMap.entries())
    .map(([name, value]) => ({
      name: name === "sw" ? "Frontend (SW)" : name === "edge" ? "Edge Functions" : name,
      value,
    }));

  // --- Cache chart by day ---
  const cacheDailyMap = new Map<string, { hits: number; misses: number }>();
  data.forEach((r) => {
    const day = r.period_start.substring(0, 10);
    const existing = cacheDailyMap.get(day) || { hits: 0, misses: 0 };
    existing.hits += r.cache_hits;
    existing.misses += r.cache_misses;
    cacheDailyMap.set(day, existing);
  });
  const cacheChart = Array.from(cacheDailyMap.entries())
    .map(([date, { hits, misses }]) => ({
      date,
      hits,
      misses,
      rate: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const chartConfig = {
    bytes: { label: "Egress", color: "hsl(var(--primary))" },
    hits: { label: "Cache Hit", color: "hsl(150, 60%, 45%)" },
    misses: { label: "Cache Miss", color: "hsl(340, 65%, 50%)" },
    rate: { label: "Taxa Cache %", color: "hsl(210, 70%, 55%)" },
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold hero-text">Monitor de Egress</h1>
                  <p className="text-muted-foreground text-sm">Consumo de dados do Supabase em tempo real</p>
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
                <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Disclaimer */}
            <Card className="mb-6 border-border/50 bg-muted/30">
              <CardContent className="p-4 flex items-start gap-3">
                <Activity className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">⚠️ Cobertura estimada: ~80-85% do tráfego real</p>
                  <p>Este monitor mede o tráfego capturado pelo Service Worker e pelas Edge Functions instrumentadas. 
                  Não são contabilizados: acessos antes do SW ativar (primeira visita), tráfego do Supabase Dashboard, 
                  bots/crawlers diretos e o preview do Lovable. Os dados são coletados apenas a partir da data de deploy do sistema (08/04/2026).</p>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card variant="metric">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" /> Total Egress
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatBytes(totalBytes)}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Últimos {daysInPeriod} dias</p>
                </CardContent>
              </Card>

              <Card variant="metric">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5" /> Taxa de Cache
                  </CardDescription>
                  <CardTitle className="text-2xl">{cacheRate}%</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">{totalHits} hits / {totalMisses} misses</p>
                </CardContent>
              </Card>

              <Card variant="metric">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Projeção Mensal
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatBytes(monthlyProjection)}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Média diária: {formatBytes(dailyAvg)}</p>
                </CardContent>
              </Card>

              <Card variant={usagePercent > 80 ? "warning" : usagePercent > 50 ? "note" : "success"}>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Uso Free Tier
                  </CardDescription>
                  <CardTitle className="text-2xl">{usagePercent}%</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usagePercent > 80 ? "bg-destructive" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">de 5 GB/mês</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Daily Consumption */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Consumo Diário</CardTitle>
                  <CardDescription>Volume de dados transferidos por dia</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {dailyChart.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <AreaChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.substring(5)} className="text-xs" />
                        <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                        <ChartTooltip
                          content={<ChartTooltipContent labelFormatter={(v) => v} formatter={(v) => formatBytes(v as number)} />}
                        />
                        <Area type="monotone" dataKey="bytes" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado encontrado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cache Rate Over Time */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Taxa de Cache</CardTitle>
                  <CardDescription>Eficiência do cache do Service Worker por dia</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {cacheChart.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <LineChart data={cacheChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.substring(5)} className="text-xs" />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" width={45} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => v} />} />
                        <Line type="monotone" dataKey="rate" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado encontrado
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Resource Ranking */}
              <Card className="lg:col-span-2">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Ranking por Recurso</CardTitle>
                  <CardDescription>Top 10 endpoints com maior consumo</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {resourceRanking.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart data={resourceRanking} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis type="number" tickFormatter={(v) => formatBytesShort(v)} className="text-xs" />
                        <YAxis type="category" dataKey="name" width={120} className="text-xs" tick={{ fontSize: 11 }} />
                        <ChartTooltip
                          content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />}
                        />
                        <Bar dataKey="bytes" radius={[0, 4, 4, 0]}>
                          {resourceRanking.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado encontrado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Source Distribution */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Por Origem</CardTitle>
                  <CardDescription>Frontend vs Edge Functions</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {sourceChart.length > 0 ? (
                    <div className="h-[300px] flex flex-col items-center justify-center">
                      <ChartContainer config={chartConfig} className="h-[220px] w-full">
                        <PieChart>
                          <Pie
                            data={sourceChart}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={40}
                            paddingAngle={3}
                          >
                            {sourceChart.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />} />
                        </PieChart>
                      </ChartContainer>
                      <div className="flex gap-4 mt-2">
                        {sourceChart.map((s, i) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground">{s.name}: {formatBytes(s.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado encontrado
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default EgressMonitor;
