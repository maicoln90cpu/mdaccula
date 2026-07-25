import { useQueryClient } from '@tanstack/react-query';
import { dispatchEventDraftEmail, dispatchMultiEventDraftEmail } from '@/lib/emailTemplates/dispatchEventDraft';
import { partitionIssues } from '@/lib/emailTemplates/issueClassifier';
import { useToast } from '@/hooks/useToast';
import { formatDateTimeBR } from '@/lib/formatters';
import type { EmailComposition } from '@/lib/emailTemplates/emailComposer';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';
import type { ArticleSummary } from '@/lib/emailTemplates/blocks';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { Campaign } from './types';

interface UseEmailDispatchProps {
  batchEventId: string;
  batchEventIds: string[];
  batchTemplateId: string;
  batchArtworkUrl: string;
  batchSubject: string;
  batchSegmentId: number | null | undefined;
  batchScheduleAt: string;
  isMultiEventTemplate: boolean;
  selectedManualEvents: Array<EmailEventRow & { blog_post_id: string | null }>;
  selectedManualTemplate: Template | null;
  manualComposition: EmailComposition | null;
  loadAll: () => Promise<void>;
  setBatchDispatching: (v: boolean) => void;
  setBatchScheduling: (v: boolean) => void;
  setBatchScheduleAt: (v: string) => void;
}

interface DispatchResult {
  ok: boolean;
  status?: Campaign['status'] | 'sent' | 'draft';
  egoi_campaign_id?: string | null;
  error?: string;
  reason?: string;
  scheduled_at?: string | null;
}

export function useEmailDispatch({
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
}: UseEmailDispatchProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dispatchBatch = async (sendNow: boolean) => {
    if (!manualComposition) {
      toast({ variant: 'destructive', title: 'Selecione o(s) evento(s) e o template' });
      return;
    }
    const preCheck = partitionIssues(manualComposition.issues);
    if (preCheck.blockers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Envio bloqueado',
        description: preCheck.blockers.map((item) => item.message).join(' '),
      });
      return;
    }
    if (preCheck.warnings.length > 0) {
      toast({ title: 'Aviso', description: preCheck.warnings.map((item) => item.message).join(' ') });
    }
    setBatchDispatching(true);

    try {
      if (isMultiEventTemplate) {
        if (selectedManualEvents.length === 0) {
          toast({ variant: 'destructive', title: 'Selecione ao menos 1 evento' });
          return;
        }
        const res = await dispatchMultiEventDraftEmail(batchEventIds, {
          sendNow,
          forceResend: true,
          segmentIdOverride: batchSegmentId,
          preparedComposition: {
            html: manualComposition.html,
            subject: manualComposition.subject,
            preheader: manualComposition.preheader,
          },
        });
        if (res.ok && res.status === 'sent') {
          toast({
            title: 'E-mail multi-evento enviado!',
            description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
          });
          void loadAll();
        } else if (res.ok && res.status === 'draft') {
          toast({
            variant: sendNow ? 'destructive' : 'default',
            title: sendNow ? 'Campanha criada, mas não enviada' : 'Rascunho criado na E-goi',
            description: res.egoi_campaign_id
              ? `Campanha #${res.egoi_campaign_id}${res.error ? ` — ${res.error}` : ''}`
              : res.error,
          });
          void loadAll();
        } else {
          toast({ variant: 'destructive', title: 'Falha', description: res.error || 'Erro desconhecido' });
          void loadAll();
        }
        return;
      }

      if (!batchEventId || !batchTemplateId) {
        toast({ variant: 'destructive', title: 'Selecione o evento e o template' });
        return;
      }
      const res = await dispatchEventDraftEmail(batchEventId, {
        forceResend: true,
        sendNow,
        templateIdOverride: batchTemplateId || undefined,
        flyerOverrideUrl:
          selectedManualTemplate?.type === 'ticket_batch'
            ? batchArtworkUrl || undefined
            : undefined,
        subjectOverride:
          selectedManualTemplate?.type === 'ticket_batch' ? batchSubject || undefined : undefined,
        segmentIdOverride: batchSegmentId,
        preparedComposition: {
          html: manualComposition.html,
          subject: manualComposition.subject,
          preheader: manualComposition.preheader,
        },
      });
      if (res.ok && res.status === 'sent') {
        toast({
          title: 'E-mail enviado!',
          description: res.egoi_campaign_id ? `Campanha #${res.egoi_campaign_id}` : undefined,
        });
        void loadAll();
      } else if (res.ok && res.status === 'draft') {
        toast({
          variant: sendNow ? 'destructive' : 'default',
          title: sendNow ? 'Campanha criada, mas não enviada' : 'Rascunho criado na E-goi',
          description: res.egoi_campaign_id
            ? `Campanha #${res.egoi_campaign_id}${res.error ? ` — ${res.error}` : ''}`
            : res.error,
        });
        void loadAll();
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: res.error || res.reason || 'Erro desconhecido',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    } finally {
      setBatchDispatching(false);
    }
  };

  const scheduleBatch = async () => {
    if (!batchEventId || !batchTemplateId || !manualComposition || !batchScheduleAt) {
      toast({ variant: 'destructive', title: 'Selecione o evento, o template e a data/hora' });
      return;
    }
    const preCheckSched = partitionIssues(manualComposition.issues);
    if (preCheckSched.blockers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Agendamento bloqueado',
        description: preCheckSched.blockers.map((item) => item.message).join(' '),
      });
      return;
    }
    if (preCheckSched.warnings.length > 0) {
      toast({
        title: 'Aviso',
        description: preCheckSched.warnings.map((item) => item.message).join(' '),
      });
    }

    setBatchScheduling(true);
    try {
      const scheduleAtIso = new Date(batchScheduleAt).toISOString();
      const res = await dispatchEventDraftEmail(batchEventId, {
        forceResend: true,
        scheduleAt: scheduleAtIso,
        templateIdOverride: batchTemplateId || undefined,
        flyerOverrideUrl:
          selectedManualTemplate?.type === 'ticket_batch'
            ? batchArtworkUrl || undefined
            : undefined,
        subjectOverride:
          selectedManualTemplate?.type === 'ticket_batch' ? batchSubject || undefined : undefined,
        segmentIdOverride: batchSegmentId,
        preparedComposition: {
          html: manualComposition.html,
          subject: manualComposition.subject,
          preheader: manualComposition.preheader,
        },
      });
      if (res.ok && res.status === 'scheduled') {
        toast({
          title: 'Disparo agendado!',
          description: `Será enviado em ${formatDateTimeBR(res.scheduled_at ?? scheduleAtIso)}.`,
        });
        setBatchScheduleAt('');
        queryClient.invalidateQueries({ queryKey: ['scheduled-sends', batchEventId] });
        void loadAll();
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao agendar',
          description: res.error || res.reason || 'Erro desconhecido',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    } finally {
      setBatchScheduling(false);
    }
  };

  return { dispatchBatch, scheduleBatch };
}

export type { DispatchResult };
