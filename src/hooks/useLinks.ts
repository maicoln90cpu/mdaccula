import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  hoursAfterStart?: number;
  hoursWithoutTime?: number;
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
  settings: TimezoneSettings = {}
): CustomLink[] => {
  return links
    .map((link) => {
      const eventDate = link.events?.date || link.override_date;
      const eventTime = link.events?.time || link.override_time || null;

      if (eventDate) {
        const isVisible = isEventVisible(
          { date: eventDate, time: eventTime },
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

const fetchLinksData = async (visibilitySettings: TimezoneSettings): Promise<LinkGroup[]> => {
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

  const result = data?.map((group) => ({
    ...group,
    custom_links: processLinks(group.custom_links || [], visibilitySettings),
  })) || [];

  setCachedLinks(result);
  return result;
};

export const useLinks = (options: UseLinksOptions = {}) => {
  const {
    hoursAfterStart = 12,
    hoursWithoutTime = 24,
    timezoneOffset = -3,
  } = options;
  const queryClient = useQueryClient();

  const visibilitySettings: TimezoneSettings = { hoursAfterStart, hoursWithoutTime, timezoneOffset };

  const query = useQuery({
    queryKey: ["link-groups", hoursAfterStart, hoursWithoutTime, timezoneOffset],
    queryFn: () => fetchLinksData(visibilitySettings),
    staleTime: 15 * 60 * 1000, // 15 min
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: () => getCachedLinks() ?? undefined,
  });

  const groups = query.data || getCachedLinks() || [];

  const refetchLinks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["link-groups"] });
  }, [queryClient]);

  const duplicateLink = useCallback(async (link: CustomLink) => {
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
      refetchLinks();
    } catch (error) {
      logger.error("Erro ao duplicar link", error, { component: 'useLinks' });
      toast.error("Erro ao duplicar link");
    }
  }, [groups, refetchLinks]);

  const updateLinkOrder = useCallback(async (
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

    // Optimistic update via query cache
    queryClient.setQueryData(["link-groups", hoursAfterStart, hoursWithoutTime, timezoneOffset], newGroups);
  }, [groups, queryClient, hoursAfterStart, hoursWithoutTime, timezoneOffset]);

  return {
    groups,
    loading: query.isLoading,
    fetchError: query.error as Error | null,
    refetchLinks,
    duplicateLink,
    updateLinkOrder,
    setGroups: (newGroups: LinkGroup[]) => {
      queryClient.setQueryData(["link-groups", hoursAfterStart, hoursWithoutTime, timezoneOffset], newGroups);
    },
  };
};
