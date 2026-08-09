/**
 * PreviewPanel — coluna direita: preview ao vivo (iframe 600px) + banner de issues.
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de comportamento.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { EventAnnouncementData } from '@/lib/emailTemplates/eventAnnouncement';
import { InboxPreviewHeader } from '../InboxPreviewHeader';

interface PreviewIssue {
  blockId: string;
  code: string;
  message: string;
}

/** O e-mail em si nunca muda de largura (é sempre uma tabela de 600px) — o
 * seletor só troca a largura do "viewport" simulado ao redor dela, pra
 * conferir como fica o scroll/leitura num cliente de e-mail mobile real. */
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<PreviewDevice, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 375,
};

const DEVICE_LABEL: Record<PreviewDevice, string> = {
  desktop: 'Desktop (600px)',
  tablet: 'Tablet (480px)',
  mobile: 'Celular (375px)',
};

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
}: PreviewPanelProps) => {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const width = DEVICE_WIDTH[device];

  return (
    <Card>
      <CardContent className="p-2">
        <div className="flex items-center justify-between mb-2 px-2 gap-2 flex-wrap">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {overrideHtml && !isDirty ? 'Preview real (dados do disparo)' : 'Preview ao vivo'}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={device}
            onValueChange={(v) => v && setDevice(v as PreviewDevice)}
          >
            <ToggleGroupItem value="desktop" aria-label={DEVICE_LABEL.desktop} title={DEVICE_LABEL.desktop}>
              <Monitor className="w-3.5 h-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="tablet" aria-label={DEVICE_LABEL.tablet} title={DEVICE_LABEL.tablet}>
              <Tablet className="w-3.5 h-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" aria-label={DEVICE_LABEL.mobile} title={DEVICE_LABEL.mobile}>
              <Smartphone className="w-3.5 h-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="text-[10px] text-muted-foreground">
            {device === 'desktop' ? '≈ largura real na caixa de entrada' : DEVICE_LABEL[device]}
          </div>
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
            width={width}
            className="block mx-auto h-[900px] bg-white transition-[width] duration-200"
            style={{ width, minWidth: width, border: 0 }}
            sandbox=""
          />
        </div>
      </CardContent>
    </Card>
  );
};
