import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/useToast";
import { 
  Cloud, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Clock,
  Activity,
  HardDrive,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type SyncLog = Tables<"sync_logs">;

interface SyncError {
  table?: string;
  error: string;
}

const BackupSync = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Buscar logs de sincronização
  const { data: logs, isLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SyncLog[];
    },
  });

  // Mutation para executar sync manualmente
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-to-external', {
        body: { triggered_by: 'manual' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Sincronização iniciada",
        description: "O backup está sendo executado em segundo plano.",
      });
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao iniciar sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      // Testar se as credenciais estão configuradas
      const { data, error } = await supabase.functions.invoke('sync-to-external', {
        body: { test: true },
      });

      if (error) throw error;

      toast({
        title: "Conexão testada com sucesso",
        description: "As credenciais do Supabase externo estão corretas.",
      });
    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Verifique as credenciais.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, BadgeProps['variant']> = {
      success: 'default',
      warning: 'secondary',
      failed: 'destructive',
      running: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const lastSync = logs?.[0];
  const successRate = logs 
    ? (logs.filter(l => l.status === 'success').length / logs.length) * 100 
    : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold mb-2 hero-text flex items-center gap-3">
                <Cloud className="w-10 h-10" />
                Backup & Sincronização
              </h1>
              <p className="text-muted-foreground">
                Sistema de backup automático para Supabase externo (a cada 12 horas)
              </p>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Último Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lastSync ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(lastSync.status)}
                        <span className="text-2xl font-bold">
                          {lastSync.duration_seconds}s
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lastSync.started_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum sync executado</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Registros Sincronizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {lastSync?.total_records?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastSync?.storage_files_synced || 0} arquivos no Storage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Taxa de Sucesso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">{successRate.toFixed(0)}%</div>
                    <Progress value={successRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controles */}
            <Card>
              <CardHeader>
                <CardTitle>Controles de Sincronização</CardTitle>
                <CardDescription>
                  Execute manualmente ou teste a conexão com o Supabase externo
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="gap-2"
                >
                  {syncMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Executar Sync Agora
                </Button>
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={isTestingConnection}
                  className="gap-2"
                >
                  {isTestingConnection ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Testar Conexão
                </Button>
              </CardContent>
            </Card>

            {/* Histórico de Sincronizações */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Sincronizações</CardTitle>
                <CardDescription>Últimas 50 execuções</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : logs && logs.length > 0 ? (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(log.status)}
                            <div>
                              <p className="font-medium">
                                {format(new Date(log.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Acionado por: {log.triggered_by}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(log.status)}
                        </div>

                        <Separator className="my-2" />

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Duração:</span>
                            <p className="font-medium">{log.duration_seconds}s</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Registros:</span>
                            <p className="font-medium">{log.total_records}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Arquivos:</span>
                            <p className="font-medium">{log.storage_files_synced}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tabelas:</span>
                            <p className="font-medium">{Array.isArray(log.tables_synced) ? log.tables_synced.length : 0}</p>
                          </div>
                        </div>

                        {log.errors && Array.isArray(log.errors) && log.errors.length > 0 && (
                          <div className="mt-3 p-2 bg-destructive/10 rounded text-sm">
                            <p className="font-medium text-destructive mb-1">Erros:</p>
                            {(log.errors as unknown as SyncError[]).map((err, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                {err.table && `[${err.table}] `}{err.error}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma sincronização executada ainda</p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default BackupSync;
