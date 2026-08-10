import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, subWeeks, subMonths, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/lib/logger';

type Period = 'daily' | 'weekly' | 'monthly';

const SOURCE_LABELS: Record<string, string> = {
  gerar_tab: 'Gerar',
  sugestoes_tema: 'Sugestões (tema)',
  sugestoes_template: 'Sugestões (template)',
  por_tema: 'Por Tema',
  auto_cron: 'Automático (cron)',
  multi_evento: 'Multi-Evento',
  por_evento: 'Por Evento',
  event_watcher: 'Event Watcher',
};
const UNKNOWN_SOURCE_LABEL = 'Não identificado';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316'];

const UNATTENDED_SOURCES = new Set(['auto_cron', 'event_watcher']);

interface PostRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  views: number;
  source: string | null;
}

interface LogSummary {
  success: number;
  skipped: number;
  failed: number;
}

export const ContentDashboard = () => {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [viewEvents, setViewEvents] = useState<{ viewed_at: string }[]>([]);
  const [logSummary, setLogSummary] = useState<LogSummary>({ success: 0, skipped: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('daily');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const since90d = subDays(new Date(), 90).toISOString();

      const [postsRes, genRes, viewsRes, logsRes] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id, title, slug, category, published, published_at, created_at, views')
          .order('created_at', { ascending: true }),
        supabase.from('ai_generated_posts').select('blog_post_id, generation_source, generated_at'),
        supabase.from('blog_view_events').select('viewed_at').gte('viewed_at', since90d),
        supabase
          .from('application_logs')
          .select('level, message, logged_at')
          .ilike('message', 'Auto-geração:%')
          .gte('logged_at', since90d),
      ]);

      if (postsRes.error) throw postsRes.error;
      if (genRes.error) throw genRes.error;
      if (viewsRes.error) throw viewsRes.error;
      if (logsRes.error) throw logsRes.error;

      // blog_post_id -> generation_source mais recente (pode haver mais de 1
      // linha de ai_generated_posts por post, ex. regeneração de imagem).
      const sourceByPost = new Map<string, string | null>();
      for (const row of genRes.data || []) {
        if (!row.blog_post_id) continue;
        const prev = sourceByPost.get(row.blog_post_id);
        if (prev === undefined) sourceByPost.set(row.blog_post_id, row.generation_source);
      }

      setPosts(
        (postsRes.data || []).map((p) => ({
          ...p,
          source: sourceByPost.get(p.id) ?? null,
        }))
      );
      setViewEvents(viewsRes.data || []);

      const summary: LogSummary = { success: 0, skipped: 0, failed: 0 };
      for (const log of logsRes.data || []) {
        if (log.level === 'error') summary.failed += 1;
        else if (log.message.includes('skipped') || log.level === 'warn') summary.skipped += 1;
        else summary.success += 1;
      }
      setLogSummary(summary);
    } catch (error) {
      logger.error('[ContentDashboard] Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const bucketConfig = () => {
    switch (period) {
      case 'daily':
        return { startDate: subDays(new Date(), 30), groupBy: (d: Date) => format(startOfDay(d), 'yyyy-MM-dd'), dateFormat: 'dd/MM' };
      case 'weekly':
        return {
          startDate: subWeeks(new Date(), 12),
          groupBy: (d: Date) => format(startOfWeek(d, { locale: ptBR }), 'yyyy-MM-dd'),
          dateFormat: 'dd/MM',
        };
      case 'monthly':
        return { startDate: subMonths(new Date(), 12), groupBy: (d: Date) => format(startOfMonth(d), 'yyyy-MM'), dateFormat: 'MMM/yy' };
    }
  };

  const { startDate, groupBy, dateFormat } = bucketConfig();
  const postsInPeriod = posts.filter((p) => new Date(p.created_at) >= startDate);

  const publishVsDraftData = (() => {
    const grouped: Record<string, { publicado: number; rascunho: number }> = {};
    for (const p of postsInPeriod) {
      const key = groupBy(new Date(p.created_at));
      if (!grouped[key]) grouped[key] = { publicado: 0, rascunho: 0 };
      if (p.published) grouped[key].publicado += 1;
      else grouped[key].rascunho += 1;
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: format(new Date(date), dateFormat, { locale: ptBR }), ...v }));
  })();

  const viewsOverTimeData = (() => {
    const grouped: Record<string, number> = {};
    for (const ev of viewEvents) {
      if (new Date(ev.viewed_at) < startDate) continue;
      const key = groupBy(new Date(ev.viewed_at));
      grouped[key] = (grouped[key] || 0) + 1;
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date: format(new Date(date), dateFormat, { locale: ptBR }), views }));
  })();

  const sourceBreakdown = (() => {
    const counts: Record<string, number> = {};
    for (const p of postsInPeriod) {
      const label = SOURCE_LABELS[p.source ?? ''] ?? UNKNOWN_SOURCE_LABEL;
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const totalPublished = posts.filter((p) => p.published).length;
  const totalDrafts = posts.filter((p) => !p.published).length;
  const totalViews = posts.reduce((acc, p) => acc + (p.views || 0), 0);
  const unattendedPublished = posts.filter(
    (p) => p.published && p.source && UNATTENDED_SOURCES.has(p.source)
  ).length;
  const topViewed = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum artigo gerado ainda. Gere alguns artigos para ver as estatísticas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Publicados</CardDescription>
            <CardTitle className="text-2xl">{totalPublished}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rascunhos pendentes</CardDescription>
            <CardTitle className="text-2xl">{totalDrafts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visualizações totais</CardDescription>
            <CardTitle className="text-2xl">{totalViews.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Publicados sem revisão</CardDescription>
            <CardTitle className="text-2xl text-primary">{unattendedPublished}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saúde do automático (cron)</CardTitle>
          <CardDescription>Últimos 90 dias, lido de application_logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-emerald-500">{logSummary.success}</div>
              <div className="text-xs text-muted-foreground">✅ sucessos</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-500">{logSummary.skipped}</div>
              <div className="text-xs text-muted-foreground">⚠️ pulados</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-500">{logSummary.failed}</div>
              <div className="text-xs text-muted-foreground">❌ falhas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Geração por período</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="daily">Diário</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Publicado vs. rascunho</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={publishVsDraftData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="publicado" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="rascunho" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Visualizações ao longo do tempo</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viewsOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="views" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Artigos gerados por tipo</h4>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {sourceBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3">Top 5 mais lidos</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {topViewed.map((p) => (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-2 pr-2 truncate max-w-[220px]">{p.title}</td>
                        <td className="py-2 text-right font-medium text-primary">
                          {(p.views || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentDashboard;
