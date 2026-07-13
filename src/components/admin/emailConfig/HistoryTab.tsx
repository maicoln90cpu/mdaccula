/**
 * HistoryTab — aba "Histórico" da tela Admin → E-mail.
 *
 * Extraído de `src/pages/admin/EmailConfig.tsx` (Fase C do slim-down).
 * Comportamento 100% preservado: mesma busca compartilhada com o bloco
 * "Eventos sem rascunho", mesmo agrupamento por evento, mesmos botões
 * (criar rascunho, enviar agora, A/B, liberar reenvio) e mesmas métricas
 * carregadas sob demanda.
 *
 * Toda a lógica de fetch continua no pai; aqui é só apresentação + delegação
 * via callbacks — não há chamada Supabase neste componente.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/alert-dialog";
import { RefreshCw, Send } from "lucide-react";
import { buildEmailMeta } from "@/lib/emailTemplates/emailMeta";
import type { Template } from "@/lib/emailTemplates/blocks";
import { SendNowButton } from "./SendNowButton";
import { AbTestButton } from "./AbTestButton";
import type {
  AbTestParams,
  Campaign,
  CampaignStatsMap,
  EventGroup,
  RealEventLite,
} from "./types";

interface HistoryTabProps {
  historySearch: string;
  setHistorySearch: (v: string) => void;
  campaigns: Campaign[];
  realEvents: RealEventLite[];
  groups: EventGroup[];
  campaignStats: CampaignStatsMap;
  expanded: Record<string, boolean>;
  setExpanded: (v: Record<string, boolean>) => void;
  dispatchingId: string | null;
  refreshingStatsId: string | null;
  masterEnabled: boolean;
  defaultEventTemplate: Template | null;
  dispatchNow: (
    eventId: string,
    opts?: { forceResend?: boolean; sendNow?: boolean },
  ) => void | Promise<void>;
  dispatchAbTest: (eventId: string, params: AbTestParams) => void | Promise<void>;
  resendEvent: (eventId: string) => void | Promise<void>;
  refreshCampaignStats: (campaignId: string) => void | Promise<void>;
  statusBadge: (s: Campaign["status"]) => JSX.Element;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const HistoryTab = ({
  historySearch,
  setHistorySearch,
  campaigns,
  realEvents,
  groups,
  campaignStats,
  expanded,
  setExpanded,
  dispatchingId,
  refreshingStatsId,
  masterEnabled,
  defaultEventTemplate,
  dispatchNow,
  dispatchAbTest,
  resendEvent,
  refreshCampaignStats,
  statusBadge,
}: HistoryTabProps) => {
  const q = norm(historySearch);
  const dispatchedIds = new Set(campaigns.map((c) => c.event_id));
  const allPending = realEvents.filter((e) => !dispatchedIds.has(e.id));
  const pending = q
    ? allPending.filter((e) => {
        const hay = norm(
          `${e.title} ${e.venue || ""} ${e.location_city || ""} ${e.location_state || ""}`,
        );
        return hay.includes(q);
      })
    : allPending;
  const visibleGroups = q ? groups.filter((g) => norm(g.title).includes(q)) : groups;

  return (
    <div className="space-y-4">
      {/* Campo de busca compartilhado: filtra "sem rascunho" E "histórico por evento" */}
      <div>
        <Input
          placeholder="Buscar em rascunhos e histórico (nome, cidade)…"
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* B.6.1 — Eventos sem campanha (importados via CSV/script) */}
      {allPending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Eventos sem rascunho ({q ? `${pending.length} de ${allPending.length}` : allPending.length})
            </CardTitle>
            <CardDescription>
              Eventos criados via importação ou script que ainda não tiveram um rascunho de e-mail criado. Clique para criar manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum evento sem rascunho encontrado para "{historySearch}".
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pending.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ev.date).toLocaleDateString("pt-BR")} • {ev.venue}, {ev.location_city}-{ev.location_state}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dispatchingId === ev.id}
                        onClick={() => dispatchNow(ev.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {dispatchingId === ev.id ? "Criando..." : "Criar rascunho"}
                      </Button>
                      <SendNowButton
                        eventTitle={ev.title}
                        disabled={dispatchingId === ev.id}
                        onConfirm={() => dispatchNow(ev.id, { sendNow: true, forceResend: true })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico por evento</CardTitle>
          <CardDescription>
            {groups.length} eventos • {campaigns.length} campanhas registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma campanha registrada ainda.
            </p>
          ) : visibleGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum evento encontrado para "{historySearch}".
            </p>
          ) : (
            <div className="space-y-2">
              {visibleGroups.map((g) => {
                const open = expanded[g.event_id];
                return (
                  <div key={g.event_id} className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExpanded({ ...expanded, [g.event_id]: !open })}
                      className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{g.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.total} disparo{g.total > 1 ? "s" : ""} • último em{" "}
                          {formatDateTimeBR(g.last.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(g.last.status)}
                        <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t divide-y">
                        {g.items.map((c) => {
                          const s = campaignStats[c.id];
                          const canShowStats = c.status === "sent" && !!c.egoi_campaign_id;
                          return (
                            <div key={c.id} className="p-3 text-sm space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {statusBadge(c.status)}
                                    {c.campaign_type === "ab_subject" && (() => {
                                      // Determina o vencedor entre pares A/B se ambos têm stats.
                                      const cfg = (c.ab_test_config || {}) as {
                                        winner_metric?: "opens" | "clicks";
                                      };
                                      const metricKey =
                                        cfg.winner_metric === "clicks" ? "click_rate" : "open_rate";
                                      const partner = g.items.find(
                                        (x) => x.id !== c.id && x.ab_group_id === c.ab_group_id,
                                      );
                                      const myStats = campaignStats[c.id];
                                      const partnerStats = partner ? campaignStats[partner.id] : null;
                                      let winnerLabel: string | null = null;
                                      if (myStats && partnerStats) {
                                        const mine = (myStats[metricKey] as number) ?? 0;
                                        const theirs = (partnerStats[metricKey] as number) ?? 0;
                                        if (mine > theirs) winnerLabel = "🏆 Venceu";
                                        else if (mine < theirs) winnerLabel = "Perdeu";
                                        else winnerLabel = "Empate";
                                      }
                                      return (
                                        <>
                                          <Badge variant="outline" className="text-xs">A/B {c.ab_variant || "?"}</Badge>
                                          {winnerLabel && (
                                            <Badge className="text-xs" variant={winnerLabel.includes("Venceu") ? "default" : "secondary"}>
                                              {winnerLabel} ({cfg.winner_metric === "clicks" ? "cliques" : "aberturas"})
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
                                    onClick={() => refreshCampaignStats(c.id)}
                                    title={masterEnabled ? "Puxar métricas da E-goi" : "Master switch desligado"}
                                  >
                                    <RefreshCw className={`w-4 h-4 mr-1 ${refreshingStatsId === c.id ? "animate-spin" : ""}`} />
                                    {s ? "Atualizar" : "Carregar métricas"}
                                  </Button>
                                )}
                              </div>
                              {canShowStats && s && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                                  <div className="rounded border p-2 bg-background">
                                    <div className="text-[10px] uppercase text-muted-foreground">Envios</div>
                                    <div className="text-lg font-semibold">{s.delivered || s.sent || 0}</div>
                                  </div>
                                  <div className="rounded border p-2 bg-background">
                                    <div className="text-[10px] uppercase text-muted-foreground">Abertura</div>
                                    <div className="text-lg font-semibold">{s.open_rate ?? 0}%</div>
                                    <div className="text-[10px] text-muted-foreground">{s.opens_unique || 0} únicas</div>
                                  </div>
                                  <div className="rounded border p-2 bg-background">
                                    <div className="text-[10px] uppercase text-muted-foreground">Cliques</div>
                                    <div className="text-lg font-semibold">{s.click_rate ?? 0}%</div>
                                    <div className="text-[10px] text-muted-foreground">{s.clicks_unique || 0} únicos</div>
                                  </div>
                                  <div className="rounded border p-2 bg-background">
                                    <div className="text-[10px] uppercase text-muted-foreground">Baixas</div>
                                    <div className="text-lg font-semibold">{s.unsubscribes || 0}</div>
                                    <div className="text-[10px] text-muted-foreground">{s.bounces || 0} bounces</div>
                                  </div>
                                  {s.fetched_at && (
                                    <div className="col-span-2 md:col-span-4 text-[10px] text-muted-foreground text-right">
                                      Atualizado em {formatDateTimeBR(s.fetched_at)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="p-3 bg-muted/20 flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={dispatchingId === g.event_id}
                            onClick={() => dispatchNow(g.event_id, { forceResend: true })}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {dispatchingId === g.event_id ? "Criando..." : "Criar rascunho agora"}
                          </Button>
                          <SendNowButton
                            eventTitle={g.title}
                            disabled={dispatchingId === g.event_id}
                            onConfirm={() => dispatchNow(g.event_id, { sendNow: true, forceResend: true })}
                          />
                          <AbTestButton
                            eventTitle={g.title}
                            defaultSubject={
                              buildEmailMeta(defaultEventTemplate?.subject_template, null, {
                                eventTitle: g.title,
                              }).subject || g.title
                            }
                            disabled={dispatchingId === g.event_id}
                            onConfirm={(p) => dispatchAbTest(g.event_id, p)}
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
                                  Isso limpa o marcador de disparo do evento <b>{g.title}</b>. Na próxima
                                  ação de envio, uma <b>nova</b> campanha será criada (o histórico anterior é
                                  preservado). Tem certeza?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => resendEvent(g.event_id)}>
                                  Sim, liberar reenvio
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
