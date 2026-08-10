import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/lib/logger';
import { useAutoPublishSettings, type AutoPublishKey } from '@/hooks/useAutoPublishSettings';

// Painel único de controle (reorganização dos controles de publicação,
// 10/08/2026): 1 linha por caminho de geração, com selo estático de
// "raspagem real" e o toggle rascunho/publicado ligado à chave correta.
const PUBLISH_CONTROL_ROWS: { key: AutoPublishKey; label: string; description: string; scrapesReal: boolean }[] = [
  { key: 'auto_publish_generate_tab', label: 'Gerar', description: 'Aba "Gerar" — template manual, sem raspagem.', scrapesReal: false },
  { key: 'auto_publish_suggestions_topic', label: 'Sugestões (tema livre)', description: 'Sugestão sem template dedicado — busca aberta na web ancorada em matéria real.', scrapesReal: true },
  { key: 'auto_publish_suggestions_template', label: 'Sugestões (template)', description: 'Sugestão de categoria com template próprio (entrevistas, labels) — sem raspagem.', scrapesReal: false },
  { key: 'auto_publish_topic_search', label: 'Por Tema', description: 'Busca aberta na web por um termo livre digitado no admin.', scrapesReal: true },
  { key: 'auto_publish_auto_cron', label: 'Automático (cron)', description: '1 fonte cadastrada em Fontes → 1 matéria real ainda não usada → reescrita fiel.', scrapesReal: true },
  { key: 'auto_publish_multi_event', label: 'Artigo consolidado (Multi-Evento)', description: 'Cobre vários eventos já cadastrados no site — sem raspagem externa.', scrapesReal: false },
  { key: 'auto_publish_single_event', label: 'Por evento', description: 'Botão "Gerar artigo" na lista de Eventos, ou checkbox ao criar/editar 1 evento — sem raspagem.', scrapesReal: false },
  { key: 'event_watcher_auto_publish', label: 'Event Watcher', description: 'Detecção automática de eventos novos em sites/Instagram cadastrados.', scrapesReal: true },
];

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
  context: Record<string, unknown>;
  logged_at: string;
}

interface LastGeneratedPost {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  published: boolean;
}

export function AutoGenerationPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isForcing, setIsForcing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const {
    settings: publishSettings,
    loading: publishSettingsLoading,
    updateSetting: updatePublishSetting,
  } = useAutoPublishSettings(PUBLISH_CONTROL_ROWS.map((r) => r.key));
  const [savingRowKey, setSavingRowKey] = useState<AutoPublishKey | null>(null);
  const [intervalInput, setIntervalInput] = useState('48');
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [settings, setSettings] = useState<AutoGenSettings>({
    enabled: false,
    intervalHours: 48,
    lastRun: null,
    failCount: 0,
    nextRunAt: null,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPost, setLastPost] = useState<LastGeneratedPost | null>(null);

  const fetchData = useCallback(async () => {
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
          'ai_auto_generate_fail_count',
        ]);

      if (settingsError) throw settingsError;

      const settingsMap: Record<string, string> = {};
      settingsData?.forEach((s) => {
        settingsMap[s.key] = s.value || '';
      });

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
      setIntervalInput(String(intervalHours));

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
      logger.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar o dashboard.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();

    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchData]);

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'ai_auto_generate_enabled', value: String(enabled) }, { onConflict: 'key' });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, enabled }));
      toast({
        title: enabled ? 'Auto-geração habilitada' : 'Auto-geração desabilitada',
        description: enabled
          ? `Artigos serão gerados automaticamente a cada ${settings.intervalHours}h`
          : 'A geração automática foi pausada',
      });
    } catch (error) {
      logger.error('Error toggling enabled:', error);
      toast({
        title: 'Erro ao salvar',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublishRow = async (key: AutoPublishKey, enabled: boolean) => {
    setSavingRowKey(key);
    try {
      await updatePublishSetting(key, enabled);
      toast({
        title: enabled ? 'Publicação automática ligada' : 'Publicação automática desligada',
        description: enabled
          ? 'Esse caminho passa a publicar direto, sem revisão.'
          : 'Esse caminho passa a nascer como rascunho, aguardando revisão em /admin/blog.',
      });
    } catch (error) {
      logger.error('Error toggling publish setting:', error);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleSaveInterval = async () => {
    const parsed = parseInt(intervalInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 720) {
      toast({
        title: 'Intervalo inválido',
        description: 'Informe um número de horas entre 1 e 720 (30 dias).',
        variant: 'destructive',
      });
      setIntervalInput(String(settings.intervalHours));
      return;
    }

    setIsSavingInterval(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'ai_auto_generate_interval_hours', value: String(parsed) }, { onConflict: 'key' });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, intervalHours: parsed }));
      setIntervalInput(String(parsed));
      toast({
        title: 'Intervalo atualizado',
        description: `Artigos serão gerados a cada ${parsed}h a partir de agora.`,
      });
    } catch (error) {
      logger.error('Error saving interval:', error);
      toast({
        title: 'Erro ao salvar intervalo',
        variant: 'destructive',
      });
      setIntervalInput(String(settings.intervalHours));
    } finally {
      setIsSavingInterval(false);
    }
  };

  const startPolling = () => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Start polling every 10 seconds
    const interval = setInterval(async () => {
      logger.debug('Polling for generation status...');
      await fetchData();

      // Check if generation completed (look for recent success or error log)
      const recentLog = logs.find((l) => {
        const logTime = new Date(l.logged_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return (
          logTime > fiveMinutesAgo &&
          (l.message.includes('success') ||
            l.message.includes('sucesso') ||
            l.message.includes('error') ||
            l.message.includes('failed'))
        );
      });

      if (recentLog) {
        logger.debug('Generation completed, stopping polling');
        setIsForcing(false);
        clearInterval(interval);
        pollingIntervalRef.current = null;

        if (recentLog.message.includes('success') || recentLog.message.includes('sucesso')) {
          toast({
            title: 'Artigo gerado com sucesso!',
            description: "Verifique a seção 'Último Artigo Gerado'.",
          });
        }
      }
    }, 10000);

    pollingIntervalRef.current = interval;

    // Stop polling after 5 minutes max
    setTimeout(
      () => {
        if (interval) {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setIsForcing(false);
          toast({
            title: 'Timeout',
            description: 'A geração está demorando mais que o esperado. Verifique os logs.',
            variant: 'destructive',
          });
        }
      },
      5 * 60 * 1000
    );
  };

  const handleForceGeneration = async () => {
    setIsForcing(true);
    try {
      // Reset last_run to force immediate execution
      await supabase.from('site_settings').upsert(
        {
          key: 'ai_auto_generate_last_run',
          value: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(), // 100h ago
        },
        { onConflict: 'key' }
      );

      // Call the function
      const { error } = await supabase.functions.invoke('auto-article-cron', {
        body: {},
      });

      if (error) throw error;

      toast({
        title: 'Geração iniciada em background',
        description: 'Acompanhe o progresso nesta página. Atualizando automaticamente...',
      });

      // Start polling for status updates
      startPolling();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error forcing generation:', error);
      toast({
        title: 'Erro ao forçar geração',
        description: message || 'Não foi possível iniciar a geração.',
        variant: 'destructive',
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

      setSettings((prev) => ({ ...prev, failCount: 0 }));
      toast({
        title: 'Contador resetado',
        description: 'O contador de falhas foi zerado.',
      });
    } catch (error) {
      logger.error('Error resetting fail count:', error);
      toast({
        title: 'Erro ao resetar',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getLogIcon = (level: string, message: string) => {
    if (level === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (message.includes('success') || message.includes('sucesso'))
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (message.includes('skipped') || message.includes('pulando'))
      return <Clock className="h-4 w-4 text-muted-foreground" />;
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
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
          Retry ({settings.failCount})
        </Badge>
      );
    }
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Geração Automática</h2>
            {getStatusBadge()}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitore e controle a geração automática de artigos com IA. A cada execução, escolhe 1
            fonte cadastrada em Fontes / Event Watcher, encontra 1 matéria real ainda não usada e
            reescreve fielmente essa matéria — sempre rastreável até a URL de origem. A busca aberta
            na web só é usada nas abas manuais (Sugestões / Por Tema).
          </p>
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
            <CardDescription>Configuração e estado da geração automática</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-geração</Label>
                <p className="text-xs text-muted-foreground">Gerar artigos automaticamente</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Intervalo configurado:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    disabled={isSavingInterval}
                    className="h-8 w-20 text-right"
                  />
                  <span className="text-muted-foreground text-xs">h</span>
                  {intervalInput !== String(settings.intervalHours) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveInterval}
                      disabled={isSavingInterval}
                      className="h-8 px-2"
                    >
                      {isSavingInterval ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                    </Button>
                  )}
                </div>
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
                  <span
                    className={`font-medium ${settings.failCount > 0 ? 'text-destructive' : ''}`}
                  >
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
                      {isResetting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <Button onClick={handleForceGeneration} disabled={isForcing} className="w-full">
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
                A geração está em andamento em background. Esta página será atualizada
                automaticamente.
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
            <CardDescription>Artigo mais recente criado automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            {lastPost ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium leading-tight">{lastPost.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(lastPost.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lastPost.published ? 'default' : 'secondary'}>
                    {lastPost.published ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/blog`)}>
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
            <CardDescription>Últimas 15 execuções e seus resultados</CardDescription>
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
                          {format(new Date(log.logged_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
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

        {/* Painel único de controle de publicação (reorganização, 10/08/2026) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Controle de publicação por tipo de geração
            </CardTitle>
            <CardDescription>
              Cada um dos 8 caminhos que criam artigo tem seu próprio controle — comece desligado
              (rascunho) e ligue à medida que ganhar confiança naquele caminho específico. O selo
              "Raspagem real" é só informativo: mostra se aquele caminho lê páginas reais na web ou
              se trabalha só com dados já cadastrados/digitados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {publishSettingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caminho</TableHead>
                      <TableHead>Raspagem real?</TableHead>
                      <TableHead className="text-right">Publicar automaticamente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PUBLISH_CONTROL_ROWS.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          <div className="font-medium">{row.label}</div>
                          <div className="text-xs text-muted-foreground">{row.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.scrapesReal ? 'Sim' : 'Não'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {savingRowKey === row.key && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                            <Switch
                              checked={publishSettings[row.key] === true}
                              onCheckedChange={(checked) => handleTogglePublishRow(row.key, checked)}
                              disabled={savingRowKey === row.key}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
