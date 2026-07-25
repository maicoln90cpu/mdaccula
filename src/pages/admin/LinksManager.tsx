import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Plus, Settings, Palette } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { NavLink } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LinkGroupForm } from '@/components/links/LinkGroupForm';
import { CustomLinkForm } from '@/components/links/CustomLinkForm';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LinksPageSettings } from '@/components/links/LinksPageSettings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LinksDisplaySettings from '@/components/admin/links/LinksDisplaySettings';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { isEventVisible } from '@/lib/eventDateHelper';
import { processLinks, sortLinkGroups } from '@/hooks/useLinks';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import { GroupCard } from './linksManager/GroupCard';
import { BulkSizeDialog } from './linksManager/BulkSizeDialog';
import { AddToGroupDialog } from './linksManager/AddToGroupDialog';
import { getErrorMessage, type CustomLink, type LinkGroup } from './linksManager/types';

const LinksManager = () => {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LinkGroup | null>(null);
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showBulkSizeDialog, setShowBulkSizeDialog] = useState(false);
  const [bulkHeight, setBulkHeight] = useState<number>(80);
  const [bulkWidth, setBulkWidth] = useState<number>(650);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState(false);
  const [linkToAddToGroup, setLinkToAddToGroup] = useState<CustomLink | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const { settings } = useSiteSettings();
  const { toast } = useToast();

  const openBulkSizeDialog = () => {
    const globalHeight = parseInt(settings?.links_page_card_default_height || '100');
    setBulkHeight(globalHeight);
    const allLinks = groups.flatMap((g) => g.custom_links || []);
    if (allLinks.length > 0) {
      setBulkWidth(allLinks[0].card_width || 650);
    }
    setShowBulkSizeDialog(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
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
          await supabase.from('link_groups').update({ display_order: i }).eq('id', newGroups[i].id);
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
  };

  const toggleGroupEnabled = async (groupId: string, enabled: boolean) => {
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
  };

  const toggleLinkEnabled = async (linkId: string, enabled: boolean) => {
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
  };

  const resetManualOrder = async (linkId: string) => {
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
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
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
    } finally {
      setDeleteGroupId(null);
    }
  };

  const handleDeleteLink = async () => {
    if (!deleteLinkId) return;
    const idToDelete = deleteLinkId;
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
    } finally {
      setDeleteLinkId(null);
    }
  };

  const handleDuplicateLink = async (link: CustomLink) => {
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
  };

  const handleAddToAnotherGroup = async () => {
    if (!linkToAddToGroup || !targetGroupId) return;
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
      setShowAddToGroupDialog(false);
      setLinkToAddToGroup(null);
      setTargetGroupId('');
      toast({ title: 'Link adicionado ao grupo com sucesso' });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar link',
        description: getErrorMessage(error),
      });
    }
  };

  const handleBulkSizeUpdate = async () => {
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
      setShowBulkSizeDialog(false);
      toast({
        title: 'Tamanhos atualizados com sucesso',
        description: `Altura padrão: ${bulkHeight}px | Largura: ${bulkWidth}px`,
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar tamanhos',
        description: getErrorMessage(error),
      });
    }
  };

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
          <div className="w-full">
            <div className="mb-8">
              <NavLink
                to="/admin"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Painel
              </NavLink>
              <h1 className="text-3xl sm:text-4xl font-bold hero-text mb-4">Gerenciar Links</h1>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setEditingGroup(null);
                    setShowGroupForm(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Grupo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLink(null);
                    setSelectedGroupId(null);
                    setShowLinkForm(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Link
                </Button>
                <Button variant="secondary" onClick={openBulkSizeDialog}>
                  <Settings className="w-4 h-4 mr-2" />
                  Ajustar Tamanhos
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateSettings(true)}>
                  <Palette className="w-4 h-4 mr-2" />
                  Template & Avatar
                </Button>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">Filtrar:</span>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="links" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="config">Configurações</TabsTrigger>
              </TabsList>

              <TabsContent value="links">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-6">
                    <SortableContext
                      items={filteredGroups.map((g) => `group-${g.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredGroups.map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          onToggleGroupEnabled={toggleGroupEnabled}
                          onEditGroup={(g) => {
                            setEditingGroup(g);
                            setShowGroupForm(true);
                          }}
                          onRequestDeleteGroup={setDeleteGroupId}
                          onAddLinkToGroup={(groupId) => {
                            setSelectedGroupId(groupId);
                            setEditingLink(null);
                            setShowLinkForm(true);
                          }}
                          onToggleLinkEnabled={toggleLinkEnabled}
                          onResetManualOrder={resetManualOrder}
                          onRequestAddToGroup={(link) => {
                            setLinkToAddToGroup(link);
                            setTargetGroupId('');
                            setShowAddToGroupDialog(true);
                          }}
                          onDuplicateLink={handleDuplicateLink}
                          onEditLink={(link) => {
                            setEditingLink(link);
                            setSelectedGroupId(link.group_id);
                            setShowLinkForm(true);
                          }}
                          onRequestDeleteLink={setDeleteLinkId}
                        />
                      ))}
                    </SortableContext>

                    {filteredGroups.length === 0 && (
                      <Card>
                        <CardContent className="text-center py-12">
                          <p className="text-muted-foreground mb-4">Nenhum grupo criado ainda</p>
                          <Button
                            onClick={() => {
                              setEditingGroup(null);
                              setShowGroupForm(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Primeiro Grupo
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </DndContext>
              </TabsContent>

              <TabsContent value="config">
                <LinksDisplaySettings />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
          </DialogHeader>
          <LinkGroupForm
            group={editingGroup}
            onSuccess={() => {
              setShowGroupForm(false);
              setEditingGroup(null);
              fetchGroups();
            }}
            onCancel={() => {
              setShowGroupForm(false);
              setEditingGroup(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkForm} onOpenChange={setShowLinkForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Editar Link' : 'Novo Link'}</DialogTitle>
          </DialogHeader>
          <CustomLinkForm
            link={editingLink}
            groups={groups}
            preselectedGroupId={selectedGroupId}
            onSuccess={() => {
              setShowLinkForm(false);
              setEditingLink(null);
              setSelectedGroupId(null);
              fetchGroups();
            }}
            onCancel={() => {
              setShowLinkForm(false);
              setEditingLink(null);
              setSelectedGroupId(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este grupo? Todos os links dentro dele também serão
              excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLinkId} onOpenChange={() => setDeleteLinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este link?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLink}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkSizeDialog
        open={showBulkSizeDialog}
        onOpenChange={setShowBulkSizeDialog}
        bulkWidth={bulkWidth}
        bulkHeight={bulkHeight}
        onBulkWidthChange={setBulkWidth}
        onBulkHeightChange={setBulkHeight}
        onApply={handleBulkSizeUpdate}
      />

      <LinksPageSettings
        open={showTemplateSettings}
        onOpenChange={setShowTemplateSettings}
        currentAvatar={settings.links_page_avatar_url}
        currentHandle={settings.links_page_handle}
        currentTheme={settings.links_page_theme}
        currentCardBorder={settings.links_page_card_border}
        currentCardShadow={settings.links_page_card_shadow}
        currentCardRoundedness={settings.links_page_card_roundedness}
        currentCardBackdrop={settings.links_page_card_backdrop}
        currentCardHover={settings.links_page_card_hover}
        currentCardColor={settings.links_page_card_color}
        currentCardBorderColor={settings.links_page_card_border_color}
      />

      <AddToGroupDialog
        open={showAddToGroupDialog}
        onOpenChange={setShowAddToGroupDialog}
        linkToAddToGroup={linkToAddToGroup}
        targetGroupId={targetGroupId}
        onTargetGroupIdChange={setTargetGroupId}
        groups={groups}
        onConfirm={handleAddToAnotherGroup}
      />
    </>
  );
};

export default LinksManager;
