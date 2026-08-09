import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { RealEventSelect } from './RealEventSelect';
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '@/lib/emailTemplates/eventAnnouncement';
import type { Template, ArticleSummary } from '@/lib/emailTemplates/blocks';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';

type PreviewSource = 'event' | 'digest' | 'weekend' | 'blog';

interface Toast {
  (opts: { variant?: 'destructive'; title: string; description?: string }): void;
}

interface DigestPreviewMeta {
  subject?: string;
  preheader?: string;
  events_count?: number;
  posts_count?: number;
  range?: string;
  render_source?: string;
  template_name?: string | null;
}

interface EventPreviewComposition {
  issues: Array<{ blockId?: string; code?: string; message: string }>;
}

interface Props {
  previewSource: PreviewSource;
  digestPreviewLoading: boolean;
  digestPreviewHtml: string;
  digestPreviewMeta: DigestPreviewMeta | null;
  loadDigestPreview: (opts?: { source?: 'digest' | 'weekend' | 'blog'; templateId?: string }) => void;
  selectedRealEventId: string;
  setSelectedRealEventId: (id: string) => void;
  realEvents: Array<EmailEventRow & { blog_post_id: string | null }>;
  setPreviewData: (data: EventAnnouncementData) => void;
  previewHtml: string;
  eventPreviewComposition: EventPreviewComposition;
  eventPreviewMeta: { subject: string; preheader: string };
  sendingTest: boolean;
  editorDirty: boolean;
  sendTestEmail: (html: string, subject: string) => void;
  toast: Toast;
  templates: Template[];
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  reloadTemplates: () => Promise<void>;
  tpl: EmailTemplateSettings & { id?: string };
  previewData: EventAnnouncementData;
  previewArticle: ArticleSummary | null;
  setEditorDirty: (dirty: boolean) => void;
}

export const TemplateEditorTab = ({
  previewSource,
  digestPreviewLoading,
  digestPreviewHtml,
  digestPreviewMeta,
  loadDigestPreview,
  selectedRealEventId,
  setSelectedRealEventId,
  realEvents,
  setPreviewData,
  previewHtml,
  eventPreviewComposition,
  eventPreviewMeta,
  sendingTest,
  editorDirty,
  sendTestEmail,
  toast,
  templates,
  activeTemplateId,
  setActiveTemplateId,
  reloadTemplates,
  tpl,
  previewData,
  previewArticle,
  setEditorDirty,
}: Props) => {
  return (
    <>
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 whitespace-nowrap">
              Fonte do preview:{' '}
              {previewSource === 'digest'
                ? 'Digest semanal real (7 dias)'
                : previewSource === 'weekend'
                  ? 'Agenda FDS real (próximo FDS)'
                  : previewSource === 'blog'
                    ? 'Blog news real'
                    : 'Evento individual (mock/real)'}
            </span>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              determinada pelo tipo do template selecionado no editor abaixo
            </span>

            {previewSource !== 'event' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadDigestPreview()}
                  disabled={digestPreviewLoading}
                >
                  {digestPreviewLoading ? 'Carregando…' : 'Atualizar preview'}
                </Button>
                {digestPreviewMeta && (
                  <span className="text-xs text-muted-foreground">
                    {digestPreviewMeta.events_count ?? 0} eventos ·{' '}
                    {digestPreviewMeta.posts_count ?? 0} posts · {digestPreviewMeta.range}
                  </span>
                )}
              </>
            )}

            {previewSource === 'event' && (
              <>
                <Label className="text-xs whitespace-nowrap ml-2">
                  Simular com evento real
                </Label>
                <RealEventSelect
                  value={selectedRealEventId}
                  onChange={setSelectedRealEventId}
                  events={realEvents}
                />
              </>
            )}

            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedRealEventId('mock');
                  setPreviewData(MOCK_EVENT_DATA);
                }}
              >
                Restaurar mock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const html =
                    previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml;
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mdaccula-email-preview.html';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Baixar HTML
              </Button>
              <Button
                size="sm"
                disabled={
                  sendingTest ||
                  editorDirty ||
                  (previewSource === 'event' && eventPreviewComposition.issues.length > 0)
                }
                onClick={() => {
                  const html =
                    previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml;
                  const subject =
                    previewSource !== 'event'
                      ? digestPreviewMeta?.subject || ''
                      : eventPreviewMeta.subject;
                  if (!subject) {
                    toast({
                      variant: 'destructive',
                      title: 'Assunto vazio',
                      description: 'Salve um assunto no template antes de enviar teste.',
                    });
                    return;
                  }
                  sendTestEmail(html, subject);
                }}
              >
                <Send className="w-4 h-4 mr-1" />
                {sendingTest ? 'Enviando…' : 'Enviar teste'}
              </Button>
            </div>
          </div>
          {editorDirty && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Salve as alterações do template para liberar o envio de teste. Somente a versão
              salva pode ser enviada.
            </div>
          )}
          {!editorDirty &&
            previewSource === 'event' &&
            eventPreviewComposition.issues.length > 0 && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                <div className="font-semibold">Envio bloqueado:</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {eventPreviewComposition.issues.map((item) => (
                    <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
        </CardContent>
      </Card>

      <EmailTemplateEditor
        templates={templates}
        activeId={activeTemplateId}
        onActiveChange={setActiveTemplateId}
        onReload={reloadTemplates}
        settings={tpl}
        previewEvent={previewData}
        previewArticle={previewArticle}
        overrideHtml={previewSource !== 'event' ? digestPreviewHtml : null}
        onDirtyChange={setEditorDirty}
      />
    </>
  );
};
