import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/useToast';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Server,
  HardDrive,
  Users,
  Activity,
  Mail,
  Clock,
  Zap,
  Trash2,
  Image,
  FileText,
  Wrench,
  ArrowLeft,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { TechDebtDashboard } from '@/components/admin/TechDebtDashboard';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface SystemHealthData {
  timestamp: string;
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  metrics: {
    database: {
      tables_count: number;
      total_rows: number;
      recent_errors: number;
    };
    edge_functions: {
      total_functions: number;
      recent_invocations: number;
    };
    storage: {
      buckets_count: number;
      total_files: number;
    };
  };
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'unhealthy':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Activity className="w-5 h-5 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    healthy: 'default',
    degraded: 'secondary',
    unhealthy: 'destructive',
  };

  const labels: Record<string, string> = {
    healthy: 'Saudável',
    degraded: 'Degradado',
    unhealthy: 'Indisponível',
  };

  return (
    <Badge variant={variants[status] || 'outline'} className="ml-2">
      {labels[status] || status}
    </Badge>
  );
};

const getCheckIcon = (name: string) => {
  if (name.includes('Database')) return <Database className="w-5 h-5" />;
  if (name.includes('Storage')) return <HardDrive className="w-5 h-5" />;
  if (name.includes('Auth')) return <Users className="w-5 h-5" />;
  if (name.includes('Newsletter')) return <Mail className="w-5 h-5" />;
  if (name.includes('Activity')) return <Activity className="w-5 h-5" />;
  if (name.includes('Tables')) return <Server className="w-5 h-5" />;
  return <Zap className="w-5 h-5" />;
};

const SystemHealth = () => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);
  const [cleanupResults, setCleanupResults] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const {
    data: healthData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<SystemHealthData>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('systemhealth');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handleRefresh = () => {
    setLastRefresh(new Date());
    refetch();
  };

  const handleCleanupStorage = async (dryRun: boolean) => {
    const key = dryRun ? 'storage-scan' : 'storage-clean';
    setCleanupLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-storage', {
        body: { dryRun, bucket: 'event-images' },
      });
      if (error) throw error;

      const msg = dryRun
        ? `Scan: ${data.summary.orphanedCount} órfãs + ${data.summary.duplicatesCount} duplicadas = ${data.summary.freedMB} MB recuperáveis`
        : `Limpeza concluída! ${data.summary.freedMB} MB liberados`;

      setCleanupResults((prev) => ({ ...prev, [key]: msg }));
      toast({ title: dryRun ? 'Scan concluído' : 'Limpeza concluída', description: msg });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(null);
    }
  };

  const handleCleanupLogs = async () => {
    setCleanupLoading('logs');
    try {
      const { error } = await supabase.rpc('cleanup_old_logs');
      if (error) throw error;
      setCleanupResults((prev) => ({
        ...prev,
        logs: 'Logs antigos (>30 dias) removidos com sucesso',
      }));
      toast({ title: 'Limpeza concluída', description: 'Logs e métricas antigas removidos' });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(null);
    }
  };

  const handleCleanupSyncLogs = async () => {
    setCleanupLoading('sync');
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-sync-logs');
      if (error) throw error;
      setCleanupResults((prev) => ({ ...prev, sync: `${data.deleted_count} sync logs removidos` }));
      toast({
        title: 'Sync logs limpos',
        description: `${data.deleted_count} registros removidos`,
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(null);
    }
  };

  const handleBatchConvert = async () => {
    setCleanupLoading('convert');
    try {
      const { data, error } = await supabase.functions.invoke('batch-convert-webp', {
        body: { bucket: 'event-images', quality: 80, maxFiles: 10 },
      });
      if (error) throw error;
      setCleanupResults((prev) => ({
        ...prev,
        convert: `${data.summary.processed} convertidos, ${data.summary.totalSavedMB} MB economizados`,
      }));
      toast({
        title: 'Conversão concluída',
        description: `${data.summary.processed} imagens otimizadas`,
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(null);
    }
  };

  const overallHealthScore = healthData
    ? Math.round(
        (healthData.checks.filter((c) => c.status === 'healthy').length /
          healthData.checks.length) *
          100
      )
    : 0;

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <NavLink
                  to="/admin"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-3xl font-bold hero-text">Status do Sistema</h1>
                <p className="text-muted-foreground">Monitoramento de saúde e performance</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')}
                </span>
                <Button onClick={handleRefresh} disabled={isFetching} variant="outline" size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Overall Status Card */}
            <Card
              className={`border-2 ${
                healthData?.overall_status === 'healthy'
                  ? 'border-green-500/50'
                  : healthData?.overall_status === 'degraded'
                    ? 'border-yellow-500/50'
                    : 'border-red-500/50'
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {isLoading ? (
                      <Skeleton className="w-12 h-12 rounded-full" />
                    ) : (
                      <div
                        className={`p-3 rounded-full ${
                          healthData?.overall_status === 'healthy'
                            ? 'bg-green-500/20'
                            : healthData?.overall_status === 'degraded'
                              ? 'bg-yellow-500/20'
                              : 'bg-red-500/20'
                        }`}
                      >
                        <StatusIcon status={healthData?.overall_status || 'unknown'} />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-2xl flex items-center">
                        Status Geral
                        {healthData && <StatusBadge status={healthData.overall_status} />}
                      </CardTitle>
                      <CardDescription>
                        {healthData
                          ? `Última verificação: ${new Date(healthData.timestamp).toLocaleString('pt-BR')}`
                          : 'Carregando...'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">{overallHealthScore}%</div>
                    <div className="text-sm text-muted-foreground">Health Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={overallHealthScore} className="h-2" />
              </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {healthData?.metrics.database.total_rows.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {healthData?.metrics.database.tables_count} tabelas •{' '}
                        {healthData?.metrics.database.recent_errors} erros
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-500" />
                    Edge Functions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {healthData?.metrics.edge_functions.total_functions}
                      </div>
                      <p className="text-xs text-muted-foreground">funções ativas</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-green-500" />
                    Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {healthData?.metrics.storage.buckets_count}
                      </div>
                      <p className="text-xs text-muted-foreground">buckets configurados</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Maintenance Section */}
            <Card className="border-2 border-orange-500/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-500" />
                  <CardTitle>Manutenção e Otimização</CardTitle>
                </div>
                <CardDescription>
                  Ferramentas para limpar dados antigos, imagens órfãs e otimizar o storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Storage Cleanup */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-red-500" />
                      <h3 className="font-medium">Imagens Órfãs / Duplicadas</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Identifica e remove imagens não referenciadas por eventos ou posts
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCleanupStorage(true)}
                        disabled={cleanupLoading !== null}
                      >
                        {cleanupLoading === 'storage-scan' && (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        Escanear
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCleanupStorage(false)}
                        disabled={cleanupLoading !== null}
                      >
                        {cleanupLoading === 'storage-clean' && (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        <Trash2 className="w-3 h-3 mr-1" />
                        Limpar
                      </Button>
                    </div>
                    {cleanupResults['storage-scan'] && (
                      <p className="text-xs text-blue-400 bg-blue-500/10 p-2 rounded">
                        {cleanupResults['storage-scan']}
                      </p>
                    )}
                    {cleanupResults['storage-clean'] && (
                      <p className="text-xs text-green-400 bg-green-500/10 p-2 rounded">
                        {cleanupResults['storage-clean']}
                      </p>
                    )}
                  </div>

                  {/* Batch Convert WebP */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-purple-500" />
                      <h3 className="font-medium">Converter PNGs para WebP</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Converte imagens PNG/JPG grandes para WebP otimizado (~70% menor)
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBatchConvert}
                      disabled={cleanupLoading !== null}
                    >
                      {cleanupLoading === 'convert' && (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      )}
                      Converter (máx 10)
                    </Button>
                    {cleanupResults['convert'] && (
                      <p className="text-xs text-purple-400 bg-purple-500/10 p-2 rounded">
                        {cleanupResults['convert']}
                      </p>
                    )}
                  </div>

                  {/* Cleanup Logs */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-yellow-500" />
                      <h3 className="font-medium">Limpar Logs Antigos</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove application_logs e performance_metrics com mais de 30 dias
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCleanupLogs}
                      disabled={cleanupLoading !== null}
                    >
                      {cleanupLoading === 'logs' && (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      )}
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpar Logs
                    </Button>
                    {cleanupResults['logs'] && (
                      <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                        {cleanupResults['logs']}
                      </p>
                    )}
                  </div>

                  {/* Cleanup Sync Logs */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-500" />
                      <h3 className="font-medium">Limpar Sync Logs</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove registros de sincronização com mais de 30 dias
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCleanupSyncLogs}
                      disabled={cleanupLoading !== null}
                    >
                      {cleanupLoading === 'sync' && (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      )}
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpar Sync
                    </Button>
                    {cleanupResults['sync'] && (
                      <p className="text-xs text-cyan-400 bg-cyan-500/10 p-2 rounded">
                        {cleanupResults['sync']}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Verificações de Saúde</CardTitle>
                <CardDescription>Status detalhado de cada componente do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-red-500">
                    <XCircle className="w-12 h-12 mx-auto mb-4" />
                    <p>Erro ao carregar status do sistema</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {error instanceof Error ? error.message : 'Erro desconhecido'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {healthData?.checks.map((check, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              check.status === 'healthy'
                                ? 'bg-green-500/10 text-green-500'
                                : check.status === 'degraded'
                                  ? 'bg-yellow-500/10 text-yellow-500'
                                  : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {getCheckIcon(check.name)}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {check.name}
                              <StatusBadge status={check.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">{check.message}</p>
                          </div>
                        </div>
                        {check.latency && (
                          <div className="text-right">
                            <div className="text-sm font-medium">{check.latency}ms</div>
                            <div className="text-xs text-muted-foreground">latência</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tech Debt Dashboard */}
            <TechDebtDashboard />
          </div>
        </main>
      </div>
    </>
  );
};

export default SystemHealth;
