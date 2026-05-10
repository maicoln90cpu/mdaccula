import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Loader2, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap,
  RotateCcw,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutoGenSettings {
  enabled: boolean;
  intervalHours: number;
  lastRun: Date | null;
  failCount: number;
  nextRunAt: Date | null;
}

interface LogEntry {
  id: string;
  level: string;
  message: string;
  context: Record<string, any>;
  logged_at: string;
}

interface LastGeneratedPost {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  published: boolean;
}

export default function AutoGenerationDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isForcing, setIsForcing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const [settings, setSettings] = useState<AutoGenSettings>({
    enabled: false,
    intervalHours: 48,
    lastRun: null,
    failCount: 0,
    nextRunAt: null,
  });
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPost, setLastPost] = useState<LastGeneratedPost | null>(null);

  useEffect(() => {
    fetchData();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'ai_auto_generate_enabled',
          'ai_auto_generate_interval_hours',
          'ai_auto_generate_last_run',
          'ai_auto_generate_fail_count'
        ]);

      if (settingsError) throw settingsError;

      const settingsMap: Record<string, string> = {};
      settingsData?.forEach(s => { settingsMap[s.key] = s.value || ''; });

      const enabled = settingsMap['ai_auto_generate_enabled'] === 'true';
      const intervalHours = parseInt(settingsMap['ai_auto_generate_interval_hours'] || '48');
      const lastRun = settingsMap['ai_auto_generate_last_run'] 
        ? new Date(settingsMap['ai_auto_generate_last_run']) 
        : null;
      const failCount = parseInt(settingsMap['ai_auto_generate_fail_count'] || '0');

      // Calculate next run
      let nextRunAt: Date | null = null;
      if (enabled && lastRun) {
        const effectiveInterval = failCount > 0 ? 1 : intervalHours; // 1h retry on failure
        nextRunAt = new Date(lastRun.getTime() + effectiveInterval * 60 * 60 * 1000);
      }

      setSettings({
        enabled,
        intervalHours,
        lastRun,
        failCount,
        nextRunAt,
      });

      // Fetch recent logs
      const { data: logsData, error: logsError } = await supabase
        .from('application_logs')
        .select('id, level, message, context, logged_at')
        .ilike('message', '%Auto-geração%')
        .order('logged_at', { ascending: false })
        .limit(15);

      if (logsError) throw logsError;
      setLogs((logsData as LogEntry[]) || []);

      // Fetch last AI generated post
      const { data: aiPostData, error: aiPostError } = await supabase
        .from('ai_generated_posts')
        .select('blog_post_id, generated_at')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (!aiPostError && aiPostData?.blog_post_id) {
        const { data: postData } = await supabase
          .from('blog_posts')
          .select('id, title, slug, created_at, published')
          .eq('id', aiPostData.blog_post_id)
          .single();

        if (postData) {
          setLastPost(postData);
        }
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar o dashboard.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'ai_auto_generate_enabled', value: String(enabled) }, { onConflict: 'key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, enabled }));
      toast({
        title: enabled ? "Auto-geração habilitada" : "Auto-geração desabilitada",
        description: enabled 
          ? `Artigos serão gerados automaticamente a cada ${settings.intervalHours}h`
          : "A geração automática foi pausada",
      });
    } catch (error) {
      console.error('Error toggling enabled:', error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startPolling = () => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Start polling every 10 seconds
    const interval = setInterval(async () => {
      console.log('Polling for generation status...');
      await fetchData();
      
      // Check if generation completed (look for recent success or error log)
      const recentLog = logs.find(l => {
        const logTime = new Date(l.logged_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return logTime > fiveMinutesAgo && (
          l.message.includes('success') || 
          l.message.includes('sucesso') || 
          l.message.includes('error') ||
          l.message.includes('failed')
        );
      });
      
      if (recentLog) {
        console.log('Generation completed, stopping polling');
        setIsForcing(false);
        clearInterval(interval);
        setPollingInterval(null);
        
        if (recentLog.message.includes('success') || recentLog.message.includes('sucesso')) {
          toast({
            title: "Artigo gerado com sucesso!",
            description: "Verifique a seção 'Último Artigo Gerado'.",
          });
        }
      }
    }, 10000);
    
    setPollingInterval(interval);
    
    // Stop polling after 5 minutes max
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPollingInterval(null);
        setIsForcing(false);
        toast({
          title: "Timeout",
          description: "A geração está demorando mais que o esperado. Verifique os logs.",
          variant: "destructive",
        });
      }
    }, 5 * 60 * 1000);
  };

  const handleForceGeneration = async () => {
    setIsForcing(true);
    try {
      // Reset last_run to force immediate execution
      await supabase
        .from('site_settings')
        .upsert({ 
          key: 'ai_auto_generate_last_run', 
          value: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString() // 100h ago
        }, { onConflict: 'key' });

      // Call the function
      const { data, error } = await supabase.functions.invoke('auto-article-cron', {
        body: {},
      });

      if (error) throw error;

      toast({
        title: "Geração iniciada em background",
        description: "Acompanhe o progresso nesta página. Atualizando automaticamente...",
      });

      // Start polling for status updates
      startPolling();

    } catch (error: any) {
      console.error('Error forcing generation:', error);
      toast({
        title: "Erro ao forçar geração",
        description: error.message || "Não foi possível iniciar a geração.",
        variant: "destructive",
      });
      setIsForcing(false);
    }
  };

  const handleResetFailCount = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'ai_auto_generate_fail_count', value: '0' }, { onConflict: 'key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, failCount: 0 }));
      toast({
        title: "Contador resetado",
        description: "O contador de falhas foi zerado.",
      });
    } catch (error) {
      console.error('Error resetting fail count:', error);
      toast({
        title: "Erro ao resetar",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getLogIcon = (level: string, message: string) => {
    if (level === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (message.includes('success') || message.includes('sucesso')) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (message.includes('skipped') || message.includes('pulando')) return <Clock className="h-4 w-4 text-muted-foreground" />;
    if (level === 'warn') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Zap className="h-4 w-4 text-primary" />;
  };

  const getStatusBadge = () => {
    if (!settings.enabled) {
      return <Badge variant="secondary">Desabilitado</Badge>;
    }
    if (settings.failCount >= 5) {
      return <Badge variant="destructive">Pausado (falhas)</Badge>;
    }
    if (settings.failCount > 0) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Retry ({settings.failCount})</Badge>;
    }
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="w-full px-4 md:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">Geração Automática</h1>
                  {getStatusBadge()}
                </div>
                <p className="text-muted-foreground mt-1">
                  Monitore e controle a geração automática de artigos com IA
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Status Atual
                </CardTitle>
                <CardDescription>
                  Configuração e estado da geração automática
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-geração</Label>
                    <p className="text-xs text-muted-foreground">
                      Gerar artigos automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={isSaving}
                  />
                </div>

                <Separator />

                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Intervalo configurado:</span>
                    <span className="font-medium">{settings.intervalHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última execução:</span>
                    <span className="font-medium">
                      {settings.lastRun 
                        ? formatDistanceToNow(settings.lastRun, { addSuffix: true, locale: ptBR })
                        : 'Nunca'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próxima execução:</span>
                    <span className="font-medium">
                      {settings.nextRunAt && settings.enabled
                        ? formatDistanceToNow(settings.nextRunAt, { addSuffix: true, locale: ptBR })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Falhas consecutivas:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${settings.failCount > 0 ? 'text-destructive' : ''}`}>
                        {settings.failCount}
                      </span>
                      {settings.failCount > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleResetFailCount}
                          disabled={isResetting}
                          className="h-6 px-2"
                        >
                          {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <Button 
                  onClick={handleForceGeneration} 
                  disabled={isForcing}
                  className="w-full"
                >
                  {isForcing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando... (atualizando a cada 10s)
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Forçar Geração Agora
                    </>
                  )}
                </Button>
                
                {isForcing && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    A geração está em andamento em background. Esta página será atualizada automaticamente.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Last Generated Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Último Artigo Gerado
                </CardTitle>
                <CardDescription>
                  Artigo mais recente criado automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lastPost ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium leading-tight">{lastPost.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(lastPost.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lastPost.published ? "default" : "secondary"}>
                        {lastPost.published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/blog`)}
                      >
                        Gerenciar Blog
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/blog/${lastPost.slug}`, '_blank')}
                      >
                        Ver Post
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum artigo gerado automaticamente ainda</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logs Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Histórico de Execuções
                </CardTitle>
                <CardDescription>
                  Últimas 15 execuções e seus resultados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {logs.map((log) => (
                        <div 
                          key={log.id} 
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card/50"
                        >
                          {getLogIcon(log.level, log.message)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {log.message.replace('Auto-geração: ', '')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.level}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(log.logged_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </p>
                            {log.context && Object.keys(log.context).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  Ver detalhes
                                </summary>
                                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(log.context, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum log de execução encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
