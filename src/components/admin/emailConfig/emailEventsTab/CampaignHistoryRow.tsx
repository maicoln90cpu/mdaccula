import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { formatDateTimeBR } from '@/lib/formatters';
import type { Campaign, CampaignStatsMap } from '../types';
import { campaignStatusBadge, type EventEntry } from './helpers';

interface CampaignHistoryRowProps {
  campaign: Campaign;
  entry: EventEntry;
  campaignStats: CampaignStatsMap;
  refreshingStatsId: string | null;
  masterEnabled: boolean;
  onRefreshStats: (id: string) => void;
}

export function CampaignHistoryRow({
  campaign: c,
  entry,
  campaignStats,
  refreshingStatsId,
  masterEnabled,
  onRefreshStats,
}: CampaignHistoryRowProps) {
  const stats = campaignStats[c.id];
  const canShowStats = c.status === 'sent' && !!c.egoi_campaign_id;

  return (
    <div className="py-2 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {campaignStatusBadge(c.status)}
            {c.campaign_type === 'ab_subject' &&
              (() => {
                const cfg = (c.ab_test_config || {}) as {
                  winner_metric?: 'opens' | 'clicks';
                };
                const metricKey =
                  cfg.winner_metric === 'clicks' ? 'click_rate' : 'open_rate';
                const partner = entry.campaigns.find(
                  (x) => x.id !== c.id && x.ab_group_id === c.ab_group_id
                );
                const myStats = campaignStats[c.id];
                const partnerStats = partner ? campaignStats[partner.id] : null;
                let winnerLabel: string | null = null;
                if (myStats && partnerStats) {
                  const mine = (myStats[metricKey] as number) ?? 0;
                  const theirs = (partnerStats[metricKey] as number) ?? 0;
                  if (mine > theirs) winnerLabel = '🏆 Venceu';
                  else if (mine < theirs) winnerLabel = 'Perdeu';
                  else winnerLabel = 'Empate';
                }
                return (
                  <>
                    <Badge variant="outline" className="text-xs">
                      A/B {c.ab_variant || '?'}
                    </Badge>
                    {winnerLabel && (
                      <Badge
                        className="text-xs"
                        variant={winnerLabel.includes('Venceu') ? 'default' : 'secondary'}
                      >
                        {winnerLabel} (
                        {cfg.winner_metric === 'clicks' ? 'cliques' : 'aberturas'})
                      </Badge>
                    )}
                  </>
                );
              })()}
            <span className="text-xs text-muted-foreground">
              {c.mode} • {formatDateTimeBR(c.created_at)}
            </span>
            {c.egoi_campaign_id && (
              <span className="text-xs text-muted-foreground">
                E-goi #{c.egoi_campaign_id}
              </span>
            )}
            {c.status === 'scheduled' && c.scheduled_at && (
              <span className="text-xs text-muted-foreground">
                agendado p/ {formatDateTimeBR(c.scheduled_at)}
              </span>
            )}
          </div>
          {c.error_message && (
            <div className="text-xs text-red-500 mt-1 break-words">{c.error_message}</div>
          )}
        </div>
        {canShowStats && (
          <Button
            size="sm"
            variant="ghost"
            disabled={!masterEnabled || refreshingStatsId === c.id}
            onClick={() => onRefreshStats(c.id)}
            title={masterEnabled ? 'Puxar métricas da E-goi' : 'Master switch desligado'}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${refreshingStatsId === c.id ? 'animate-spin' : ''}`}
            />
            {stats ? 'Atualizar' : 'Carregar métricas'}
          </Button>
        )}
      </div>
      {canShowStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <div className="rounded border p-2 bg-background">
            <div className="text-[10px] uppercase text-muted-foreground">Envios</div>
            <div className="text-lg font-semibold">{stats.delivered || stats.sent || 0}</div>
          </div>
          <div className="rounded border p-2 bg-background">
            <div className="text-[10px] uppercase text-muted-foreground">Abertura</div>
            <div className="text-lg font-semibold">{stats.open_rate ?? 0}%</div>
            <div className="text-[10px] text-muted-foreground">
              {stats.opens_unique || 0} únicas
            </div>
          </div>
          <div className="rounded border p-2 bg-background">
            <div className="text-[10px] uppercase text-muted-foreground">Cliques</div>
            <div className="text-lg font-semibold">{stats.click_rate ?? 0}%</div>
            <div className="text-[10px] text-muted-foreground">
              {stats.clicks_unique || 0} únicos
            </div>
          </div>
          <div className="rounded border p-2 bg-background">
            <div className="text-[10px] uppercase text-muted-foreground">Baixas</div>
            <div className="text-lg font-semibold">{stats.unsubscribes || 0}</div>
            <div className="text-[10px] text-muted-foreground">
              {stats.bounces || 0} bounces
            </div>
          </div>
          {stats.fetched_at && (
            <div className="col-span-2 md:col-span-4 text-[10px] text-muted-foreground text-right">
              Atualizado em {formatDateTimeBR(stats.fetched_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
