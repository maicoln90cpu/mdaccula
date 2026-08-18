import {
  Calendar,
  Plus,
  ArrowLeft,
  CalendarDays,
  GitMerge,
  X,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NavLink } from 'react-router-dom';
import { EventForm } from '@/components/events/EventForm';
import { MultiEventArticleModal } from '@/components/admin/MultiEventArticleModal';
import { MergeEventsDialog } from '@/components/admin/MergeEventsDialog';
import { UndoMergeDialog } from '@/components/admin/UndoMergeDialog';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MergedEventsTab } from '@/components/admin/MergedEventsTab';
import EventVisibilitySettings from '@/components/admin/events/EventVisibilitySettings';
import { EventsFilters } from './eventsManager/EventsFilters';
import { EventCard } from './eventsManager/EventCard';
import { useEventsManager } from './eventsManager/useEventsManager';

const EventsManager = () => {
  const m = useEventsManager();

  if (m.loading) {
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <div className="w-full sm:w-auto">
                <NavLink
                  to="/admin"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold hero-text">
                  Gerenciar Eventos
                </h1>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                {m.mergeMode ? (
                  <>
                    <Button
                      variant="default"
                      onClick={() => m.setShowMergeDialog(true)}
                      disabled={m.selectedIds.size < 2}
                      className="min-h-[44px] flex-1 sm:flex-none"
                    >
                      <GitMerge className="w-4 h-4 mr-2" />
                      Mesclar ({m.selectedIds.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        m.setMergeMode(false);
                        m.setSelectedIds(new Set());
                      }}
                      className="min-h-[44px]"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Sair do modo mesclar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => m.setMergeMode(true)}
                      className="min-h-[44px] flex-1 sm:flex-none"
                      title="Selecionar 2+ eventos duplicados (mesmo festival) e fundir em 1"
                    >
                      <GitMerge className="w-4 h-4 mr-2" />
                      Mesclar Eventos
                    </Button>
                    {m.lastMergeShell && (
                      <Button
                        variant="outline"
                        onClick={() => m.setShowUndoDialog(true)}
                        className="min-h-[44px] flex-1 sm:flex-none border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                        title="Desfazer a última mesclagem (snapshot dos últimos 7 dias)"
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Desfazer mesclagem
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => m.setShowMultiEventModal(true)}
                      className="min-h-[44px] flex-1 sm:flex-none"
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Artigo Multi-Datas
                    </Button>
                    <Button
                      onClick={() => m.setShowForm(true)}
                      className="min-h-[44px] flex-1 sm:flex-none"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Evento
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Tabs defaultValue="ativos" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="ativos">Eventos</TabsTrigger>
                <TabsTrigger value="mesclados">Eventos Mesclados</TabsTrigger>
                <TabsTrigger value="config">Configurações</TabsTrigger>
              </TabsList>

              <TabsContent value="ativos">
                <EventsFilters
                  searchTerm={m.searchTerm}
                  onSearchChange={m.setSearchTerm}
                  statusFilter={m.statusFilter}
                  onStatusChange={m.setStatusFilter}
                  articleFilter={m.articleFilter}
                  onArticleChange={m.setArticleFilter}
                  totalCount={m.events.length}
                  activeCount={m.activeCount}
                  inactiveCount={m.inactiveCount}
                  showMerged={m.showMerged}
                  onShowMergedChange={m.setShowMerged}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {m.filteredEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      mergeMode={m.mergeMode}
                      selected={m.selectedIds.has(event.id)}
                      onToggleSelect={m.toggleSelect}
                      onEdit={m.handleEdit}
                      onDuplicate={m.handleDuplicate}
                      onGenerateArticle={m.handleGenerateArticle}
                      onReactivate={m.handleReactivate}
                      onDelete={(id) => m.setDeletingEventId(id)}
                      generatingArticle={m.generatingArticle}
                      reactivatingId={m.reactivatingId}
                      mergedPrimaryTitles={m.mergedPrimaryTitles}
                    />
                  ))}
                </div>

                {m.events.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-16">
                      <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-semibold mb-2">Nenhum evento cadastrado</h3>
                      <p className="text-muted-foreground mb-6">
                        Comece adicionando seu primeiro evento clicando no botão acima.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="mesclados">
                <MergedEventsTab
                  onChange={() => {
                    m.fetchEvents();
                    m.fetchLastMergeShell();
                  }}
                />
              </TabsContent>

              <TabsContent value="config">
                <EventVisibilitySettings />
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Dialog open={m.showForm} onOpenChange={(open) => !open && m.handleFormClose()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <EventForm
              key={m.editingEvent?.id || 'new-event'}
              event={m.editingEvent}
              onSuccess={m.handleFormClose}
              onCancel={m.handleFormClose}
            />
          </DialogContent>
        </Dialog>

        <MultiEventArticleModal
          open={m.showMultiEventModal}
          onOpenChange={m.setShowMultiEventModal}
          onSuccess={m.fetchEvents}
        />

        <MergeEventsDialog
          open={m.showMergeDialog}
          onOpenChange={m.setShowMergeDialog}
          events={m.events.filter((e) => m.selectedIds.has(e.id))}
          onSuccess={() => {
            m.setSelectedIds(new Set());
            m.setMergeMode(false);
            m.fetchEvents();
            m.fetchLastMergeShell();
          }}
        />

        <UndoMergeDialog
          open={m.showUndoDialog}
          onOpenChange={m.setShowUndoDialog}
          shell={m.lastMergeShell}
          onSuccess={() => {
            m.setShowUndoDialog(false);
            m.fetchEvents();
            m.fetchLastMergeShell();
          }}
        />

        <AlertDialog
          open={!!m.deletingEventId}
          onOpenChange={() => m.setDeletingEventId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar este evento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => m.deletingEventId && m.handleDelete(m.deletingEventId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default EventsManager;
