import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Pencil, Trash2, Plus, ArrowLeft, Copy, FileText, Loader2, CalendarDays, Search, GitMerge, X, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/useToast";
import { NavLink } from "react-router-dom";
import { EventForm } from "@/components/events/EventForm";
import { MultiEventArticleModal } from "@/components/admin/MultiEventArticleModal";
import { MergeEventsDialog } from "@/components/admin/MergeEventsDialog";
import { UndoMergeDialog } from "@/components/admin/UndoMergeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MergedEventsTab } from "@/components/admin/MergedEventsTab";
import { buildArticlePayload } from "@/lib/eventArticlePayload";
import { addHours } from "date-fns";
import { parseLocalDateTime } from "@/lib/dateUtils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

interface Event {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  venue: string;
  address?: string;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string;
  location_city: string;
  location_state: string;
  genres: string[];
  image_url?: string;
  blog_post_id?: string | null;
  description?: string;
  lineup?: string[];
  ticket_link?: string;
  vip_link?: string;
  pix_button_enabled?: boolean;
  views?: number | null;
}

const EventsManager = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [articleFilter, setArticleFilter] = useState<'todos' | 'sem-artigo' | 'com-artigo'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingArticle, setGeneratingArticle] = useState<string | null>(null);
  const [showMultiEventModal, setShowMultiEventModal] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [lastMergeLog, setLastMergeLog] = useState<any | null>(null);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const { toast } = useToast();

  // Busca a última mesclagem desfazível (sem undo posterior)
  const fetchLastMergeLog = async () => {
    const { data: merges } = await supabase
      .from("application_logs")
      .select("id, logged_at, context")
      .eq("level", "info")
      .gte("logged_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("logged_at", { ascending: false })
      .limit(50);
    if (!merges) { setLastMergeLog(null); return; }
    const lastMerge = merges.find((l: any) => l.context?.action === "merge_events");
    if (!lastMerge) { setLastMergeLog(null); return; }
    // Verifica se já foi desfeita
    const undone = merges.find(
      (l: any) => l.context?.action === "undo_merge" && l.context?.source_log_id === lastMerge.id,
    );
    setLastMergeLog(undone ? null : lastMerge);
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar eventos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchLastMergeLog();
  }, []);

  // Realtime: lista de eventos atualiza automaticamente em qualquer mudança.
  useRealtimeTable("events", () => fetchEvents());

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Evento deletado",
        description: "O evento foi removido com sucesso.",
      });
      fetchEvents();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao deletar evento",
        description: error.message,
      });
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleEdit = async (event: Event) => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", event.id)
      .maybeSingle();

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao abrir editor",
        description: error.message,
      });
      return;
    }

    setEditingEvent((data as Event | null) || event);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEvent(null);
    fetchEvents();
  };

  const handleDuplicate = (event: Event) => {
    // Criar evento duplicado com dados do original
    setEditingEvent({
      ...event,
      id: '', // Remover ID para criar novo
      title: `${event.title} (Cópia)`,
      slug: '', // Slug será gerado automaticamente
    });
    setShowForm(true);
  };

  const handleGenerateArticle = async (event: Event) => {
    setGeneratingArticle(event.id);
    
    try {
      console.log('[EventsManager] Iniciando geração de artigo para evento:', event.title);
      
      const payload = buildArticlePayload(event as any, { generateImage: !event.image_url });
      
      console.log('[EventsManager] Payload para generate-blog-post-v2:', payload);
      
      const { data: blogData, error: blogError } = await supabase.functions.invoke('generate-blog-post-v2', {
        body: payload
      });
      
      console.log('[EventsManager] Resposta da edge function:', { blogData, blogError });
      
      if (blogError) {
        throw new Error(blogError.message || 'Erro ao gerar artigo');
      }
      
      if (blogData?.post?.id) {
        // Vincular o blog post ao evento
        const { error: updateError } = await supabase
          .from('events')
          .update({ blog_post_id: blogData.post.id })
          .eq('id', event.id);
        
        if (updateError) {
          console.error('[EventsManager] Erro ao vincular blog post ao evento:', updateError);
        }
        
        toast({
          title: "Artigo gerado com sucesso!",
          description: `O artigo "${blogData.post.title}" foi criado e vinculado ao evento.`,
        });
        
        fetchEvents();
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (error: any) {
      console.error('[EventsManager] Erro ao gerar artigo:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar artigo",
        description: error.message || 'Ocorreu um erro ao gerar o artigo do blog.',
      });
    } finally {
      setGeneratingArticle(null);
    }
  };

  const filteredEvents = events.filter(event => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!event.title.toLowerCase().includes(term) && !event.venue.toLowerCase().includes(term)) {
        return false;
      }
    }
    
    if (articleFilter === 'sem-artigo' && event.blog_post_id) return false;
    if (articleFilter === 'com-artigo' && !event.blog_post_id) return false;

    if (statusFilter === 'todos') return true;
    
    const now = new Date();
    const eventDateTime = parseLocalDateTime(event.date, event.time);
    const eventEndTime = addHours(eventDateTime, 24);
    
    if (statusFilter === 'ativos') {
      return eventEndTime > now;
    } else {
      return eventEndTime <= now;
    }
  });

  const activeCount = events.filter(event => {
    const now = new Date();
    const eventDateTime = parseLocalDateTime(event.date, event.time);
    const eventEndTime = addHours(eventDateTime, 24);
    return eventEndTime > now;
  }).length;

  const inactiveCount = events.length - activeCount;

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <div className="w-full sm:w-auto">
                <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold hero-text">Gerenciar Eventos</h1>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                {mergeMode ? (
                  <>
                    <Button
                      variant="default"
                      onClick={() => setShowMergeDialog(true)}
                      disabled={selectedIds.size < 2}
                      className="min-h-[44px] flex-1 sm:flex-none"
                    >
                      <GitMerge className="w-4 h-4 mr-2" />
                      Mesclar ({selectedIds.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setMergeMode(false); setSelectedIds(new Set()); }}
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
                      onClick={() => setMergeMode(true)}
                      className="min-h-[44px] flex-1 sm:flex-none"
                      title="Selecionar 2+ eventos duplicados (mesmo festival) e fundir em 1"
                    >
                      <GitMerge className="w-4 h-4 mr-2" />
                      Mesclar Eventos
                    </Button>
                    {lastMergeLog && (
                      <Button
                        variant="outline"
                        onClick={() => setShowUndoDialog(true)}
                        className="min-h-[44px] flex-1 sm:flex-none border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                        title="Desfazer a última mesclagem (snapshot dos últimos 7 dias)"
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Desfazer mesclagem
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setShowMultiEventModal(true)}
                      className="min-h-[44px] flex-1 sm:flex-none"
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Artigo Multi-Datas
                    </Button>
                    <Button onClick={() => setShowForm(true)} className="min-h-[44px] flex-1 sm:flex-none">
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
              </TabsList>

              <TabsContent value="ativos">

            {/* Search + Filters */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar evento por nome ou local..."
                className="pl-10 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-6 flex-wrap">
              <Button 
                variant={statusFilter === 'todos' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('todos')}
                size="sm"
              >
                Todos ({events.length})
              </Button>
              <Button 
                variant={statusFilter === 'ativos' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ativos')}
                size="sm"
              >
                Ativos ({activeCount})
              </Button>
              <Button 
                variant={statusFilter === 'inativos' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('inativos')}
                size="sm"
              >
                Inativos ({inactiveCount})
              </Button>
              <span className="text-muted-foreground mx-1">|</span>
              <Button 
                variant={articleFilter === 'todos' ? 'default' : 'outline'}
                onClick={() => setArticleFilter('todos')}
                size="sm"
              >
                Artigo: Todos
              </Button>
              <Button 
                variant={articleFilter === 'sem-artigo' ? 'default' : 'outline'}
                onClick={() => setArticleFilter('sem-artigo')}
                size="sm"
              >
                Sem Artigo
              </Button>
              <Button 
                variant={articleFilter === 'com-artigo' ? 'default' : 'outline'}
                onClick={() => setArticleFilter('com-artigo')}
                size="sm"
              >
                Com Artigo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <Card
                  key={event.id}
                  className={`overflow-hidden relative transition ${mergeMode && selectedIds.has(event.id) ? "ring-2 ring-primary" : ""}`}
                  onClick={mergeMode ? () => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    });
                  } : undefined}
                  style={mergeMode ? { cursor: "pointer" } : undefined}
                >
                  {mergeMode && (
                    <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
                      <Checkbox checked={selectedIds.has(event.id)} />
                    </div>
                  )}
                  {event.image_url && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {event.date}{event.end_date && event.end_date !== event.date ? ` → ${event.end_date}` : ""} às {event.time}
                        {event.end_date && event.end_date !== event.date && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase font-semibold">festival</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {event.venue}, {event.location_city} - {event.location_state}
                      </div>
                      <div className="text-xs text-muted-foreground/70">
                        Slug: {event.slug}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(event)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDuplicate(event)}
                        title="Duplicar evento"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {!event.blog_post_id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleGenerateArticle(event)}
                          disabled={generatingArticle === event.id}
                          title="Gerar artigo do blog"
                          className="bg-primary/10 hover:bg-primary/20 text-primary"
                        >
                          {generatingArticle === event.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingEventId(event.id)}
                        title="Deletar evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {events.length === 0 && (
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
                <MergedEventsTab onChange={() => { fetchEvents(); fetchLastMergeLog(); }} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Dialog open={showForm} onOpenChange={(open) => !open && handleFormClose()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <EventForm
              key={editingEvent?.id || "new-event"}
              event={editingEvent}
              onSuccess={handleFormClose}
              onCancel={handleFormClose}
            />
          </DialogContent>
        </Dialog>

        <MultiEventArticleModal 
          open={showMultiEventModal} 
          onOpenChange={setShowMultiEventModal}
          onSuccess={fetchEvents}
        />

        <MergeEventsDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          events={events.filter((e) => selectedIds.has(e.id))}
          onSuccess={() => {
            setSelectedIds(new Set());
            setMergeMode(false);
            fetchEvents();
            fetchLastMergeLog();
          }}
        />

        <UndoMergeDialog
          open={showUndoDialog}
          onOpenChange={setShowUndoDialog}
          log={lastMergeLog}
          onSuccess={() => {
            setShowUndoDialog(false);
            fetchEvents();
            fetchLastMergeLog();
          }}
        />

        <AlertDialog open={!!deletingEventId} onOpenChange={() => setDeletingEventId(null)}>
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
                onClick={() => deletingEventId && handleDelete(deletingEventId)}
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
