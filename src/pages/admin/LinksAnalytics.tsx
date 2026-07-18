import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, TrendingUp, MousePointerClick, Eye, Heart, FileText, Link as LinkIcon, ChevronDown, ChevronRight, Calendar, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface LinkAnalytics {
  id: string;
  title: string;
  url: string;
  clicks: number;
  group_name: string;
  is_internal: boolean;
}

interface GroupAnalytics {
  group_name: string;
  total_clicks: number;
  link_count: number;
}

interface EventAnalytics {
  id: string;
  title: string;
  slug: string;
  views: number;
  date: string;
  venue: string;
}

interface BlogAnalytics {
  id: string;
  title: string;
  slug: string;
  views: number;
  likes: number;
  category: string;
}

interface RedirectAnalytics {
  id: string;
  slug: string;
  destination_url: string;
  description: string | null;
  clicks: number;
  enabled: boolean;
}

const LinksAnalytics = () => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [groups, setGroups] = useState<GroupAnalytics[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogAnalytics[]>([]);
  const [events, setEvents] = useState<EventAnalytics[]>([]);
  const [redirects, setRedirects] = useState<RedirectAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClicks, setTotalClicks] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalEventViews, setTotalEventViews] = useState(0);
  const [totalRedirectClicks, setTotalRedirectClicks] = useState(0);
  
  // Estados para seções colapsáveis — iniciam colapsadas
  const [linksOpen, setLinksOpen] = useState(false);
  const [blogOpen, setBlogOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [linkPerformanceOpen, setLinkPerformanceOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [redirectsOpen, setRedirectsOpen] = useState(false);
  
  // Filtro de período
  const [timePeriod, setTimePeriod] = useState<'today' | '7d' | '30d' | 'all'>('all');

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (timePeriod) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return null;
    }
  }, [timePeriod]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const dateFilter = getDateFilter();

      // Buscar metadados dos links com seus grupos
      const { data: linksData, error: linksError } = await supabase
        .from("custom_links")
        .select(`id, title, url, clicks, is_internal, link_groups (name)`)
        .order("clicks", { ascending: false });

      if (linksError) throw linksError;

      // Buscar metadados do blog
      const { data: blogData, error: blogError } = await supabase
        .from("blog_posts")
        .select("id, title, slug, views, likes, category")
        .eq("published", true)
        .order("views", { ascending: false });

      if (blogError) throw blogError;

      // Buscar metadados dos eventos
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, title, slug, views, date, venue")
        .eq("status", "active")
        .order("views", { ascending: false, nullsFirst: false });

      if (eventsError) throw eventsError;

      // Buscar metadados dos redirect links
      const { data: redirectsData, error: redirectsError } = await supabase
        .from("redirect_links")
        .select("id, slug, destination_url, description, clicks, enabled")
        .order("clicks", { ascending: false });

      if (redirectsError) throw redirectsError;

      // Se há filtro de período, buscar contagens das tabelas de tracking
      const linkClicksByPeriod: Record<string, number> = {};
      const blogViewsByPeriod: Record<string, number> = {};
      const eventViewsByPeriod: Record<string, number> = {};
      const redirectClicksByPeriod: Record<string, number> = {};

      if (dateFilter) {
        // Buscar cliques de links por período
        const { data: linkClicks } = await supabase
          .from("link_click_events")
          .select("link_id")
          .gte("clicked_at", dateFilter);
        if (linkClicks) {
          linkClicks.forEach((row) => {
            linkClicksByPeriod[row.link_id] = (linkClicksByPeriod[row.link_id] || 0) + 1;
          });
        }

        // Buscar views de blog por período
        const { data: blogViews } = await supabase
          .from("blog_view_events")
          .select("post_id")
          .gte("viewed_at", dateFilter);
        if (blogViews) {
          blogViews.forEach((row) => {
            blogViewsByPeriod[row.post_id] = (blogViewsByPeriod[row.post_id] || 0) + 1;
          });
        }

        // Buscar views de eventos por período
        const { data: eventViews } = await supabase
          .from("event_view_events")
          .select("event_id")
          .gte("viewed_at", dateFilter);
        if (eventViews) {
          eventViews.forEach((row) => {
            eventViewsByPeriod[row.event_id] = (eventViewsByPeriod[row.event_id] || 0) + 1;
          });
        }

        // Buscar cliques de redirect por período
        const { data: clickEvents } = await supabase
          .from("redirect_click_events")
          .select("redirect_link_id")
          .gte("clicked_at", dateFilter);
        if (clickEvents) {
          clickEvents.forEach((row) => {
            redirectClicksByPeriod[row.redirect_link_id] = (redirectClicksByPeriod[row.redirect_link_id] || 0) + 1;
          });
        }
      }

      // Processar dados dos links
      const processedLinks = linksData?.map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        clicks: dateFilter ? (linkClicksByPeriod[link.id] || 0) : (link.clicks || 0),
        group_name: link.link_groups?.name || "Sem grupo",
        is_internal: link.is_internal,
      })) || [];

      // Ordenar por cliques (do período ou total)
      processedLinks.sort((a, b) => b.clicks - a.clicks);
      setLinks(processedLinks);

      // Processar dados do blog
      const processedBlog = blogData?.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        views: dateFilter ? (blogViewsByPeriod[post.id] || 0) : (post.views || 0),
        likes: post.likes || 0,
        category: post.category,
      })) || [];

      processedBlog.sort((a, b) => b.views - a.views);
      setBlogPosts(processedBlog);

      // Calcular totais
      const clicksTotal = processedLinks.reduce((sum, link) => sum + link.clicks, 0);
      setTotalClicks(clicksTotal);

      const viewsTotal = processedBlog.reduce((sum, post) => sum + post.views, 0);
      setTotalViews(viewsTotal);

      const likesTotal = processedBlog.reduce((sum, post) => sum + post.likes, 0);
      setTotalLikes(likesTotal);

      // Processar dados dos eventos
      const processedEvents = eventsData?.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        views: dateFilter ? (eventViewsByPeriod[event.id] || 0) : (event.views || 0),
        date: event.date,
        venue: event.venue,
      })) || [];

      processedEvents.sort((a, b) => b.views - a.views);
      setEvents(processedEvents);
      const eventViewsTotal = processedEvents.reduce((sum, e) => sum + e.views, 0);
      setTotalEventViews(eventViewsTotal);

      // Processar dados dos redirects
      const processedRedirects = redirectsData?.map((r) => ({
        id: r.id,
        slug: r.slug,
        destination_url: r.destination_url,
        description: r.description,
        clicks: dateFilter ? (redirectClicksByPeriod[r.id] || 0) : (r.clicks || 0),
        enabled: r.enabled,
      })) || [];

      processedRedirects.sort((a, b) => b.clicks - a.clicks);
      setRedirects(processedRedirects);
      const redirectClicksTotal = processedRedirects.reduce((sum: number, r: RedirectAnalytics) => sum + r.clicks, 0);
      setTotalRedirectClicks(redirectClicksTotal);

      // Agrupar dados por grupo
      const groupMap = new Map<string, { total_clicks: number; link_count: number }>();
      processedLinks.forEach((link) => {
        const existing = groupMap.get(link.group_name) || { total_clicks: 0, link_count: 0 };
        groupMap.set(link.group_name, {
          total_clicks: existing.total_clicks + link.clicks,
          link_count: existing.link_count + 1,
        });
      });

      const groupsData = Array.from(groupMap.entries())
        .map(([name, data]) => ({
          group_name: name,
          total_clicks: data.total_clicks,
          link_count: data.link_count,
        }))
        .sort((a, b) => b.total_clicks - a.total_clicks);

      setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Erro ao carregar analytics");
    } finally {
      setLoading(false);
    }
  }, [getDateFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">
                Performance de links e blog posts
              </p>
            </div>
          </div>

          {/* Filtro de período */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {([
              { value: 'today', label: 'Hoje' },
              { value: '7d', label: '7 dias' },
              { value: '30d', label: '30 dias' },
              { value: 'all', label: 'Todo período' },
            ] as const).map(opt => (
              <Button
                key={opt.value}
                variant={timePeriod === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            {timePeriod !== 'all' && (
              <span className="text-xs text-muted-foreground self-center ml-2">
                ℹ️ Dados filtrados por período usando tabelas de tracking. Dados anteriores à ativação do tracking não aparecem.
              </span>
            )}
          </div>

          {/* Cards de resumo geral */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Cliques em Links
                </CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClicks}</div>
                {timePeriod !== 'all' && <p className="text-xs text-muted-foreground">no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Links
                </CardTitle>
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{links.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Views em Eventos
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEventViews}</div>
                {timePeriod !== 'all' && <p className="text-xs text-muted-foreground">no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Views do Blog
                </CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalViews}</div>
                {timePeriod !== 'all' && <p className="text-xs text-muted-foreground">no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Likes do Blog
                </CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLikes}</div>
                {timePeriod !== 'all' && <p className="text-xs text-muted-foreground">no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Posts Publicados
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{blogPosts.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Redirects
                </CardTitle>
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRedirectClicks}</div>
                <p className="text-xs text-muted-foreground">
                  {redirects.length} links{timePeriod !== 'all' ? ' • filtrado por período' : ''}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Seção de Links - Colapsável */}
          <Collapsible open={linksOpen} onOpenChange={setLinksOpen} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-5 w-5" />
                      <CardTitle>Analytics de Links</CardTitle>
                    </div>
                    {linksOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    Clique para {linksOpen ? "colapsar" : "expandir"} os dados de links
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Performance por Grupo */}
                  <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Performance por Grupo
                        </h3>
                        {groupsOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 mt-4">
                        {groups.map((group) => (
                          <div key={group.group_name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{group.group_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {group.link_count} {group.link_count === 1 ? "link" : "links"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">{group.total_clicks}</p>
                                <p className="text-xs text-muted-foreground">cliques</p>
                              </div>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{
                                  width: `${totalClicks > 0 ? (group.total_clicks / totalClicks) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Performance por Link */}
                  <Collapsible open={linkPerformanceOpen} onOpenChange={setLinkPerformanceOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <MousePointerClick className="h-5 w-5" />
                          Performance por Link
                        </h3>
                        {linkPerformanceOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 mt-4">
                        {links.slice(0, 10).map((link) => (
                          <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{link.title}</p>
                                {link.is_internal ? (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex-shrink-0">
                                    Interno
                                  </span>
                                ) : (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex-shrink-0">
                                    Externo
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{link.group_name}</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-xl font-bold">{link.clicks}</p>
                              <p className="text-xs text-muted-foreground">
                                {totalClicks > 0 ? `${((link.clicks / totalClicks) * 100).toFixed(1)}%` : "0%"}
                              </p>
                            </div>
                          </div>
                        ))}
                        {links.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum link encontrado
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Seção de Eventos - Colapsável */}
          <Collapsible open={eventsOpen} onOpenChange={setEventsOpen} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      <CardTitle>Analytics de Eventos</CardTitle>
                    </div>
                    {eventsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    {events.length} eventos • {totalEventViews} views totais
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {events.slice(0, 20).map((event, index) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                          <div className="min-w-0">
                            <Link 
                              to={`/eventos/${event.slug}`} 
                              className="font-medium hover:text-primary truncate block"
                              target="_blank"
                            >
                              {event.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {event.venue} • {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-xl font-bold">{event.views}</p>
                          <p className="text-xs text-muted-foreground">
                            {totalEventViews > 0 ? `${((event.views / totalEventViews) * 100).toFixed(1)}%` : "0%"}
                          </p>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum evento encontrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Seção de Redirect Links - Colapsável */}
          <Collapsible open={redirectsOpen} onOpenChange={setRedirectsOpen} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-5 w-5" />
                      <CardTitle>Analytics de Redirect Links</CardTitle>
                    </div>
                    {redirectsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    {redirects.length} links curtos • {totalRedirectClicks} cliques totais
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {redirects.map((redirect, index) => (
                      <div key={redirect.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">/r/{redirect.slug}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {redirect.description || redirect.destination_url}
                            </p>
                          </div>
                          {!redirect.enabled && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded flex-shrink-0">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-xl font-bold">{redirect.clicks}</p>
                          <p className="text-xs text-muted-foreground">
                            {totalRedirectClicks > 0 ? `${((redirect.clicks / totalRedirectClicks) * 100).toFixed(1)}%` : "0%"}
                          </p>
                        </div>
                      </div>
                    ))}
                    {redirects.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum redirect link encontrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Seção de Blog - Colapsável */}
          <Collapsible open={blogOpen} onOpenChange={setBlogOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      <CardTitle>Analytics do Blog</CardTitle>
                    </div>
                    {blogOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    Clique para {blogOpen ? "colapsar" : "expandir"} os dados do blog
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Posts mais vistos */}
                  <Collapsible open={viewsOpen} onOpenChange={setViewsOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Eye className="h-5 w-5" />
                          Posts Mais Vistos
                        </h3>
                        {viewsOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 mt-4">
                        {blogPosts.slice(0, 10).map((post, index) => (
                          <div key={post.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{post.title}</p>
                                <p className="text-sm text-muted-foreground">{post.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-bold">{post.views}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  <Heart className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-bold">{post.likes}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {blogPosts.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum post publicado
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Posts mais curtidos */}
                  <Collapsible open={likesOpen} onOpenChange={setLikesOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Heart className="h-5 w-5" />
                          Posts Mais Curtidos
                        </h3>
                        {likesOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 mt-4">
                        {[...blogPosts]
                          .sort((a, b) => b.likes - a.likes)
                          .slice(0, 10)
                          .map((post, index) => (
                            <div key={post.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{post.title}</p>
                                  <p className="text-sm text-muted-foreground">{post.category}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                <div className="text-right">
                                  <div className="flex items-center gap-1">
                                    <Heart className="h-4 w-4 text-red-500" />
                                    <span className="font-bold">{post.likes}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1">
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-bold">{post.views}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </main>
      </div>
    </>
  );
};

export default LinksAnalytics;