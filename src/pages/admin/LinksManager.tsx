import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import LinksDisplaySettings from '@/components/admin/links/LinksDisplaySettings';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { GroupCard } from './linksManager/GroupCard';
import { BulkSizeDialog } from './linksManager/BulkSizeDialog';
import { AddToGroupDialog } from './linksManager/AddToGroupDialog';
import { LinksManagerHeader } from './linksManager/LinksManagerHeader';
import { LinksManagerDialogs } from './linksManager/LinksManagerDialogs';
import { useLinksManager } from './linksManager/useLinksManager';
import type { CustomLink, LinkGroup } from './linksManager/types';

const LinksManager = () => {
  const { settings } = useSiteSettings();
  const {
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
  } = useLinksManager();

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
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState(false);
  const [linkToAddToGroup, setLinkToAddToGroup] = useState<CustomLink | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openBulkSizeDialog = () => {
    const globalHeight = parseInt(settings?.links_page_card_default_height || '100');
    setBulkHeight(globalHeight);
    const allLinks = groups.flatMap((g) => g.custom_links || []);
    if (allLinks.length > 0) {
      setBulkWidth(allLinks[0].card_width || 650);
    }
    setShowBulkSizeDialog(true);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupId) return;
    await deleteGroup(deleteGroupId);
    setDeleteGroupId(null);
  };

  const handleConfirmDeleteLink = async () => {
    if (!deleteLinkId) return;
    await deleteLink(deleteLinkId);
    setDeleteLinkId(null);
  };

  const handleAddToAnotherGroup = async () => {
    if (!linkToAddToGroup || !targetGroupId) return;
    const ok = await addLinkToGroup(linkToAddToGroup, targetGroupId);
    if (ok) {
      setShowAddToGroupDialog(false);
      setLinkToAddToGroup(null);
      setTargetGroupId('');
    }
  };

  const handleBulkSizeUpdate = async () => {
    const ok = await bulkUpdateSize(bulkHeight, bulkWidth);
    if (ok) setShowBulkSizeDialog(false);
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
            <LinksManagerHeader
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onNewGroup={() => {
                setEditingGroup(null);
                setShowGroupForm(true);
              }}
              onNewLink={() => {
                setEditingLink(null);
                setSelectedGroupId(null);
                setShowLinkForm(true);
              }}
              onOpenBulkSize={openBulkSizeDialog}
              onOpenTemplateSettings={() => setShowTemplateSettings(true)}
            />

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
                          onDuplicateLink={duplicateLink}
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

      <LinksManagerDialogs
        groups={groups}
        showGroupForm={showGroupForm}
        onShowGroupFormChange={setShowGroupForm}
        editingGroup={editingGroup}
        onEditingGroupClear={() => setEditingGroup(null)}
        showLinkForm={showLinkForm}
        onShowLinkFormChange={setShowLinkForm}
        editingLink={editingLink}
        selectedGroupId={selectedGroupId}
        onLinkFormClear={() => {
          setEditingLink(null);
          setSelectedGroupId(null);
        }}
        deleteGroupId={deleteGroupId}
        onDeleteGroupIdChange={setDeleteGroupId}
        onConfirmDeleteGroup={handleConfirmDeleteGroup}
        deleteLinkId={deleteLinkId}
        onDeleteLinkIdChange={setDeleteLinkId}
        onConfirmDeleteLink={handleConfirmDeleteLink}
        showTemplateSettings={showTemplateSettings}
        onShowTemplateSettingsChange={setShowTemplateSettings}
        settings={settings}
        onRefetch={fetchGroups}
      />

      <BulkSizeDialog
        open={showBulkSizeDialog}
        onOpenChange={setShowBulkSizeDialog}
        bulkWidth={bulkWidth}
        bulkHeight={bulkHeight}
        onBulkWidthChange={setBulkWidth}
        onBulkHeightChange={setBulkHeight}
        onApply={handleBulkSizeUpdate}
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
