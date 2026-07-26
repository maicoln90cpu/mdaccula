import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import { isEventVisible } from '@/lib/eventDateHelper';
import { processLinks, sortLinkGroups } from '@/hooks/useLinks';
import { getErrorMessage, type CustomLink, type LinkGroup } from './types';

export function useLinksManager() {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const { settings } = useSiteSettings();
  const { toast } = useToast();

  const filteredGroups = useMemo(() => {
    const hoursAfterStart = parseInt(settings?.event_hours_after_start || '12');
    const hoursWithoutTime = parseInt(settings?.event_hours_without_time || '24');
    const timezoneOffset = parseInt(settings?.timezone_offset || '-3');

    return groups
      .map((group) => {
        const filteredLinks =
          group.custom_links?.filter((link) => {
            if (statusFilter === 'all') return true;
            if (!link.event_id || !link.events?.date) {
              return statusFilter === 'active';
            }
            const isActive = isEventVisible(
              { date: link.events.date, time: link.events.time },
              { hoursAfterStart, hoursWithoutTime, timezoneOffset }
            );
            if (statusFilter === 'active') return isActive;
            if (statusFilter === 'inactive') return !isActive;
            return true;
          }) || [];
        return { ...group, custom_links: filteredLinks };
      })
      .filter((group) => {
        if (statusFilter === 'all') return true;
        return group.custom_links && group.custom_links.length > 0;
      });
  }, [groups, statusFilter, settings]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('link_groups')
        .select(
          `
          *,
          custom_links (
            *,
            events:event_id (date, end_date, time, end_time, venue, location_city, location_state, image_url)
          )
        `
        )
        .order('display_order', { ascending: true });

      if (error) throw error;

      const hoursAfterStart = parseInt(settings?.event_hours_after_start || '12');
      const hoursWithoutTime = parseInt(settings?.event_hours_without_time || '24');
      const timezoneOffset = parseInt(settings?.timezone_offset || '-3');
      const visibility = { hoursAfterStart, hoursWithoutTime, timezoneOffset };

      const withProcessed: LinkGroup[] = (data || []).map((group) => ({
        ...group,
        custom_links: processLinks(group.custom_links || [], visibility, {
          includeDisabled: true,
        }) as unknown as CustomLink[],
      }));

      setGroups(sortLinkGroups(withProcessed));
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar grupos',
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [settings, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useAdminRealtime(['custom_links', 'link_groups'], () => fetchGroups());

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith('group-') && overId.startsWith('group-')) {
        const activeIndex = groups.findIndex((g) => `group-${g.id}` === activeId);
        const overIndex = groups.findIndex((g) => `group-${g.id}` === overId);

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          const newGroups = arrayMove(groups, activeIndex, overIndex);
          setGroups(newGroups);
          for (let i = 0; i < newGroups.length; i++) {
            await supabase
              .from('link_groups')
              .update({ display_order: i })
              .eq('id', newGroups[i].id);
          }
          toast({ title: 'Ordem dos grupos atualizada' });
        }
        return;
      }

      const activeGroup = groups.find((g) => g.custom_links?.some((l) => l.id === activeId));
      const overGroup = groups.find((g) => g.custom_links?.some((l) => l.id === overId));
      if (!activeGroup || !overGroup) return;

      const newGroups = [...groups];

      if (activeGroup.id !== overGroup.id) {
        const activeGroupIndex = newGroups.findIndex((g) => g.id === activeGroup.id);
        const overGroupIndex = newGroups.findIndex((g) => g.id === overGroup.id);

        const activeLinks = [...(newGroups[activeGroupIndex].custom_links || [])];
        const overLinks = [...(newGroups[overGroupIndex].custom_links || [])];

        const linkIndex = activeLinks.findIndex((l) => l.id === activeId);
        const overLinkIndex = overLinks.findIndex((l) => l.id === overId);
        if (linkIndex === -1 || overLinkIndex === -1) return;

        const [movedLink] = activeLinks.splice(linkIndex, 1);
        overLinks.splice(overLinkIndex, 0, {
          ...movedLink,
          group_id: overGroup.id,
          manual_order_override: true,
        });

        newGroups[activeGroupIndex] = { ...newGroups[activeGroupIndex], custom_links: activeLinks };
        newGroups[overGroupIndex] = { ...newGroups[overGroupIndex], custom_links: overLinks };

        await supabase
          .from('custom_links')
          .update({ group_id: overGroup.id, manual_order_override: true })
          .eq('id', activeId);
      } else {
        const groupIndex = newGroups.findIndex((g) => g.id === activeGroup.id);
        const links = [...(newGroups[groupIndex].custom_links || [])];
        const oldIndex = links.findIndex((l) => l.id === activeId);
        const newIndex = links.findIndex((l) => l.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(links, oldIndex, newIndex);
        newGroups[groupIndex] = { ...newGroups[groupIndex], custom_links: reordered };
      }

      const affectedGroupIds = new Set([activeGroup.id, overGroup.id]);
      for (const group of newGroups) {
        if (affectedGroupIds.has(group.id) && group.custom_links) {
          for (let i = 0; i < group.custom_links.length; i++) {
            const link = group.custom_links[i];
            const isMovedLink = link.id === activeId;
            await supabase
              .from('custom_links')
              .update({
                display_order: i,
                manual_order_override: isMovedLink ? true : link.manual_order_override,
              })
              .eq('id', link.id);
          }
        }
      }

      setGroups(newGroups);
      toast({ title: 'Ordem dos links atualizada' });
    },
    [groups, toast]
  );

  const toggleGroupEnabled = useCallback(
    async (groupId: string, enabled: boolean) => {
      try {
        const { error } = await supabase
          .from('link_groups')
          .update({ enabled: !enabled })
          .eq('id', groupId);
        if (error) throw error;
        fetchGroups();
        toast({ title: enabled ? 'Grupo desabilitado' : 'Grupo habilitado' });
      } catch (error: unknown) {
        toast({ variant: 'destructive', title: 'Erro', description: getErrorMessage(error) });
      }
    },
    [fetchGroups, toast]
  );

  const toggleLinkEnabled = useCallback(
    async (linkId: string, enabled: boolean) => {
      try {
        const { error } = await supabase
          .from('custom_links')
          .update({ enabled: !enabled })
          .eq('id', linkId);
        if (error) throw error;
        fetchGroups();
        toast({ title: enabled ? 'Link desabilitado' : 'Link habilitado' });
      } catch (error: unknown) {
        toast({ variant: 'destructive', title: 'Erro', description: getErrorMessage(error) });
      }
    },
    [fetchGroups, toast]
  );

  const resetManualOrder = useCallback(
    async (linkId: string) => {
      try {
        const { error } = await supabase
          .from('custom_links')
          .update({ manual_order_override: false })
          .eq('id', linkId);
        if (error) throw error;
        fetchGroups();
        toast({
          title: 'Ordenação automática restaurada',
          description: 'O link voltará a ser ordenado por data do evento.',
        });
      } catch (error: unknown) {
        toast({ variant: 'destructive', title: 'Erro', description: getErrorMessage(error) });
      }
    },
    [fetchGroups, toast]
  );

  const deleteGroup = useCallback(
    async (deleteGroupId: string) => {
      try {
        const { error } = await supabase.from('link_groups').delete().eq('id', deleteGroupId);
        if (error) throw error;
        fetchGroups();
        toast({ title: 'Grupo excluído com sucesso' });
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir grupo',
          description: getErrorMessage(error),
        });
      }
    },
    [fetchGroups, toast]
  );

  const deleteLink = useCallback(
    async (idToDelete: string) => {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          custom_links: (g.custom_links || []).filter((l) => l.id !== idToDelete),
        }))
      );
      try {
        const { error } = await supabase.from('custom_links').delete().eq('id', idToDelete);
        if (error) throw error;
        fetchGroups();
        toast({ title: 'Link excluído com sucesso' });
      } catch (error: unknown) {
        fetchGroups();
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir link',
          description: getErrorMessage(error),
        });
      }
    },
    [fetchGroups, toast]
  );

  const duplicateLink = useCallback(
    async (link: CustomLink) => {
      try {
        const groupLinks = groups.find((g) => g.id === link.group_id)?.custom_links || [];
        const maxOrder =
          groupLinks.length > 0 ? Math.max(...groupLinks.map((l) => l.display_order)) : 0;

        const { error } = await supabase.from('custom_links').insert({
          title: `${link.title} (cópia)`,
          url: link.url,
          group_id: link.group_id,
          thumbnail_url: link.thumbnail_url,
          icon: link.icon,
          color_gradient: link.color_gradient,
          enabled: link.enabled,
          display_order: maxOrder + 1,
          is_internal: link.is_internal,
          subtitle: link.subtitle,
          is_featured: link.is_featured,
          card_height: link.card_height,
          card_width: link.card_width,
          event_id: link.event_id,
        });
        if (error) throw error;
        fetchGroups();
        toast({ title: 'Link duplicado com sucesso' });
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Erro ao duplicar link',
          description: getErrorMessage(error),
        });
      }
    },
    [groups, fetchGroups, toast]
  );

  const addLinkToGroup = useCallback(
    async (linkToAddToGroup: CustomLink, targetGroupId: string) => {
      try {
        const targetGroup = groups.find((g) => g.id === targetGroupId);
        const maxOrder = targetGroup?.custom_links?.length
          ? Math.max(...targetGroup.custom_links.map((l) => l.display_order))
          : 0;

        const { error } = await supabase.from('custom_links').insert({
          title: linkToAddToGroup.title,
          url: linkToAddToGroup.url,
          group_id: targetGroupId,
          thumbnail_url: linkToAddToGroup.thumbnail_url,
          icon: linkToAddToGroup.icon,
          color_gradient: linkToAddToGroup.color_gradient,
          enabled: linkToAddToGroup.enabled,
          display_order: maxOrder + 1,
          is_internal: linkToAddToGroup.is_internal,
          subtitle: linkToAddToGroup.subtitle,
          is_featured: linkToAddToGroup.is_featured,
          card_height: linkToAddToGroup.card_height,
          card_width: linkToAddToGroup.card_width,
          event_id: linkToAddToGroup.event_id,
        });
        if (error) throw error;
        fetchGroups();
        toast({ title: 'Link adicionado ao grupo com sucesso' });
        return true;
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Erro ao adicionar link',
          description: getErrorMessage(error),
        });
        return false;
      }
    },
    [groups, fetchGroups, toast]
  );

  const bulkUpdateSize = useCallback(
    async (bulkHeight: number, bulkWidth: number) => {
      try {
        const { error: heightError } = await supabase
          .from('site_settings')
          .upsert(
            { key: 'links_page_card_default_height', value: String(bulkHeight) },
            { onConflict: 'key' }
          );
        if (heightError) throw heightError;

        const { data: allLinks, error: fetchError } = await supabase
          .from('custom_links')
          .select('id');
        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
          .from('custom_links')
          .update({ card_width: bulkWidth })
          .in(
            'id',
            allLinks.map((link) => link.id)
          );
        if (updateError) throw updateError;

        fetchGroups();
        toast({
          title: 'Tamanhos atualizados com sucesso',
          description: `Altura padrão: ${bulkHeight}px | Largura: ${bulkWidth}px`,
        });
        return true;
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar tamanhos',
          description: getErrorMessage(error),
        });
        return false;
      }
    },
    [fetchGroups, toast]
  );

  return {
    groups,
    loading,
    statusFilter,
    setStatusFilter,
    filteredGroups,
    fetchGroups,
    handleDragEnd,
    toggleGroupEnabled,
    toggleLinkEnabled,
    resetManualOrder,
    deleteGroup,
    deleteLink,
    duplicateLink,
    addLinkToGroup,
    bulkUpdateSize,
  };
}
