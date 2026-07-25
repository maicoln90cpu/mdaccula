import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Activity } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatBytes, formatBytesShort } from './formatters';
import { CHART_CONFIG, COLORS } from './constants';
import type { EgressRow } from './types';

interface Props {
  internalRows: EgressRow[];
  days: number;
}

export const InternalTab = ({ internalRows, days }: Props) => {
  const totalInternalBytes = internalRows.reduce((s, r) => s + r.egress_bytes, 0);
  const totalHits = internalRows.reduce((s, r) => s + r.cache_hits, 0);
  const totalMisses = internalRows.reduce((s, r) => s + r.cache_misses, 0);
  const cacheRate =
    totalHits + totalMisses > 0 ? Math.round((totalHits / (totalHits + totalMisses)) * 100) : 0;
  const dailyAvg = totalInternalBytes / (days || 1);
  const monthlyProjection = dailyAvg * 30;
  const FREE_TIER = 5 * 1024 * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((monthlyProjection / FREE_TIER) * 100));

  const dailyMap = new Map<string, number>();
  internalRows.forEach((r) => {
    const day = r.period_start.substring(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + r.egress_bytes);
  });
  const dailyChart = Array.from(dailyMap.entries())
    .map(([date, bytes]) => ({ date, bytes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const resourceMap = new Map<string, number>();
  internalRows.forEach((r) => {
    const key = r.api_path.replace('/rest/v1/', '').split('?')[0];
    resourceMap.set(key, (resourceMap.get(key) || 0) + r.egress_bytes);
  });
  const resourceRanking = Array.from(resourceMap.entries())
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-3">
          <Activity className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground mb-1">
              ⚠️ Estimativa baseada no Service Worker
            </p>
            <p>
              Cobertura ~80%. Não inclui primeira visita, dashboard, bots e preview Lovable. Use
              como tendência interna; valores oficiais estão nas outras abas.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Egress estimado</CardDescription>
            <CardTitle className="text-2xl">{formatBytes(totalInternalBytes)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {days}d · média {formatBytes(dailyAvg)}/dia
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Cache rate</CardDescription>
            <CardTitle className="text-2xl">{cacheRate}%</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {totalHits} hits / {totalMisses} misses
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Projeção mensal</CardDescription>
            <CardTitle className="text-2xl">{formatBytes(monthlyProjection)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Baseado nos {days}d</p>
          </CardContent>
        </Card>
        <Card variant={usagePercent > 80 ? 'warning' : usagePercent > 50 ? 'note' : 'success'}>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Uso Free Tier</CardDescription>
            <CardTitle className="text-2xl">{usagePercent}%</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${usagePercent > 80 ? 'bg-destructive' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">de 5 GB/mês</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Consumo Diário (estimado)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {dailyChart.length > 0 ? (
              <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
                <AreaChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.substring(5)}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v) => formatBytesShort(v)}
                    className="text-xs"
                    width={60}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="bytes"
                    fill="hsl(var(--primary) / 0.2)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Top 10 Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {resourceRanking.length > 0 ? (
              <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
                <BarChart data={resourceRanking} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatBytesShort(v)}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />}
                  />
                  <Bar dataKey="bytes" radius={[0, 4, 4, 0]}>
                    {resourceRanking.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
