import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sortByEventDate, logger } from "@/lib";
import { isEventVisible, type TimezoneSettings } from "@/lib/eventDateHelper";
import { toast } from "sonner";
import type { RawLinkData } from "@/types";

interface LinkEvent {
  venue: string;
  location_city: string;
  location_state: string;
  date: string;
  time: string;
  image_url?: string | null;
}

export interface CustomLink {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string;
  clicks: number;
  enabled: boolean;
  is_internal: boolean;
  is_featured?: boolean;
  display_order: number;
  card_height?: number;
  card_width?: number;
  group_id?: string;
  event_id?: string | null;
  override_date?: string | null;
  override_time?: string | null;
  manual_order_override?: boolean;
  events?: LinkEvent | null;
}

export interface LinkGroup {
  id: string;
  name: string;
  slug: string;
  custom_links: CustomLink[];
}

export interface UseLinksOptions {
  graceHours?: number;
  timezoneOffset?: number;
}

const LINKS_CACHE_KEY = 'mdaccula-links-cache';

const getCachedLinks = (): LinkGroup[] | null => {
  try {
    const cached = localStorage.getItem(LINKS_CACHE_KEY);
    if (!cached) return null;
    const { data } = JSON.parse(cached);
    return data;
  } catch {
    return null;
  }
};

const setCachedLinks = (data: LinkGroup[]) => {
  try {
    localStorage.setItem(LINKS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
};

const processLinks = (
  links: RawLinkData[], 
  settings: Partial<TimezoneSettings> = {}
): CustomLink[] => {
  return links
    .map((link) => {
      const eventDate = link.events?.date || link.override_date;
      const eventTime = link.events?.time || link.override_time || "22:00";
      
      if (eventDate) {
        const isVisible = isEventVisible(
          { date: eventDate, time: eventTime, end_time: null },
          settings
        );
        if (!isVisible) {
          return { ...link, enabled: false };
        }
      }
      return link;
    })
    .filter((link): link is CustomLink => link.enabled === true)
    .sort(sortByEventDate);
};

export const useLinks = (options: UseLinksOptions = {}) => {
  const [groups, setGroups] = useState<LinkGroup[]>(() => getCachedLinks() || []);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const { graceHours = 6, timezoneOffset = -3 } = options;

  const fetchLinks = useCallback(async () => {
    try {
      setFetchError(null);
      const visibilitySettings: Partial<TimezoneSettings> = {
        graceHours,
        timezoneOffset,
      };

      const { data, error } = await supabase
        .from("link_groups")
        .select(`
          id, name, slug, display_order, enabled,
          custom_links (
            id, title, subtitle, url, thumbnail_url, icon, color_gradient,
            enabled, is_featured, display_order, card_height, card_width,
            group_id, event_id, override_date, override_time, manual_order_override,
            is_internal, clicks,
            events:event_id (
              venue, location_city, location_state, date, time, image_url
            )
          )
        `)
        .eq("enabled", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const groupsWithLinks = data?.map((group) => ({
        ...group,
        custom_links: processLinks(group.custom_links || [], visibilitySettings),
      }));

      const result = groupsWithLinks || [];
      setGroups(result);
      setCachedLinks(result);
    } catch (error) {
      logger.error("Error fetching links", error, { component: 'useLinks' });
      setFetchError(error as Error);
      // If we have no data yet, try localStorage fallback
      if (groups.length === 0) {
        const cached = getCachedLinks();
        if (cached && cached.length > 0) {
          setGroups(cached);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [graceHours, timezoneOffset]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => { await fetchLinks(); };
    if (isMounted) { load(); }
    return () => { isMounted = false; };
  }, [fetchLinks]);

  const duplicateLink = async (link: CustomLink) => {
    try {
      const maxOrder = groups
        .find(g => g.id === link.group_id)
        ?.custom_links.reduce((max, l) => Math.max(max, l.display_order), 0) || 0;

      const { error } = await supabase
        .from("custom_links")
        .insert({
          title: `${link.title} (cópia)`,
          subtitle: link.subtitle,
          url: link.url,
          thumbnail_url: link.thumbnail_url,
          icon: link.icon,
          color_gradient: link.color_gradient,
          enabled: link.enabled,
          is_internal: link.is_internal,
          is_featured: link.is_featured,
          group_id: link.group_id,
          event_id: link.event_id,
          display_order: maxOrder + 1,
          card_height: link.card_height,
          card_width: link.card_width,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Link duplicado com sucesso!");
      await fetchLinks();
    } catch (error) {
      logger.error("Erro ao duplicar link", error, { component: 'useLinks' });
      toast.error("Erro ao duplicar link");
    }
  };

  const updateLinkOrder = async (
    activeId: string,
    overId: string,
    activeGroupId: string,
    overGroupId: string
  ) => {
    const activeGroup = groups.find(g => g.id === activeGroupId);
    const overGroup = groups.find(g => g.id === overGroupId);
    if (!activeGroup || !overGroup) return;

    const activeLink = activeGroup.custom_links.find(l => l.id === activeId);
    const overLink = overGroup.custom_links.find(l => l.id === overId);
    if (!activeLink || !overLink) return;

    const newGroups = [...groups];

    if (activeGroupId !== overGroupId) {
      const activeGroupIndex = newGroups.findIndex(g => g.id === activeGroupId);
      newGroups[activeGroupIndex].custom_links = newGroups[activeGroupIndex].custom_links.filter(l => l.id !== activeId);
      const overGroupIndex = newGroups.findIndex(g => g.id === overGroupId);
      const overLinkIndex = newGroups[overGroupIndex].custom_links.findIndex(l => l.id === overId);
      newGroups[overGroupIndex].custom_links.splice(overLinkIndex, 0, { ...activeLink, group_id: overGroupId, manual_order_override: true });
      await supabase.from("custom_links").update({ group_id: overGroupId, manual_order_override: true }).eq("id", activeId);
    } else {
      const groupIndex = newGroups.findIndex(g => g.id === activeGroupId);
      const oldIndex = newGroups[groupIndex].custom_links.findIndex(l => l.id === activeId);
      const newIndex = newGroups[groupIndex].custom_links.findIndex(l => l.id === overId);
      const [removed] = newGroups[groupIndex].custom_links.splice(oldIndex, 1);
      newGroups[groupIndex].custom_links.splice(newIndex, 0, { ...removed, manual_order_override: true });
    }

    const affectedGroupIds = new Set([activeGroupId, overGroupId]);
    const allUpdates: { id: string; display_order: number; manual_order_override: boolean }[] = [];
    for (const group of newGroups) {
      if (affectedGroupIds.has(group.id)) {
        group.custom_links.forEach((link, index) => {
          allUpdates.push({
            id: link.id,
            display_order: index,
            manual_order_override: link.id === activeId ? true : (link.manual_order_override || false),
          });
        });
      }
    }

    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
      batches.push(allUpdates.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(
      batches.map(batch =>
        Promise.all(
          batch.map(update =>
            supabase.from("custom_links").update({ display_order: update.display_order, manual_order_override: update.manual_order_override }).eq("id", update.id)
          )
        )
      )
    );

    setGroups(newGroups);
  };

  return {
    groups,
    loading,
    fetchError,
    refetchLinks: fetchLinks,
    duplicateLink,
    updateLinkOrder,
    setGroups,
  };
};
