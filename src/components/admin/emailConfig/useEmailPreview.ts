import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
} from '@/lib/emailTemplates/eventAnnouncement';
import { type Block, type ArticleSummary, type Template } from '@/lib/emailTemplates/blocks';
import {
  buildEventAnnouncementData,
  composeEmail,
} from '@/lib/emailTemplates/emailComposer';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';

interface DigestPreviewResponse {
  skipped?: boolean;
  reason?: string;
  html?: string;
  error?: string;
  subject?: string;
  preheader?: string;
  events_count?: number;
  posts_count?: number;
  range?: string;
  render_source?: string;
  template_name?: string | null;
}

export type DigestPreviewMeta = {
  subject?: string;
  preheader?: string;
  events_count?: number;
  posts_count?: number;
  range?: string;
  render_source?: string;
  template_name?: string | null;
} | null;

type ToastFn = (opts: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

interface UseEmailPreviewParams {
  templates: Template[];
  activeTemplateId: string | null;
  tpl: unknown;
  globalsMap: import('@/lib/emailTemplates/blocks').GlobalBlock extends never ? never : Map<string, import('@/lib/emailTemplates/blocks').GlobalBlock>;
  realEvents: Array<EmailEventRow & { blog_post_id: string | null }>;
  toast: ToastFn;
}

export function useEmailPreview({
  templates,
  activeTemplateId,
  tpl,
  globalsMap,
  realEvents,
  toast,
}: UseEmailPreviewParams) {
  const [previewData, setPreviewData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);
  const [selectedRealEventId, setSelectedRealEventId] = useState<string>('mock');
  const [previewArticle, setPreviewArticle] = useState<ArticleSummary | null>(null);
  const [digestTemplateId, setDigestTemplateId] = useState<string>('');
  const [digestPreviewHtml, setDigestPreviewHtml] = useState<string>('');
  const [digestPreviewMeta, setDigestPreviewMeta] = useState<DigestPreviewMeta>(null);
  const [digestPreviewLoading, setDigestPreviewLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || null,
    [templates, activeTemplateId]
  );

  const previewSource: 'event' | 'digest' | 'weekend' | 'blog' = useMemo(() => {
    const t = activeTemplate?.type;
    if (t === 'weekly_digest' || t === 'weekly_digest_editorial') return 'digest';
    if (t === 'weekend_agenda') return 'weekend';
    if (t === 'blog_digest') return 'blog';
    return 'event';
  }, [activeTemplate?.type]);

  const eventPreviewComposition = useMemo(
    () =>
      composeEmail({
        template: {
          blocks: (activeTemplate?.blocks as Block[] | undefined) ?? [],
          subject_template: activeTemplate?.subject_template,
          preheader_template: activeTemplate?.preheader_template,
        },
        event: previewData,
        settings: tpl,
        article: previewArticle,
        globals: globalsMap,
      }),
    [activeTemplate, previewData, tpl, previewArticle, globalsMap]
  );

  const eventPreviewMeta = useMemo(
    () => ({
      subject: eventPreviewComposition.subject,
      preheader: eventPreviewComposition.preheader,
    }),
    [eventPreviewComposition]
  );

  const previewHtml = eventPreviewComposition.html;

  const loadDigestPreview = async (opts?: {
    source?: 'digest' | 'weekend' | 'blog';
    templateId?: string;
  }) => {
    const src =
      opts?.source ??
      (previewSource === 'weekend' ? 'weekend' : previewSource === 'blog' ? 'blog' : 'digest');
    const tplId = opts?.templateId ?? digestTemplateId;
    setDigestPreviewLoading(true);
    try {
      const body: Record<string, unknown> = { dry_run: true, force: true };
      if (src === 'weekend') body.range = 'weekend';
      if (tplId) body.template_id = tplId;
      const functionName =
        src === 'weekend'
          ? 'weekend-agenda-draft'
          : src === 'blog'
            ? 'blog-digest-draft'
            : 'weekly-digest-draft';
      const { data, error } = await supabase.functions.invoke<DigestPreviewResponse>(functionName, {
        body,
      });
      if (error) throw error;
      if (data?.skipped) {
        toast({
          title: 'Preview indisponível',
          description: `Motivo: ${data.reason}`,
          variant: 'destructive',
        });
        setDigestPreviewHtml('');
        setDigestPreviewMeta(null);
        return;
      }
      if (!data?.html) throw new Error(data?.error || 'Sem HTML retornado');
      setDigestPreviewHtml(data.html);
      setDigestPreviewMeta({
        subject: data.subject,
        preheader: data.preheader,
        events_count: data.events_count,
        posts_count: data.posts_count,
        range: data.range,
        render_source: data.render_source,
        template_name: data.template_name,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar preview',
        description: message ?? String(e),
        variant: 'destructive',
      });
    } finally {
      setDigestPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (previewSource === 'event') return;
    const tplId = activeTemplateId || '';
    setDigestTemplateId(tplId);
    loadDigestPreview({ source: previewSource, templateId: tplId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSource, activeTemplateId]);

  // Aplica dados de um evento real ao previewData quando seleciona no dropdown.
  useEffect(() => {
    const applyEvent = async () => {
      if (selectedRealEventId === 'mock' || !selectedRealEventId) {
        setPreviewData(MOCK_EVENT_DATA);
        setPreviewArticle(null);
        return;
      }
      const ev = realEvents.find((e) => e.id === selectedRealEventId);
      if (!ev) return;
      const baseUrl = 'https://mdaccula.com';
      const batchDeadline = new Date();
      batchDeadline.setHours(23, 59, 0, 0);
      setPreviewData(
        buildEventAnnouncementData(ev, {
          baseUrl,
          ticketBatchDeadlineIso: batchDeadline.toISOString(),
        })
      );
      if (ev.blog_post_id) {
        const { data: post } = await supabase
          .from('blog_posts')
          .select('title,excerpt,slug,image_url')
          .eq('id', ev.blog_post_id)
          .maybeSingle();
        if (post) {
          setPreviewArticle({
            title: post.title,
            excerpt: post.excerpt || '',
            url: `${baseUrl}/blog/${post.slug}`,
            image_url: post.image_url || undefined,
          });
        } else setPreviewArticle(null);
      } else setPreviewArticle(null);
    };
    void applyEvent();
  }, [selectedRealEventId, realEvents]);

  const sendTestEmail = async (html: string, subject: string) => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { html, subject },
      });
      if (error) throw error;
      if (!data?.ok || !data?.id) {
        throw new Error(data?.error || 'Resend não confirmou o envio (sem ID de mensagem)');
      }
      toast({
        title: 'E-mail de teste enviado',
        description: `Enviado para ${data.sent_to} (Resend #${data.id})`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha no envio de teste', description: message });
    } finally {
      setSendingTest(false);
    }
  };

  return {
    previewData,
    setPreviewData,
    selectedRealEventId,
    setSelectedRealEventId,
    previewArticle,
    activeTemplate,
    previewSource,
    eventPreviewComposition,
    eventPreviewMeta,
    previewHtml,
    digestPreviewHtml,
    digestPreviewMeta,
    digestPreviewLoading,
    loadDigestPreview,
    sendingTest,
    sendTestEmail,
  };
}
