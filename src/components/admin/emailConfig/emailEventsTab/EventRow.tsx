import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Send,
  Undo2,
} from 'lucide-react';
import { formatDateTimeBR } from '@/lib/formatters';
import { buildEmailMeta } from '@/lib/emailTemplates/emailMeta';
import { AbTestButton } from '../AbTestButton';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { CampaignStatsMap } from '../types';
import {
  fmtDate,
  summaryStatusBadge,
  summaryStatusOf,
  type EventEntry,
} from './helpers';
import { CampaignHistoryRow } from './CampaignHistoryRow';

interface EventRowProps {
  entry: EventEntry;
  expanded: boolean;
  onToggle: () => void;
  masterEnabled: boolean;
  campaignStats: CampaignStatsMap;
  refreshingStatsId: string | null;
  dispatchingId: string | null;
  defaultEventTemplate: Template | null;
  prepareManualSend: (eventId: string) => void;
  onMarkManual: (entry: EventEntry) => void;
  onUndoManual: (entry: EventEntry) => void;
  onResend: (eventId: string) => void;
  onRefreshStats: (campaignId: string) => void;
  onDispatchAbTest: (
    eventId: string,
    params: {
      subjectA: string;
      subjectB: string;
      winnerMetric: 'opens' | 'clicks';
      sendNow: boolean;
    }
  ) => void;
}

export function EventRow({
  entry,
  expanded,
  onToggle,
  masterEnabled,
  campaignStats,
  refreshingStatsId,
  dispatchingId,
  defaultEventTemplate,
  prepareManualSend,
  onMarkManual,
  onUndoManual,
  onResend,
  onRefreshStats,
  onDispatchAbTest,
}: EventRowProps) {
  const latest = entry.campaigns[0];
  const s = summaryStatusOf(latest);
  const isSentLike = s === 'sent' || s === 'manual';
  const canUndoManual = latest?.mode === 'manual' && latest?.status === 'sent';

  return (
    <Fragment>
      <TableRow>
        <TableCell className="w-8">
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
            aria-label={expanded ? 'Recolher histórico' : 'Expandir histórico'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </TableCell>
        <TableCell>
          <div className="font-medium">{entry.event.title}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(entry.event.date, entry.event.time)}
          </div>
        </TableCell>
        <TableCell>{summaryStatusBadge(s)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDateTimeBR(latest?.sent_at ?? null)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground capitalize">
          {latest?.mode ?? '—'}
        </TableCell>
        <TableCell className="text-right space-x-2 whitespace-nowrap">
          {latest?.egoi_campaign_id && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`https://app.e-goi.com/campaigns/${latest.egoi_campaign_id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                E-goi
              </a>
            </Button>
          )}
          {!isSentLike && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Marcar enviado
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Marcar como enviado manualmente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {s === 'scheduled' ? (
                      <>
                        <strong>{entry.event.title}</strong> tem um agendamento pendente
                        {latest?.scheduled_at
                          ? ` para ${formatDateTimeBR(latest.scheduled_at)}`
                          : ''}
                        . Marcar como enviado manualmente <strong>cancela esse agendamento</strong>{' '}
                        — o e-mail real NÃO será disparado pela E-goi. Use isso só se você já
                        enviou por fora. Você pode desfazer depois.
                      </>
                    ) : (
                      <>
                        Isso registra que <strong>{entry.event.title}</strong> teve o e-mail
                        disparado manualmente pela E-goi. Você pode desfazer depois.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onMarkManual(entry)}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canUndoManual && (
            <Button variant="ghost" size="sm" onClick={() => onUndoManual(entry)}>
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              Desfazer
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow key={`${entry.event.id}-expanded`}>
          <TableCell colSpan={6} className="bg-muted/20 p-0">
            <div className="p-3 space-y-2">
              {entry.campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhuma campanha registrada ainda para este evento.
                </p>
              ) : (
                <div className="divide-y">
                  {entry.campaigns.map((c) => (
                    <CampaignHistoryRow
                      key={c.id}
                      campaign={c}
                      entry={entry}
                      campaignStats={campaignStats}
                      refreshingStatsId={refreshingStatsId}
                      masterEnabled={masterEnabled}
                      onRefreshStats={onRefreshStats}
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => prepareManualSend(entry.event.id)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Preparar novo envio
                </Button>
                <AbTestButton
                  eventTitle={entry.event.title}
                  defaultSubject={
                    buildEmailMeta(defaultEventTemplate?.subject_template, null, {
                      eventTitle: entry.event.title,
                    }).subject || entry.event.title
                  }
                  disabled={dispatchingId === entry.event.id}
                  onConfirm={(p) => onDispatchAbTest(entry.event.id, p)}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Send className="w-4 h-4 mr-2" /> Liberar reenvio
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar reenvio</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso limpa o marcador de disparo do evento{' '}
                        <b>{entry.event.title}</b>. Na próxima ação de envio, uma <b>nova</b>{' '}
                        campanha será criada (o histórico anterior é preservado). Tem certeza?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onResend(entry.event.id)}>
                        Sim, liberar reenvio
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
