/**
 * PreviewPanel — coluna direita: preview ao vivo (iframe 600px) + banner de issues.
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de comportamento.
 */
import { Card, CardContent } from '@/components/ui/card';
import type { EventAnnouncementData } from '@/lib/emailTemplates/eventAnnouncement';
import { InboxPreviewHeader } from '../InboxPreviewHeader';

interface PreviewIssue {
  blockId: string;
  code: string;
  message: string;
}

interface PreviewPanelProps {
  html: string;
  overrideHtml?: string | null;
  isDirty: boolean;
  issues: PreviewIssue[];
  currentSubject: string;
  currentPreheader: string;
  previewEvent: EventAnnouncementData;
}

export const PreviewPanel = ({
  html,
  overrideHtml,
  isDirty,
  issues,
  currentSubject,
  currentPreheader,
  previewEvent,
}: PreviewPanelProps) => (
  <Card>
    <CardContent className="p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {overrideHtml && !isDirty
            ? 'Preview real (dados do disparo)'
            : 'Preview ao vivo (600px reais)'}
        </div>
        <div className="text-[10px] text-muted-foreground">≈ largura real na caixa de entrada</div>
      </div>
      {overrideHtml && isDirty && (
        <div className="mx-1 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠ Alterações não salvas — o preview real usa o template já salvo. Mostrando{' '}
          <b>render local</b> com os blocos atuais. Salve para atualizar o preview real.
        </div>
      )}
      {issues.length > 0 && (
        <div className="mx-1 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-700 dark:text-red-300">
          <div className="font-semibold">Este modelo ainda não pode ser enviado:</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {issues.map((item) => (
              <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="px-1">
        <InboxPreviewHeader
          subjectTemplate={currentSubject}
          preheaderTemplate={currentPreheader}
          data={{
            eventTitle: previewEvent.eventTitle,
            dateLabel: previewEvent.dateLabel,
            timeLabel: previewEvent.timeLabel,
            venueName: previewEvent.venueName,
            cityState: previewEvent.cityState,
          }}
        />
      </div>
      <div className="overflow-x-auto rounded border bg-[#050505] p-2">
        <iframe
          title="preview"
          srcDoc={overrideHtml && !isDirty ? overrideHtml : html}
          width={600}
          className="block mx-auto h-[900px] bg-white"
          style={{ width: 600, minWidth: 600, border: 0 }}
          sandbox=""
        />
      </div>
    </CardContent>
  </Card>
);
