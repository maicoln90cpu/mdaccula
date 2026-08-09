import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Mail, Send, RefreshCw, Users } from 'lucide-react';
import { SendNowButton } from './SendNowButton';
import { ScheduleSendPanel } from './ScheduleSendPanel';
import { formatCount } from '@/lib/formatters';
import type { EmailComposition } from '@/lib/emailTemplates/emailComposer';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { SegmentItem } from './types';


interface ManualSendEvent extends EmailEventRow {
  blog_post_id: string | null;
}

interface ManualSendTabProps {
  masterEnabled: boolean;
  realEvents: ManualSendEvent[];
  manualTemplates: Template[];
  batchEventId: string;
  batchEventIds: string[];
  batchTemplateId: string;
  batchArtworkUrl: string;
  batchSubject: string;
  batchSegmentId: number | null | undefined;
  batchScheduleAt: string;
  batchDispatching: boolean;
  batchScheduling: boolean;
  batchUploadingArt: boolean;
  sendingTest: boolean;
  isMultiEventTemplate: boolean;
  selectedManualTemplate: Template | null;
  selectedManualEvents: ManualSendEvent[];
  manualComposition: EmailComposition | null;
  manualIssuePartition: {
    blockers: EmailComposition['issues'];
    warnings: EmailComposition['issues'];
  };
  cfgListId: number | null;
  segments: SegmentItem[];
  listTotal: number | null;
  globalSegmentLabel: string;
  fetchingSegments: boolean;
  setBatchEventId: (id: string) => void;
  setBatchEventIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setBatchTemplateId: (id: string) => void;
  setBatchArtworkUrl: (url: string) => void;
  setBatchSubject: (subject: string) => void;
  setBatchSegmentId: (id: number | null | undefined) => void;
  setBatchScheduleAt: (v: string) => void;
  uploadBatchArtwork: (file: File) => Promise<void>;
  dispatchBatch: (sendNow: boolean) => Promise<void>;
  scheduleBatch: () => Promise<void>;
  sendTestEmail: (html: string, subject: string) => Promise<void>;
}

export function ManualSendTab(props: ManualSendTabProps) {
  const {
    masterEnabled,
    realEvents,
    manualTemplates,
    batchEventId,
    batchEventIds,
    batchTemplateId,
    batchArtworkUrl,
    batchSubject,
    batchSegmentId,
    batchScheduleAt,
    batchDispatching,
    batchScheduling,
    batchUploadingArt,
    sendingTest,
    isMultiEventTemplate,
    selectedManualTemplate,
    selectedManualEvents,
    manualComposition,
    manualIssuePartition,
    cfgListId,
    segments,
    listTotal,
    globalSegmentLabel,
    fetchingSegments,
    setBatchEventId,
    setBatchEventIds,
    setBatchTemplateId,
    setBatchArtworkUrl,
    setBatchSubject,
    setBatchSegmentId,
    setBatchScheduleAt,
    uploadBatchArtwork,
    dispatchBatch,
    scheduleBatch,
    sendTestEmail,
  } = props;

  // Rótulo do segmento que será usado de fato neste disparo — exibido na
  // revisão final e na confirmação de envio pra evitar que um reset (ou
  // esquecimento) do segmento escolhido passe despercebido. Item 3 da
  // melhoria de disparo de e-mail.
  const resolvedSegmentLabel = useMemo(() => {
    if (batchSegmentId === undefined) {
      return `Padrão da configuração global (${globalSegmentLabel})`;
    }
    if (batchSegmentId === null) {
      return `Todos os contatos da lista${
        typeof listTotal === 'number' ? ` — ${formatCount(listTotal)} contatos` : ''
      }`;
    }
    const s = segments.find((x) => x.segment_id === batchSegmentId);
    if (!s) return `Segmento #${batchSegmentId}`;
    return `${s.name}${
      typeof s.total_contacts === 'number' ? ` — ${formatCount(s.total_contacts)} contatos` : ''
    }`;
  }, [batchSegmentId, globalSegmentLabel, listTotal, segments]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Envio manual</CardTitle>
          <CardDescription>
            Escolha um evento e um modelo salvo. A prévia abaixo é exatamente o HTML usado no
            teste, no rascunho e no envio pela E-goi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!masterEnabled && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Master switch está OFF — o disparo será recusado. Ligue em "Configuração" antes
                de tentar.
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Evento{isMultiEventTemplate ? 's' : ''}</Label>
              {isMultiEventTemplate ? (
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {realEvents.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchEventIds.includes(e.id)}
                        onChange={(ev) => {
                          setBatchEventIds((prev) =>
                            ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)
                          );
                        }}
                      />
                      <span>
                        {e.title} · {new Date(e.date).toLocaleDateString('pt-BR')}
                      </span>
                    </label>
                  ))}
                  {realEvents.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Nenhum evento ativo/futuro encontrado.
                    </p>
                  )}
                </div>
              ) : (
                <Select
                  value={batchEventId}
                  onValueChange={(id) => setBatchEventId(id)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {realEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} · {new Date(e.date).toLocaleDateString('pt-BR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Template</Label>
              <Select
                value={batchTemplateId}
                onValueChange={(id) => {
                  setBatchTemplateId(id);
                  setBatchSubject('');
                  setBatchArtworkUrl('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione template" />
                </SelectTrigger>
                <SelectContent>
                  {manualTemplates.map((t) => (
                    <SelectItem key={t.id!} value={t.id!}>
                      {t.name} ·{' '}
                      {t.type === 'event_new'
                        ? 'Evento'
                        : t.type === 'courtesy'
                          ? 'Cortesia'
                          : t.type === 'ticket_batch'
                            ? 'Virada'
                            : t.type === 'ticket_batch_multi'
                              ? 'Virada (multi)'
                              : t.type === 'event_reminder'
                                ? 'Lembrete'
                                : 'Custom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Digest, Agenda FDS e Blog news ficam exclusivamente na aba Automações.
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                Segmento de envio
                {fetchingSegments && <RefreshCw className="w-3 h-3 animate-spin" />}
              </Label>
              <Select
                value={
                  batchSegmentId === undefined
                    ? 'default'
                    : batchSegmentId === null
                      ? 'all'
                      : batchSegmentId.toString()
                }
                onValueChange={(v) => {
                  if (v === 'default') setBatchSegmentId(undefined);
                  else if (v === 'all') setBatchSegmentId(null);
                  else setBatchSegmentId(Number(v));
                }}
                disabled={!cfgListId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cfgListId ? 'Padrão da configuração global' : 'Configure uma lista primeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Padrão da configuração global ({globalSegmentLabel})
                  </SelectItem>
                  <SelectItem value="all">
                    Todos os contatos da lista
                    {typeof listTotal === 'number' && ` — ${formatCount(listTotal)} contatos`}
                  </SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.segment_id} value={s.segment_id.toString()}>
                      {s.name}
                      {typeof s.total_contacts === 'number' &&
                        ` — ${formatCount(s.total_contacts)} contatos`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Vale só para este disparo — não altera a configuração global.
              </p>
            </div>

            {selectedManualTemplate?.type === 'ticket_batch' && (
              <>
                <div className="md:col-span-2">
                  <Label className="flex items-center justify-between">
                    <span>Assunto desta virada (opcional)</span>
                    <span
                      className={`text-[11px] font-normal ${
                        batchSubject.length > 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {batchSubject.length} caracteres
                    </span>
                  </Label>
                  <Input
                    value={batchSubject}
                    placeholder="Ex.: ÚLTIMAS HORAS — lote 2 acabando"
                    onChange={(e) => setBatchSubject(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Se vazio, usa o assunto salvo no template.
                    {batchSubject.length > 60 &&
                      ' Assuntos longos costumam cortar em apps de e-mail (recomendado até ~60 caracteres).'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label>Arte específica da virada (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={batchUploadingArt}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadBatchArtwork(f);
                      }}
                    />
                    {batchArtworkUrl && (
                      <Button size="sm" variant="ghost" onClick={() => setBatchArtworkUrl('')}>
                        Remover
                      </Button>
                    )}
                  </div>
                  {batchArtworkUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={batchArtworkUrl}
                        alt="Preview arte virada"
                        className="w-32 h-32 object-contain rounded border bg-muted/30"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Esta arte substitui o flyer padrão somente neste disparo.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {manualComposition && (
            <div className="grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,600px)]">
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Revisão final
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {manualComposition.subject || 'Assunto não preenchido'}
                  </div>
                  {manualComposition.preheader && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {manualComposition.preheader}
                    </div>
                  )}
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">Segmento: </span>
                    <span className="font-medium">{resolvedSegmentLabel}</span>
                  </div>
                </div>
                {manualIssuePartition.blockers.length > 0 ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                    <div className="font-semibold">Corrija antes de enviar:</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {manualIssuePartition.blockers.map((item) => (
                        <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : manualIssuePartition.warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <div className="font-semibold">Pendências (não impedem o envio):</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {manualIssuePartition.warnings.map((item) => (
                        <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                    Modelo validado. Teste, rascunho e envio usarão exatamente esta prévia.
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border bg-[#050505] p-2">
                <iframe
                  title="Prévia final do envio manual"
                  srcDoc={manualComposition.html}
                  sandbox=""
                  width={600}
                  className="mx-auto block h-[720px] bg-white"
                  style={{ width: 600, minWidth: 600, border: 0 }}
                />
              </div>
            </div>
          )}

          {manualComposition && (
            <div className="flex justify-end pt-2">
              <Badge
                variant="outline"
                className="text-xs py-1.5 px-3 border-primary/40 bg-primary/5"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Enviando para: <span className="font-semibold ml-1">{resolvedSegmentLabel}</span>
              </Badge>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
            <Button
              variant="secondary"
              disabled={
                !manualComposition || manualIssuePartition.blockers.length > 0 || sendingTest
              }
              onClick={() =>
                manualComposition && void sendTestEmail(manualComposition.html, manualComposition.subject)
              }
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingTest ? 'Enviando...' : 'Enviar teste'}
            </Button>
            <Button
              variant="outline"
              disabled={
                !manualComposition || manualIssuePartition.blockers.length > 0 || batchDispatching
              }
              onClick={() => dispatchBatch(false)}
            >
              <Send className="w-4 h-4 mr-2" />
              {batchDispatching ? 'Criando...' : 'Criar rascunho na E-goi'}
            </Button>
            <SendNowButton
              eventTitle={
                isMultiEventTemplate
                  ? `${selectedManualEvents.length} evento(s) selecionado(s)`
                  : realEvents.find((e) => e.id === batchEventId)?.title || '(selecione)'
              }
              segmentLabel={resolvedSegmentLabel}
              disabled={
                !manualComposition || manualIssuePartition.blockers.length > 0 || batchDispatching
              }
              onConfirm={() => dispatchBatch(true)}
            />
          </div>

          {!isMultiEventTemplate && batchEventId && (
            <ScheduleSendPanel
              eventId={batchEventId}
              scheduleAt={batchScheduleAt}
              onScheduleAtChange={(v) => setBatchScheduleAt(v)}
              disabled={
                !masterEnabled || !manualComposition || manualIssuePartition.blockers.length > 0
              }
              scheduling={batchScheduling}
              onSchedule={scheduleBatch}
            />
          )}

          <p className="text-[11px] text-muted-foreground">
            O disparo é registrado no <b>Histórico</b> como uma nova campanha (o histórico
            anterior do evento é preservado).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
