import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib';
import type {
  LinkAnalytics,
  GroupAnalytics,
  EventAnalytics,
  BlogAnalytics,
  RedirectAnalytics,
  TimePeriod,
} from './types';

export function useLinksAnalytics(timePeriod: TimePeriod) {
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

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (timePeriod) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  }, [timePeriod]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const dateFilter = getDateFilter();

      const { data: linksData, error: linksError } = await supabase
        .from('custom_links')
        .select(`id, title, url, clicks, is_internal, link_groups (name)`)
        .order('clicks', { ascending: false });
      if (linksError) throw linksError;

      const { data: blogData, error: blogError } = await supabase
        .from('blog_posts')
        .select('id, title, slug, views, likes, category')
        .eq('published', true)
        .order('views', { ascending: false });
      if (blogError) throw blogError;

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, slug, views, date, venue')
        .eq('status', 'active')
        .order('views', { ascending: false, nullsFirst: false });
      if (eventsError) throw eventsError;

      const { data: redirectsData, error: redirectsError } = await supabase
        .from('redirect_links')
        .select('id, slug, destination_url, description, clicks, enabled')
        .order('clicks', { ascending: false });
      if (redirectsError) throw redirectsError;

      const linkClicksByPeriod: Record<string, number> = {};
      const blogViewsByPeriod: Record<string, number> = {};
      const eventViewsByPeriod: Record<string, number> = {};
      const redirectClicksByPeriod: Record<string, number> = {};

      if (dateFilter) {
        const linkClicks = await fetchAllPaginated<{ link_id: string }>((from, to) =>
          supabase
            .from('link_click_events')
            .select('link_id')
            .gte('clicked_at', dateFilter)
            .range(from, to)
        );
        linkClicks.forEach((row) => {
          linkClicksByPeriod[row.link_id] = (linkClicksByPeriod[row.link_id] || 0) + 1;
        });

        const blogViews = await fetchAllPaginated<{ post_id: string }>((from, to) =>
          supabase
            .from('blog_view_events')
            .select('post_id')
            .gte('viewed_at', dateFilter)
            .range(from, to)
        );
        blogViews.forEach((row) => {
          blogViewsByPeriod[row.post_id] = (blogViewsByPeriod[row.post_id] || 0) + 1;
        });

        const eventViews = await fetchAllPaginated<{ event_id: string }>((from, to) =>
          supabase
            .from('event_view_events')
            .select('event_id')
            .gte('viewed_at', dateFilter)
            .range(from, to)
        );
        eventViews.forEach((row) => {
          eventViewsByPeriod[row.event_id] = (eventViewsByPeriod[row.event_id] || 0) + 1;
        });

        const clickEvents = await fetchAllPaginated<{ redirect_link_id: string }>((from, to) =>
          supabase
            .from('redirect_click_events')
            .select('redirect_link_id')
            .gte('clicked_at', dateFilter)
            .range(from, to)
        );
        clickEvents.forEach((row) => {
          redirectClicksByPeriod[row.redirect_link_id] =
            (redirectClicksByPeriod[row.redirect_link_id] || 0) + 1;
        });
      }

      const processedLinks =
        linksData?.map((link) => ({
          id: link.id,
          title: link.title,
          url: link.url,
          clicks: dateFilter ? linkClicksByPeriod[link.id] || 0 : link.clicks || 0,
          group_name: link.link_groups?.name || 'Sem grupo',
          is_internal: link.is_internal,
        })) || [];
      processedLinks.sort((a, b) => b.clicks - a.clicks);
      setLinks(processedLinks);

      const processedBlog =
        blogData?.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          views: dateFilter ? blogViewsByPeriod[post.id] || 0 : post.views || 0,
          likes: post.likes || 0,
          category: post.category,
        })) || [];
      processedBlog.sort((a, b) => b.views - a.views);
      setBlogPosts(processedBlog);

      setTotalClicks(processedLinks.reduce((sum, link) => sum + link.clicks, 0));
      setTotalViews(processedBlog.reduce((sum, post) => sum + post.views, 0));
      setTotalLikes(processedBlog.reduce((sum, post) => sum + post.likes, 0));

      const processedEvents =
        eventsData?.map((event) => ({
          id: event.id,
          title: event.title,
          slug: event.slug,
          views: dateFilter ? eventViewsByPeriod[event.id] || 0 : event.views || 0,
          date: event.date,
          venue: event.venue,
        })) || [];
      processedEvents.sort((a, b) => b.views - a.views);
      setEvents(processedEvents);
      setTotalEventViews(processedEvents.reduce((sum, e) => sum + e.views, 0));

      const processedRedirects =
        redirectsData?.map((r) => ({
          id: r.id,
          slug: r.slug,
          destination_url: r.destination_url,
          description: r.description,
          clicks: dateFilter ? redirectClicksByPeriod[r.id] || 0 : r.clicks || 0,
          enabled: r.enabled,
        })) || [];
      processedRedirects.sort((a, b) => b.clicks - a.clicks);
      setRedirects(processedRedirects);
      setTotalRedirectClicks(
        processedRedirects.reduce((sum: number, r: RedirectAnalytics) => sum + r.clicks, 0)
      );

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
      console.error('Error fetching analytics:', error);
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  }, [getDateFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    links,
    groups,
    blogPosts,
    events,
    redirects,
    loading,
    totalClicks,
    totalViews,
    totalLikes,
    totalEventViews,
    totalRedirectClicks,
  };
}
