import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  AlertTriangle,
  ExternalLink,
  Gauge,
  HardDrive,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBytes, formatBytesShort, formatNumber } from './formatters';
import { BUNNY_DASHBOARD, CHART_CONFIG, COLORS } from './constants';
import type { BunnyResp } from './types';

interface Props {
  bunny: BunnyResp | null;
  bunnyLoading: boolean;
  bunnyError: string | null;
  isLifetime: boolean;
  days: number;
}

export const BunnyTab = ({ bunny, bunnyLoading, bunnyError, isLifetime, days }: Props) => {
  const bunnyEgressGB = bunny ? bunny.pullZone.bandwidthBytes / 1024 ** 3 : 0;
  const geoTop = bunny
    ? Object.entries(bunny.pullZone.geo)
        .map(([country, v]) => ({ country, v: Number(v) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 10)
    : [];

  return (
    <div className="space-y-6">
      {bunnyError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {bunnyError}
          </CardContent>
        </Card>
      ) : null}

      {bunny?.chunks && bunny.chunks.errors > 0 ? (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="p-3 text-xs text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Dados parciais: {bunny.chunks.ok} janelas válidas, {bunny.chunks.errors} ignoradas (
            {bunny.chunks.stopReason || '—'}). Período real coberto: {bunny.window.days}d.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Custo estimado (USD)</CardDescription>
            <CardTitle className="text-2xl">
              ${(bunny?.estimatedCostUSD || 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              @ ~$0.043/GB · {bunnyEgressGB.toFixed(2)} GB
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Bandwidth</CardDescription>
            <CardTitle className="text-2xl">
              {bunnyLoading ? '...' : formatBytes(bunny?.pullZone.bandwidthBytes || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {bunnyEgressGB.toFixed(2)} GB · {isLifetime ? 'lifetime' : `${days}d`}
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Requests</CardDescription>
            <CardTitle className="text-2xl">
              {bunnyLoading ? '...' : formatNumber(bunny?.pullZone.requests || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {bunny?.pullZone.requests.toLocaleString() || '0'} total
            </p>
          </CardContent>
        </Card>
        <Card variant="success">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" /> Cache Hit
            </CardDescription>
            <CardTitle className="text-2xl">
              {bunnyLoading ? '...' : (bunny?.pullZone.cacheHitRate || 0).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              Origin: {formatBytes(bunny?.pullZone.originBytes || 0)}
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> Storage
            </CardDescription>
            <CardTitle className="text-2xl">
              {bunnyLoading ? '...' : formatBytes(bunny?.storage.bytesUsed || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {bunny?.storage.files || 0} arquivos · {bunny?.storage.region}
            </p>
          </CardContent>
        </Card>
        <Card variant={(bunny?.pullZone.errors.err5xx || 0) > 100 ? 'warning' : 'metric'}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Erros
            </CardDescription>
            <CardTitle className="text-2xl">
              {(bunny?.pullZone.errors.err4xx || 0) + (bunny?.pullZone.errors.err5xx || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              4xx: {bunny?.pullZone.errors.err4xx || 0} · 5xx:{' '}
              {bunny?.pullZone.errors.err5xx || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Bandwidth Diário</CardTitle>
            <CardDescription>Total vs Cached</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
              <AreaChart
                data={(bunny?.pullZone.charts.bandwidth || []).map((d, i) => ({
                  date: d.t.substring(5, 10),
                  total: d.v,
                  cached: bunny?.pullZone.charts.bandwidthCached[i]?.v || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" className="text-xs" />
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
                  dataKey="total"
                  stackId="1"
                  fill="hsl(var(--primary) / 0.2)"
                  stroke="hsl(var(--primary))"
                />
                <Area
                  type="monotone"
                  dataKey="cached"
                  stackId="2"
                  fill="hsl(150, 60%, 45% / 0.3)"
                  stroke="hsl(150, 60%, 45%)"
                />
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
            <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
              <LineChart
                data={(bunny?.pullZone.charts.cacheHitRate || []).map((d) => ({
                  date: d.t.substring(5, 10),
                  rate: d.v,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-xs"
                  width={45}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => `${(v as number).toFixed(1)}%`}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(150, 60%, 45%)"
                  strokeWidth={2}
                  dot={false}
                />
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
              <ChartContainer
                config={CHART_CONFIG}
                className="w-full"
                style={{ height: Math.max(300, geoTop.length * 36) }}
              >
                <BarChart
                  data={geoTop.map((g) => ({
                    ...g,
                    label: g.country.length > 22 ? g.country.slice(0, 20) + '…' : g.country,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatBytesShort(v)}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={150}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v, _n, item) =>
                          `${(item?.payload as { country?: string })?.country || ''}: ${formatBytes(v as number)}`
                        }
                      />
                    }
                  />
                  <Bar dataKey="v" radius={[0, 4, 4, 0]}>
                    {geoTop.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Storage</CardTitle>
            <CardDescription>Crescimento ao longo do período</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={CHART_CONFIG} className="h-[300px] w-full">
              <AreaChart
                data={(bunny?.storage.charts.storageUsed || []).map((d) => ({
                  date: d.t.substring(5, 10),
                  v: d.v,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" className="text-xs" />
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
                  dataKey="v"
                  fill="hsl(150, 60%, 45% / 0.2)"
                  stroke="hsl(150, 60%, 45%)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a
            href={BUNNY_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir Bunny Dashboard
          </a>
        </Button>
      </div>
    </div>
  );
};
