import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Activity,
  AlertTriangle,
  Database,
  ExternalLink,
  HardDrive,
  Server,
  Users,
} from 'lucide-react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatBytes, formatNumber } from './formatters';
import { BILLING_URL, CHART_CONFIG, COLORS, SERVICE_COLORS } from './constants';
import type { SupabaseUsageResp } from './types';

interface Props {
  sbData: SupabaseUsageResp | null;
  sbLoading: boolean;
  sbError: string | null;
}

export const SupabaseTab = ({ sbData, sbLoading, sbError }: Props) => {
  return (
    <div className="space-y-6">
      {sbError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {sbError}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Plano Free:</strong> Supabase só expõe contagem de
          requisições (não bytes) e janela máxima de 7 dias via Management API. O endpoint
          Prometheus/metrics requer plano Pro. Para egress real consulte sempre a aba Bunny CDN.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" /> DB Size
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbLoading ? '...' : formatBytes(sbData?.db?.sizeBytes || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">de 0,5 GB Free</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Edge Funcs
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbLoading ? '...' : formatNumber(sbData?.edgeFunctions?.totalInvocations || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {sbData?.edgeFunctions?.source === 'logs-explorer'
                ? `Logs (${sbData?.edgeFunctions?.windowDays ?? 7}d)`
                : sbData?.edgeFunctions?.source === 'management-api'
                  ? 'Mgmt API'
                  : 'Invocations'}{' '}
              · de 500k Free
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" /> Total Requests (7d)
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbLoading ? '...' : formatNumber(sbData?.apiCounts.totalRequests || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">REST + Auth + Storage + Realtime</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> Storage
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbLoading ? '...' : formatBytes(sbData?.storage.totalBytes || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {sbData?.storage.totalFiles || 0} arquivos em{' '}
              {sbData?.storage.buckets.length || 0} buckets
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Auth Users
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbLoading ? '...' : sbData?.auth.totalUsers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Usuários cadastrados</p>
          </CardContent>
        </Card>
        <Card variant={sbData?.health.every((h) => h.healthy) ? 'success' : 'warning'}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Health
            </CardDescription>
            <CardTitle className="text-2xl">
              {sbData?.health.filter((h) => h.healthy).length || 0}/
              {sbData?.health.length || 5}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Serviços saudáveis</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Requests por Serviço (série horária)</CardTitle>
            <CardDescription>
              REST predomina; Storage geralmente vem da CDN, então fica próximo de zero
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={CHART_CONFIG} className="h-[280px] w-full">
              <AreaChart
                data={(sbData?.apiCounts.series || []).map((s) => ({
                  ...s,
                  date: s.timestamp.substring(5, 16),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis
                  tickFormatter={(v) => formatNumber(v)}
                  className="text-xs"
                  width={50}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="rest"
                  stackId="1"
                  stroke={SERVICE_COLORS.rest}
                  fill={SERVICE_COLORS.rest + '33'}
                />
                <Area
                  type="monotone"
                  dataKey="auth"
                  stackId="1"
                  stroke={SERVICE_COLORS.auth}
                  fill={SERVICE_COLORS.auth + '33'}
                />
                <Area
                  type="monotone"
                  dataKey="storage"
                  stackId="1"
                  stroke={SERVICE_COLORS.storage}
                  fill={SERVICE_COLORS.storage + '33'}
                />
                <Area
                  type="monotone"
                  dataKey="realtime"
                  stackId="1"
                  stroke={SERVICE_COLORS.realtime}
                  fill={SERVICE_COLORS.realtime + '33'}
                />
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
                <div
                  key={b.bucket}
                  className="flex items-center justify-between p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{b.bucket}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">{formatBytes(b.bytes)}</div>
                    <div className="text-xs text-muted-foreground">{b.files} arquivos</div>
                  </div>
                </div>
              ))}
              {!sbData?.storage.buckets.length && (
                <div className="text-sm text-muted-foreground text-center py-8">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Tabelas (contagem de registros)
          </CardTitle>
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
          <a
            href={BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir Supabase Billing
          </a>
        </Button>
      </div>
    </div>
  );
};
