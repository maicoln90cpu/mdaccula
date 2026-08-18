import { useCallback, useEffect, useState } from 'react';
import { addHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useAutoPublishSettings } from '@/hooks/useAutoPublishSettings';
import { buildArticlePayload } from '@/lib/eventArticlePayload';
import { parseLocalDateTime } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import type { MergeShellSummary } from '@/components/admin/UndoMergeDialog';
import type { Event, StatusFilter, ArticleFilter } from './types';

export function useEventsManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativos');
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingArticle, setGeneratingArticle] = useState<string | null>(null);
  const [showMultiEventModal, setShowMultiEventModal] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [lastMergeShell, setLastMergeShell] = useState<MergeShellSummary | null>(null);
  const { settings: publishSettings } = useAutoPublishSettings(['auto_publish_single_event']);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [showMerged, setShowMerged] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [mergedPrimaryTitles, setMergedPrimaryTitles] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchLastMergeShell = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title')
      .eq('is_merge_shell', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastMergeShell((data as MergeShellSummary | null) || null);
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      let query = supabase.from('events').select('*').order('date', { ascending: true });
      if (!showMerged) {
        query = query.eq('status', 'active');
      }
      const { data, error } = await query;

      if (error) throw error;
      const list = (data || []) as Event[];
      setEvents(list);

      const primaryIds = Array.from(
        new Set(
          list
            .filter((e) => e.status === 'merged_inactive' && e.merged_into_id)
            .map((e) => e.merged_into_id as string)
        )
      );
      if (primaryIds.length > 0) {
        const { data: primaries } = await supabase
          .from('events')
          .select('id, title')
          .in('id', primaryIds);
        const map: Record<string, string> = {};
        (primaries || []).forEach((p) => {
          map[p.id] = p.title;
        });
        setMergedPrimaryTitles(map);
      } else {
        setMergedPrimaryTitles({});
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar eventos',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [showMerged, toast]);

  useEffect(() => {
    fetchEvents();
    fetchLastMergeShell();
  }, [fetchEvents, fetchLastMergeShell]);

  useRealtimeTable('events', () => fetchEvents());

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Evento deletado', description: 'O evento foi removido com sucesso.' });
      fetchEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao deletar evento', description: message });
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleReactivate = async (event: Event) => {
    setReactivatingId(event.id);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          status: 'active',
          merged_into_id: null,
          merged_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      if (error) throw error;
      toast({
        title: 'Evento reativado',
        description: `"${event.title}" voltou a ficar ativo. O evento principal não foi alterado.`,
      });
      fetchEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao reativar evento', description: message });
    } finally {
      setReactivatingId(null);
    }
  };

  const handleEdit = async (event: Event) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', event.id)
      .maybeSingle();

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao abrir editor', description: error.message });
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
    setEditingEvent({
      ...event,
      id: '',
      title: `${event.title} (Cópia)`,
      slug: '',
    });
    setShowForm(true);
  };

  const handleGenerateArticle = async (event: Event) => {
    setGeneratingArticle(event.id);
    try {
      logger.debug('[EventsManager] Iniciando geração de artigo para evento', {
        title: event.title,
      });
      const payload = buildArticlePayload(event, {
        generateImage: !event.image_url,
        publishImmediately: publishSettings.auto_publish_single_event === true,
      });
      logger.debug('[EventsManager] Payload para generate-blog-post-v2', { payload });
      const { data: blogData, error: blogError } = await supabase.functions.invoke(
        'generate-blog-post-v2',
        { body: payload }
      );
      logger.debug('[EventsManager] Resposta da edge function:', { blogData, blogError });
      if (blogError) throw new Error(blogError.message || 'Erro ao gerar artigo');
      if (blogData?.post?.id) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ blog_post_id: blogData.post.id })
          .eq('id', event.id);
        if (updateError) {
          logger.error('[EventsManager] Erro ao vincular blog post ao evento:', updateError);
        }
        toast({
          title: 'Artigo gerado com sucesso!',
          description: `O artigo "${blogData.post.title}" foi criado e vinculado ao evento.`,
        });
        fetchEvents();
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('[EventsManager] Erro ao gerar artigo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar artigo',
        description: message || 'Ocorreu um erro ao gerar o artigo do blog.',
      });
    } finally {
      setGeneratingArticle(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEvents = events.filter((event) => {
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
    if (statusFilter === 'ativos') return eventEndTime > now;
    return eventEndTime <= now;
  });

  const activeCount = events.filter((event) => {
    const now = new Date();
    const eventDateTime = parseLocalDateTime(event.date, event.time);
    const eventEndTime = addHours(eventDateTime, 24);
    return eventEndTime > now;
  }).length;

  const inactiveCount = events.length - activeCount;

  return {
    events,
    filteredEvents,
    loading,
    activeCount,
    inactiveCount,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    articleFilter,
    setArticleFilter,
    showForm,
    setShowForm,
    editingEvent,
    handleFormClose,
    handleEdit,
    handleDuplicate,
    handleDelete,
    handleReactivate,
    handleGenerateArticle,
    generatingArticle,
    reactivatingId,
    deletingEventId,
    setDeletingEventId,
    mergeMode,
    setMergeMode,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    showMergeDialog,
    setShowMergeDialog,
    showMultiEventModal,
    setShowMultiEventModal,
    lastMergeShell,
    showUndoDialog,
    setShowUndoDialog,
    showMerged,
    setShowMerged,
    mergedPrimaryTitles,
    fetchEvents,
    fetchLastMergeShell,
  };
}
