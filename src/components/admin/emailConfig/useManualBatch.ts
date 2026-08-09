import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type Block, type ArticleSummary, type Template, type GlobalBlock } from '@/lib/emailTemplates/blocks';
import {
  applyEmailBlockOverrides,
  buildEventAnnouncementData,
  buildMultiEventAnnouncementData,
  composeEmail,
} from '@/lib/emailTemplates/emailComposer';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';
import { partitionIssues } from '@/lib/emailTemplates/issueClassifier';
import { useEmailDispatch } from './useEmailDispatch';

type ToastFn = (opts: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

interface UseManualBatchParams {
  templates: Template[];
  realEvents: Array<EmailEventRow & { blog_post_id: string | null }>;
  tpl: unknown;
  globalsMap: Map<string, GlobalBlock>;
  toast: ToastFn;
  loadAll: () => Promise<void>;
}

export function useManualBatch({
  templates,
  realEvents,
  tpl,
  globalsMap,
  toast,
  loadAll,
}: UseManualBatchParams) {
  const [batchEventId, setBatchEventId] = useState<string>('');
  const [batchEventIds, setBatchEventIds] = useState<string[]>([]);
  const [batchTemplateId, setBatchTemplateId] = useState<string>('');
  const [batchArtworkUrl, setBatchArtworkUrl] = useState<string>('');
  const [batchSubject, setBatchSubject] = useState<string>('');
  const [batchArticle, setBatchArticle] = useState<ArticleSummary | null>(null);
  const [batchUploadingArt, setBatchUploadingArt] = useState(false);
  const [batchDispatching, setBatchDispatching] = useState(false);
  const [batchScheduleAt, setBatchScheduleAt] = useState<string>('');
  const [batchScheduling, setBatchScheduling] = useState(false);
  /** undefined = usa o segmento global de egoi_config; null = toda a lista; number = segmento específico. */
  const [batchSegmentId, setBatchSegmentId] = useState<number | null | undefined>(undefined);

  const manualTemplates = useMemo(
    () =>
      templates.filter((template) =>
        [
          'event_new',
          'courtesy',
          'ticket_batch',
          'ticket_batch_multi',
          'event_reminder',
          'promo',
          'custom',
        ].includes(template.type)
      ),
    [templates]
  );

  const selectedManualTemplate = useMemo(
    () => manualTemplates.find((template) => template.id === batchTemplateId) ?? null,
    [manualTemplates, batchTemplateId]
  );

  const selectedManualEvent = useMemo(
    () => realEvents.find((event) => event.id === batchEventId) ?? null,
    [realEvents, batchEventId]
  );

  const isMultiEventTemplate = selectedManualTemplate?.type === 'ticket_batch_multi';

  const selectedManualEvents = useMemo(
    () => realEvents.filter((event) => batchEventIds.includes(event.id)),
    [realEvents, batchEventIds]
  );

  const manualComposition = useMemo(() => {
    if (!selectedManualTemplate) return null;

    if (isMultiEventTemplate) {
      if (selectedManualEvents.length === 0) return null;
      // O assunto/preheader usa {{event_title}}, que resolve a partir do
      // eventTitle calculado aqui — não do bloco `title` isolado. Sem
      // repassar o override do bloco pra cá, o assunto continua mostrando
      // "N eventos com novo lote hoje" mesmo com o título visível já
      // sobrescrito no editor.
      const titleBlock = (selectedManualTemplate.blocks as Block[] | undefined)?.find(
        (b) => b.kind === 'title'
      ) as Extract<Block, { kind: 'title' }> | undefined;
      const event = buildMultiEventAnnouncementData(selectedManualEvents, {
        baseUrl: 'https://mdaccula.com',
        titleOverride: titleBlock?.text_override,
      });
      return composeEmail({
        template: {
          blocks: selectedManualTemplate.blocks as Block[],
          subject_template: selectedManualTemplate.subject_template,
          preheader_template: selectedManualTemplate.preheader_template,
        },
        event,
        settings: tpl,
        globals: globalsMap,
      });
    }

    if (!selectedManualEvent) return null;
    const deadline = new Date();
    deadline.setHours(23, 59, 0, 0);
    const event = buildEventAnnouncementData(selectedManualEvent, {
      flyerOverrideUrl:
        selectedManualTemplate.type === 'ticket_batch' ? batchArtworkUrl || undefined : undefined,
      ticketBatchDeadlineIso: deadline.toISOString(),
    });
    let blocks = applyEmailBlockOverrides(selectedManualTemplate.blocks as Block[], {
      artworkUrl:
        selectedManualTemplate.type === 'ticket_batch'
          ? batchArtworkUrl || event.flyerUrl || undefined
          : undefined,
      defaultLink: event.ticketUrl,
    });
    // Mesmo filtro de dispatchEventDraft.ts: templates de evento único nunca
    // devem renderizar blocos de digest/agenda multi-evento — sem isso, a
    // prévia do envio manual mostra um aviso que o disparo real já não tem.
    const eventOnlyTemplateTypes = new Set([
      'event_new',
      'event_reminder',
      'last_hours',
      'ticket_batch',
      'promo',
    ]);
    if (eventOnlyTemplateTypes.has(String(selectedManualTemplate.type))) {
      blocks = blocks.filter(
        (b) => !['weekend_grid', 'weekly_hero', 'blog_posts_list', 'dedge_block'].includes(b.kind)
      );
    }
    return composeEmail({
      template: {
        blocks,
        subject_template:
          selectedManualTemplate.type === 'ticket_batch'
            ? batchSubject || selectedManualTemplate.subject_template
            : selectedManualTemplate.subject_template,
        preheader_template: selectedManualTemplate.preheader_template,
      },
      event,
      settings: tpl,
      article: batchArticle,
      globals: globalsMap,
    });
  }, [
    selectedManualTemplate,
    selectedManualEvent,
    isMultiEventTemplate,
    selectedManualEvents,
    batchArtworkUrl,
    batchSubject,
    tpl,
    batchArticle,
    globalsMap,
  ]);

  const manualIssuePartition = useMemo(
    () => partitionIssues(manualComposition?.issues ?? []),
    [manualComposition]
  );

  const { dispatchBatch, scheduleBatch } = useEmailDispatch({
    batchEventId,
    batchEventIds,
    batchTemplateId,
    batchArtworkUrl,
    batchSubject,
    batchSegmentId,
    batchScheduleAt,
    isMultiEventTemplate,
    selectedManualEvents,
    selectedManualTemplate,
    manualComposition,
    loadAll,
    setBatchDispatching,
    setBatchScheduling,
    setBatchScheduleAt,
  });

  // Pré-seleciona o primeiro ticket_batch quando templates carregarem.
  useEffect(() => {
    if (batchTemplateId) return;
    const tb = templates.find((t) => t.type === 'ticket_batch');
    if (tb?.id) setBatchTemplateId(tb.id);
  }, [templates, batchTemplateId]);

  // Carrega matéria vinculada ao evento selecionado.
  useEffect(() => {
    const event = realEvents.find((item) => item.id === batchEventId);
    if (!event?.blog_post_id) {
      setBatchArticle(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('blog_posts')
      .select('title,excerpt,slug,image_url')
      .eq('id', event.blog_post_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBatchArticle(
          data
            ? {
                title: data.title,
                excerpt: data.excerpt || '',
                url: `https://mdaccula.com/blog/${data.slug}`,
                image_url: data.image_url || undefined,
              }
            : null
        );
      });
    return () => {
      cancelled = true;
    };
  }, [batchEventId, realEvents]);

  // B.8 — Upload da arte específica da virada de lote
  const uploadBatchArtwork = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 2MB.' });
      return;
    }
    setBatchUploadingArt(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `email-template/batch-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('link-thumbnails')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('link-thumbnails').getPublicUrl(path);
      setBatchArtworkUrl(pub.publicUrl);
      toast({
        title: 'Arte enviada',
        description: 'Ela vai substituir o flyer padrão neste disparo.',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro no upload', description: message });
    } finally {
      setBatchUploadingArt(false);
    }
  };

  return {
    // state
    batchEventId,
    setBatchEventId,
    batchEventIds,
    setBatchEventIds,
    batchTemplateId,
    setBatchTemplateId,
    batchArtworkUrl,
    setBatchArtworkUrl,
    batchSubject,
    setBatchSubject,
    batchSegmentId,
    setBatchSegmentId,
    batchScheduleAt,
    setBatchScheduleAt,
    batchUploadingArt,
    batchDispatching,
    batchScheduling,
    // derived
    manualTemplates,
    selectedManualTemplate,
    selectedManualEvent,
    selectedManualEvents,
    isMultiEventTemplate,
    manualComposition,
    manualIssuePartition,
    // actions
    uploadBatchArtwork,
    dispatchBatch,
    scheduleBatch,
  };
}
