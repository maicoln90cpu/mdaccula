import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Eye, Share2, Calendar, TrendingUp, Newspaper } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { OptimizedImage } from '@/components/OptimizedImage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SEOHead } from '@/components/SEOHead';
import { PageHeader } from '@/components/ui/page-header';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Analytics() {
  // Top 10 posts mais lidos
  const { data: topPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ['top-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('title, slug, views, image_url, category')
        .eq('published', true)
        .order('views', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Top 10 eventos mais populares
  const { data: topEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['top-events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('title, slug, views, image_url')
        .eq('status', 'active')
        .order('views', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Compartilhamentos por plataforma
  const { data: shareStats, isLoading: loadingShares } = useQuery({
    queryKey: ['share-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('share_analytics')
        .select('platform')
        .gte('shared_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Agrupar por plataforma
      const grouped = data?.reduce(
        (acc: Record<string, number>, { platform }) => {
          acc[platform] = (acc[platform] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return Object.entries(grouped || {}).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));
    },
  });

  // Total de views do site
  const { data: totalViews } = useQuery({
    queryKey: ['total-views'],
    queryFn: async () => {
      const [posts, events] = await Promise.all([
        supabase.from('blog_posts').select('views'),
        supabase.from('events').select('views').eq('status', 'active'),
      ]);

      const postViews = posts.data?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;
      const eventViews = events.data?.reduce((sum, e) => sum + (e.views || 0), 0) || 0;

      return postViews + eventViews;
    },
  });

  // Total de posts
  const { data: totalPosts } = useQuery({
    queryKey: ['total-posts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('published', true);
      return count || 0;
    },
  });

  // Total de compartilhamentos
  const totalShares = shareStats?.reduce((sum, s) => sum + (s.value as number), 0) || 0;

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <SEOHead
          title="Analytics | MD'Accula"
          description="Estatísticas públicas de visualizações e compartilhamentos do MD'Accula"
          url="/analytics"
        />
        <Navigation />
        <main id="main-content" className="pt-16">
          <PageHeader
            title="Analytics Público"
            subtitle="Transparência total sobre o desempenho do site"
            breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Analytics' }]}
            variant="plain"
            align="center"
            icon={TrendingUp}
          />
          <div className="container mx-auto px-4 py-8">
            {/* Cards de métricas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total de Views</CardTitle>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalViews?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Desde o início</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Posts Publicados</CardTitle>
                  <Newspaper className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalPosts}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total de artigos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Compartilhamentos</CardTitle>
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalShares}</div>
                  <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Eventos</CardTitle>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{topEvents?.length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Com estatísticas</p>
                </CardContent>
              </Card>
            </div>

            {/* Top 10 Posts */}
            <Card className="mb-12">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Top 10 Posts Mais Lidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPosts ? (
                  <Skeleton className="h-64" />
                ) : (
                  <>
                    <div className="overflow-hidden">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topPosts?.slice(0, 10)}>
                          <XAxis
                            dataKey="title"
                            angle={-45}
                            textAnchor="end"
                            height={120}
                            fontSize={12}
                            tickFormatter={(title: string) =>
                              title.length > 14 ? `${title.slice(0, 14)}…` : title
                            }
                          />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="views" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lista com links */}
                    <div className="mt-6 space-y-3">
                      {topPosts?.map((post, i) => (
                        <a
                          key={post.slug}
                          href={`/blog/${post.slug}`}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
                        >
                          <span className="text-2xl font-bold text-muted-foreground w-8">
                            {i + 1}
                          </span>
                          {post.image_url && (
                            <OptimizedImage
                              src={post.image_url}
                              alt={post.title}
                              className="w-16 h-16 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold line-clamp-1">{post.title}</h3>
                            <span className="text-xs text-muted-foreground">{post.category}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{post.views?.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">visualizações</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compartilhamentos por Plataforma */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Share2 className="w-6 h-6 text-primary" />
                    Compartilhamentos
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
                </CardHeader>
                <CardContent>
                  {loadingShares ? (
                    <Skeleton className="h-64" />
                  ) : shareStats && shareStats.length > 0 ? (
                    <div className="overflow-hidden">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={shareStats}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label
                          >
                            {shareStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Nenhum compartilhamento registrado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Eventos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-primary" />
                    Top Eventos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingEvents ? (
                    <Skeleton className="h-64" />
                  ) : topEvents && topEvents.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {topEvents.slice(0, 5).map((event, i) => (
                        <a
                          key={event.slug}
                          href={`/eventos#${event.slug}`}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
                        >
                          <span className="text-xl font-bold text-muted-foreground w-6">
                            {i + 1}
                          </span>
                          {event.image_url && (
                            <OptimizedImage
                              src={event.image_url}
                              alt={event.title}
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold line-clamp-1">{event.title}</h3>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{event.views?.toLocaleString() || 0}</div>
                            <div className="text-xs text-muted-foreground">views</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Nenhum evento com estatísticas
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
