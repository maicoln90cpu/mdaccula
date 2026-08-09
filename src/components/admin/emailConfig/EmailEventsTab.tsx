/**
 * EmailEventsTab — aba unificada "Histórico e controle" da tela Admin →
 * Gestão de e-mails.
 *
 * Uma linha por evento no período selecionado (status da última campanha
 * + ações rápidas), que expande para o histórico completo daquele evento
 * (todas as campanhas, métricas sob demanda, teste A/B, liberar reenvio).
 * "Eventos sem rascunho" é apenas o filtro de status "Não disparado".
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Template } from '@/lib/emailTemplates/blocks';
import { HeaderFilters } from './emailEventsTab/HeaderFilters';
import { EventRow } from './emailEventsTab/EventRow';
import { useEmailEventsData } from './emailEventsTab/useEmailEventsData';
import { useEventActions } from './emailEventsTab/useEventActions';
import {
  norm,
  summaryStatusOf,
  type PeriodFilter,
  type StatusFilter,
  type SummaryStatus,
} from './emailEventsTab/helpers';

interface EmailEventsTabProps {
  templates: Template[];
  masterEnabled: boolean;
  prepareManualSend: (eventId: string) => void;
  /**
   * Setado pelo Dashboard ao clicar num evento na tabela de detalhe (link
   * "ver no Histórico"). `token` muda a cada clique — inclusive pro mesmo
   * evento — pra garantir que o efeito reaplique a busca mesmo se o admin
   * já tiver alterado os filtros manualmente entre um clique e outro.
   */
  focusRequest?: { eventTitle: string; token: number } | null;
}

export function EmailEventsTab({
  templates,
  masterEnabled,
  prepareManualSend,
  focusRequest,
}: EmailEventsTabProps) {
  const [period, setPeriod] = useState<PeriodFilter>('next30');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Deep-link vindo do Dashboard: busca pelo título e abre "Todos" (±5
  // anos) pra garantir que o evento apareça mesmo fora do período/status
  // atualmente selecionados.
  useEffect(() => {
    if (!focusRequest) return;
    setSearch(focusRequest.eventTitle);
    setPeriod('all');
    setStatusFilter('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token]);

  const { data, isLoading, isFetching, refetch } = useEmailEventsData(period);
  const {
    campaignStats,
    refreshingStatsId,
    dispatchingId,
    markManual,
    undoManual,
    resendEvent,
    refreshCampaignStats,
    dispatchAbTest,
  } = useEventActions(templates);

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<SummaryStatus, number> = {
      pending: 0,
      draft: 0,
      sent: 0,
      manual: 0,
      failed: 0,
    };
    for (const r of rows) c[summaryStatusOf(r.campaigns[0])]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return rows.filter((r) => {
      if (statusFilter !== 'all' && summaryStatusOf(r.campaigns[0]) !== statusFilter) return false;
      if (!q) return true;
      const hay = norm(
        `${r.event.title} ${r.event.venue || ''} ${r.event.location_city || ''} ${r.event.location_state || ''}`
      );
      return hay.includes(q);
    });
  }, [rows, statusFilter, search]);

  const defaultEventTemplate = useMemo(
    () =>
      templates.find((t) => t.type === 'event_new' && t.is_default) ||
      templates.find((t) => t.type === 'event_new') ||
      null,
    [templates]
  );

  return (
    <Card>
      <HeaderFilters
        counts={counts}
        search={search}
        setSearch={setSearch}
        period={period}
        setPeriod={setPeriod}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onRefresh={() => refetch()}
        isFetching={isFetching}
      />
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum evento no período/status/busca selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <EventRow
                    key={entry.event.id}
                    entry={entry}
                    expanded={!!expanded[entry.event.id]}
                    onToggle={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [entry.event.id]: !prev[entry.event.id],
                      }))
                    }
                    masterEnabled={masterEnabled}
                    campaignStats={campaignStats}
                    refreshingStatsId={refreshingStatsId}
                    dispatchingId={dispatchingId}
                    defaultEventTemplate={defaultEventTemplate}
                    prepareManualSend={prepareManualSend}
                    onMarkManual={markManual}
                    onUndoManual={undoManual}
                    onResend={resendEvent}
                    onRefreshStats={refreshCampaignStats}
                    onDispatchAbTest={dispatchAbTest}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EmailEventsTab;
