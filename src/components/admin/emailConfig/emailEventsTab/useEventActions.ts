import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { dispatchAbSubjectTest } from '@/lib/emailTemplates/dispatchEventDraft';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { CampaignStats, CampaignStatsMap } from '../types';
import { QUERY_KEY_PREFIX, type EventEntry } from './helpers';

export function useEventActions(templates: Template[]) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campaignStats, setCampaignStats] = useState<CampaignStatsMap>({});
  const [refreshingStatsId, setRefreshingStatsId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX] });

  async function markManual(entry: EventEntry) {
    const latest = entry.campaigns[0] ?? null;
    try {
      if (latest) {
        const { error } = await supabase
          .from('event_email_campaigns')
          .update({
            mode: 'manual',
            status: 'sent',
            sent_at: new Date().toISOString(),
            campaign_type: 'manual',
            error_message: null,
          })
          .eq('id', latest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_email_campaigns').insert({
          event_id: entry.event.id,
          mode: 'manual',
          status: 'sent',
          sent_at: new Date().toISOString(),
          campaign_type: 'manual',
        });
        if (error) throw error;
      }
      toast({ title: 'Marcado como enviado', description: entry.event.title });
      invalidate();
    } catch (e: unknown) {
      toast({
        title: 'Erro ao marcar',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  }

  async function undoManual(entry: EventEntry) {
    const latest = entry.campaigns[0];
    if (!latest) return;
    try {
      if (
        latest.mode === 'manual' &&
        latest.campaign_type === 'manual' &&
        !latest.egoi_campaign_id
      ) {
        const { error } = await supabase.from('event_email_campaigns').delete().eq('id', latest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_email_campaigns')
          .update({ mode: 'draft', status: 'draft', sent_at: null })
          .eq('id', latest.id);
        if (error) throw error;
      }
      toast({ title: 'Marcação desfeita', description: entry.event.title });
      invalidate();
    } catch (e: unknown) {
      toast({
        title: 'Erro ao desfazer',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  }

  async function resendEvent(eventId: string) {
    try {
      const { error } = await supabase
        .from('events')
        .update({ email_campaign_dispatched_at: null })
        .eq('id', eventId);
      if (error) throw error;
      toast({
        title: 'Evento liberado para reenvio',
        description: 'Na próxima ação de disparo, será gerada uma nova campanha.',
      });
      invalidate();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
  }

  async function refreshCampaignStats(campaignId: string) {
    setRefreshingStatsId(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke('egoi-campaign-stats', {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; stats?: Record<string, unknown>; error?: string };
      if (!res?.ok || !res.stats) throw new Error(res?.error || 'Resposta inválida da E-goi');
      setCampaignStats((prev) => ({
        ...prev,
        [campaignId]: {
          ...(res.stats as unknown as CampaignStats),
          fetched_at: new Date().toISOString(),
        },
      }));
      toast({ title: 'Métricas atualizadas' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao atualizar métricas', description: message });
    } finally {
      setRefreshingStatsId(null);
    }
  }

  async function dispatchAbTest(
    eventId: string,
    params: {
      subjectA: string;
      subjectB: string;
      winnerMetric: 'opens' | 'clicks';
      sendNow: boolean;
    }
  ) {
    setDispatchingId(eventId);
    try {
      const defaultTemplate =
        templates.find((t) => t.type === 'event_new' && t.is_default) ??
        templates.find((t) => t.type === 'event_new');
      if (!defaultTemplate?.id)
        throw new Error('Nenhum template padrão de Evento está disponível para o teste A/B.');
      const res = await dispatchAbSubjectTest(eventId, {
        ...params,
        templateIdOverride: defaultTemplate.id,
      });
      const sentA = res.variantA.ok && res.variantA.status === 'sent';
      const sentB = res.variantB.ok && res.variantB.status === 'sent';
      const draftA = res.variantA.ok && res.variantA.status === 'draft';
      const draftB = res.variantB.ok && res.variantB.status === 'draft';
      if (sentA && sentB) {
        toast({
          title: params.sendNow ? 'Teste A/B enviado!' : 'Rascunhos A e B criados',
          description: `Grupo ${res.groupId.slice(0, 8)} • A #${res.variantA.egoi_campaign_id ?? '?'} • B #${res.variantB.egoi_campaign_id ?? '?'}`,
        });
      } else if (
        params.sendNow &&
        (draftA || draftB) &&
        !res.variantA.error &&
        !res.variantB.error
      ) {
        toast({
          variant: 'destructive',
          title: 'Teste A/B criado, mas não enviado',
          description: `A: ${res.variantA.status ?? '?'} • B: ${res.variantB.status ?? '?'} — a E-goi manteve como rascunho`,
        });
      } else {
        const describe = (v: typeof res.variantA, sent: boolean) =>
          sent ? 'ok' : v.error || v.reason || v.status || 'falhou';
        toast({
          variant: 'destructive',
          title: 'Teste A/B com falhas',
          description: `A: ${describe(res.variantA, sentA)} • B: ${describe(res.variantB, sentB)}`,
        });
      }
      invalidate();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro no teste A/B', description: message });
    } finally {
      setDispatchingId(null);
    }
  }

  return {
    campaignStats,
    refreshingStatsId,
    dispatchingId,
    markManual,
    undoManual,
    resendEvent,
    refreshCampaignStats,
    dispatchAbTest,
  };
}
