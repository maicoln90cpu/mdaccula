import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RefreshCw } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatBytes, formatBytesShort, formatNumber } from './formatters';
import { CHART_CONFIG } from './constants';
import type { SnapshotRow } from './types';

interface Props {
  snapshots: SnapshotRow[];
  snapLoading: boolean;
  capturing: boolean;
  captureMsg: string | null;
  onCapture: () => void;
}

export const HistoryTab = ({ snapshots, snapLoading, capturing, captureMsg, onCapture }: Props) => {
  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
          <div>
            <strong className="text-foreground">Snapshots diários</strong> capturados às 06:00 UTC
            (03:00 BRT) via cron. Use o botão para forçar uma captura agora (popula o gráfico antes
            do primeiro cron rodar).
          </div>
          <div className="flex items-center gap-2">
            {captureMsg && <span className="text-xs">{captureMsg}</span>}
            <Button size="sm" onClick={onCapture} disabled={capturing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${capturing ? 'animate-spin' : ''}`} />
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
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {snapLoading ? '...' : `${snapshots.length} dias gravados`}
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Primeiro</CardDescription>
            <CardTitle className="text-lg">{snapshots[0]?.day || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">início da série</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription>Último</CardDescription>
            <CardTitle className="text-lg">
              {snapshots[snapshots.length - 1]?.day || '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">captura mais recente</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Bunny Bandwidth (lifetime acumulado)</CardTitle>
          <CardDescription>Bytes totais entregues pela CDN ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {snapshots.length > 0 ? (
            <ChartContainer config={CHART_CONFIG} className="h-[300px] w-full">
              <AreaChart
                data={snapshots.map((s) => ({
                  date: s.day.substring(5),
                  v: s.bunny?.lifetime?.bandwidthBytes || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis tickFormatter={(v) => formatBytesShort(v)} className="text-xs" width={60} />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => formatBytes(v as number)} />}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  fill="hsl(var(--primary) / 0.2)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
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
              <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
                <AreaChart
                  data={snapshots.map((s) => ({
                    date: s.day.substring(5),
                    v: s.bunny?.storage?.bytesUsed || 0,
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
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Supabase Requests (acumulado)</CardTitle>
            <CardDescription>Total agregado por dia</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {snapshots.length > 0 ? (
              <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
                <LineChart
                  data={snapshots.map((s) => ({
                    date: s.day.substring(5),
                    v: s.supabase?.requests?.total || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v)}
                    className="text-xs"
                    width={50}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(v) => formatNumber(v as number)} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
