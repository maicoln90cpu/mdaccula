import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { formatEventDateRange } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';

interface MergeableEvent {
  id: string;
  title: string;
  slug: string;
  date: string;
  end_date?: string | null;
  venue: string;
  views?: number | null;
  blog_post_id?: string | null;
  ticket_link?: string | null;
}

interface MergeEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MergeableEvent[];
  onSuccess: () => void;
}

/**
 * Mescla 2+ eventos em 1 (festival multi-dias).
 * - Usuário escolhe qual será o "evento principal" (sobrevive).
 * - end_date do principal recebe a maior data entre todos.
 * - custom_links que apontavam para os duplicados são repontados ao principal.
 * - Soma views dos duplicados no principal.
 * - blog_post_id do principal é preservado; se principal não tiver, herda do primeiro duplicado que tiver.
 * - Snapshot dos eventos deletados é gravado em application_logs para auditoria/rollback manual.
 * - AÇÃO DESTRUTIVA: confirmação dupla antes de executar.
 */
export const MergeEventsDialog = ({
  open,
  onOpenChange,
  events,
  onSuccess,
}: MergeEventsDialogProps) => {
  const [primaryId, setPrimaryId] = useState<string>(events[0]?.id || '');
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [ticketsPerDay, setTicketsPerDay] = useState<boolean | null>(null);
  const [mergedTitle, setMergedTitle] = useState<string>('');
  const { toast } = useToast();

  const primary = events.find((e) => e.id === primaryId);
  const duplicates = events.filter((e) => e.id !== primaryId);

  const dateRange = useMemo(() => {
    if (!events.length) return null;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0].date;
    const end = sorted[sorted.length - 1].end_date || sorted[sorted.length - 1].date;
    return { start, end };
  }, [events]);

  // Fase 5: detecta links de venda distintos para sugerir default do toggle.
  const hasDistinctTicketLinks = useMemo(() => {
    const links = events.map((e) => (e.ticket_link || '').trim()).filter(Boolean);
    return new Set(links).size > 1;
  }, [events]);

  // Inicializa o toggle automaticamente ao abrir o modal.
  useEffect(() => {
    if (open) {
      setTicketsPerDay(hasDistinctTicketLinks);
    }
  }, [open, hasDistinctTicketLinks]);

  // Sincroniza o campo "nome do festival" com o principal selecionado.
  // O usuário pode sobrescrever livremente; se voltar a ficar vazio, cai no título do principal.
  useEffect(() => {
    if (open && primary) {
      setMergedTitle(primary.title);
    }
  }, [open, primary?.id, primary?.title]);

  const effectiveTicketsPerDay = ticketsPerDay ?? hasDistinctTicketLinks;
  const effectiveTitle = (mergedTitle.trim() || primary?.title || '').trim();

  const handleMerge = async () => {
    if (!primary || !dateRange) return;
    setMerging(true);
    try {
      const duplicateIds = duplicates.map((e) => e.id);
      const allIds = [primary.id, ...duplicateIds];

      // 0. Buscar dados COMPLETOS de todos os eventos (necessário p/ schedule e snapshot do principal)
      logger.debug('[merge] step 0 · fetching full events', { allIds });
      const { data: fullEvents, error: fetchErr } = await supabase
        .from('events')
        .select('*')
        .in('id', allIds);
      if (fetchErr) throw fetchErr;

      const fullPrimary = fullEvents?.find((e) => e.id === primary.id);
      const fullDuplicates = (fullEvents || []).filter((e) => e.id !== primary.id);
      if (!fullPrimary) throw new Error('Evento principal não encontrado.');

      // 0b. Buscar links que serão repontados (precisamos pra rollback)
      logger.debug('[merge] step 0b · fetching links to repoint');
      const { data: linksToRepoint } = await supabase
        .from('custom_links')
        .select('id, event_id')
        .in('event_id', duplicateIds);

      // 1. Construir schedule automaticamente: 1 entrada por evento original
      // Inclui o principal + todos os duplicados, ordenados por data.
      // Normaliza lineup para corrigir entradas vindas de CSV ("A, B, C" como string única).
      const { normalizeLineup } = await import('@/lib/lineupNormalizer');
      const allForSchedule = [...fullEvents!].sort((a, b) => a.date.localeCompare(b.date));
      const autoSchedule = allForSchedule.map((e) => ({
        date: e.date,
        time: e.time,
        end_time: e.end_time || null,
        lineup: normalizeLineup(e.lineup),
      }));

      // 2. Calcular novos valores
      const totalViews =
        (fullPrimary.views || 0) + fullDuplicates.reduce((sum, e) => sum + (e.views || 0), 0);
      const inheritedBlogPostId =
        fullPrimary.blog_post_id ||
        fullDuplicates.find((e) => e.blog_post_id)?.blog_post_id ||
        null;

      // 3. Snapshot COMPLETO para rollback (inclui estado pré-merge do principal e mapping de links)
      logger.debug('[merge] step 3 · inserting snapshot log');
      await supabase.from('application_logs').insert([
        {
          level: 'info',
          message: `Mesclagem de eventos: ${duplicates.length} → 1`,
          context: {
            action: 'merge_events',
            primary_id: primary.id,
            primary_title: primary.title,
            merged_event_ids: duplicateIds,
            merged_snapshot: JSON.parse(JSON.stringify(fullDuplicates)),
            primary_pre_merge: JSON.parse(
              JSON.stringify({
                id: fullPrimary.id,
                title: fullPrimary.title,
                date: fullPrimary.date,
                end_date: fullPrimary.end_date ?? null,
                views: fullPrimary.views ?? 0,
                blog_post_id: fullPrimary.blog_post_id ?? null,
                schedule: fullPrimary.schedule ?? null,
                lineup: fullPrimary.lineup ?? [],
              })
            ),
            new_title: effectiveTitle,
            links_repointed: (linksToRepoint || []).map((l) => ({
              id: l.id,
              old_event_id: l.event_id,
            })),
            new_end_date: dateRange.end,
            new_start_date: dateRange.start,
            new_views: totalViews,
            new_schedule: autoSchedule,
          },
        },
      ]);

      // 4. Repontar custom_links dos duplicados → principal
      if (duplicateIds.length > 0) {
        logger.debug('[merge] step 4 · repointing custom_links', { count: duplicateIds.length });
        const { error: linkErr } = await supabase
          .from('custom_links')
          .update({ event_id: primary.id, updated_at: new Date().toISOString() })
          .in('event_id', duplicateIds);
        if (linkErr) throw linkErr;
      }

      // 5. Atualizar evento principal: end_date + schedule + views consolidadas + tickets_per_day
      logger.debug('[merge] step 5 · updating primary event');
      const { error: updateErr } = await supabase
        .from('events')
        .update({
          title: effectiveTitle,
          end_date: dateRange.end,
          date: dateRange.start,
          views: totalViews,
          blog_post_id: inheritedBlogPostId,
          schedule: autoSchedule,
          tickets_per_day: effectiveTicketsPerDay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', primary.id);
      if (updateErr) throw updateErr;

      // 6. Preservar URLs antigas
      if (duplicates.length > 0) {
        const redirectRows = duplicates
          .filter((e) => e.slug && e.slug !== primary.slug)
          .map((e) => ({
            old_slug: e.slug,
            event_id: primary.id,
            reason: `merged into festival "${primary.title}"`,
          }));
        if (redirectRows.length > 0) {
          logger.debug('[merge] step 6 · upserting slug redirects', { count: redirectRows.length });
          const { error: redirErr } = await supabase
            .from('event_slug_redirects')
            .upsert(redirectRows, { onConflict: 'old_slug' });
          if (redirErr) throw redirErr;
        }
      }

      // 7. Soft-delete dos duplicados: marca como merged_inactive em vez de DELETE.
      // Permite reativar via admin e mantém histórico/FKs intactos.
      if (duplicateIds.length > 0) {
        logger.debug('[merge] step 7 · soft-deleting duplicates', { ids: duplicateIds });
        const { error: delErr } = await supabase
          .from('events')
          .update({
            status: 'merged_inactive',
            merged_into_id: primary.id,
            merged_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', duplicateIds);
        if (delErr) throw delErr;
      }

      logger.debug('[merge] step 7 done · todas as operações concluídas com sucesso');
      toast({
        title: 'Eventos mesclados!',
        description: `${duplicates.length + 1} eventos viraram 1 festival de ${formatEventDateRange(dateRange.start, dateRange.end)}.`,
      });
      // Fase 6.1: garantir que UI atualize ANTES de fechar o modal,
      // evitando bug de "precisa atualizar a página"
      try {
        await Promise.resolve(onSuccess());
      } catch (cbErr) {
        logger.warn('[merge] onSuccess callback falhou (não bloqueia merge):', cbErr);
      }
      setMerging(false);
      onOpenChange(false);
      setConfirming(false);
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('[MergeEventsDialog] Erro ao mesclar:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao mesclar eventos',
        description: message || 'Tente novamente. Nenhuma alteração foi salva.',
      });
      setMerging(false);
    }
  };

  if (!events.length || !dateRange) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Fase 6.1: trava o modal durante a operação — impede que realtime/cliques
        // acidentais fechem o dialog no meio da mesclagem.
        if (merging) return;
        if (!o) setConfirming(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar {events.length} eventos em 1 festival</DialogTitle>
          <DialogDescription>
            Resultado: <strong>{formatEventDateRange(dateRange.start, dateRange.end)}</strong>. Os
            eventos não escolhidos como principal serão inativados (ocultos do site, reativáveis
            pelo admin), e seus links de venda e contagem de views serão preservados no principal.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="space-y-4 py-2">
              <Label className="text-base">Escolha o evento principal (que sobreviverá):</Label>
              <RadioGroup value={primaryId} onValueChange={setPrimaryId}>
                {events.map((e) => (
                  <div key={e.id} className="flex items-start space-x-2 rounded-lg border p-3">
                    <RadioGroupItem value={e.id} id={e.id} className="mt-1" />
                    <Label htmlFor={e.id} className="flex-1 cursor-pointer font-normal">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.date}
                        {e.end_date && e.end_date !== e.date ? ` → ${e.end_date}` : ''} · {e.venue}
                        {e.views ? ` · ${e.views} views` : ''}
                        {e.blog_post_id ? ' · com artigo' : ''}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="merged-title" className="text-base">
                  Nome do festival (evento final):
                </Label>
                <Input
                  id="merged-title"
                  value={mergedTitle}
                  onChange={(e) => setMergedTitle(e.target.value)}
                  placeholder={primary?.title || 'Nome do festival'}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  Você pode renomear o evento final (ex.: "Festival XYZ 2026"). Se deixar em branco,
                  usaremos o nome do evento principal selecionado.
                </p>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ação reversível. {duplicates.length} evento(s) serão <strong>inativados</strong>{' '}
                (não deletados) e poderão ser reativados a qualquer momento pelo admin.
              </AlertDescription>
            </Alert>

            <div
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                hasDistinctTicketLinks
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-input bg-muted/30'
              }`}
            >
              <Switch
                id="merge-tickets-per-day"
                checked={effectiveTicketsPerDay}
                onCheckedChange={(v) => setTicketsPerDay(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="merge-tickets-per-day" className="cursor-pointer">
                  Um link de venda por dia (festival)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, o botão "Comprar Ingresso" na página do festival abre um{' '}
                  <strong>modal de seleção do dia</strong> (cada dia abre o seu próprio link).
                  Quando desligado, o botão vai direto para o link único do evento principal.
                </p>
                {hasDistinctTicketLinks && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Detectamos <strong>links de venda diferentes</strong> nos eventos selecionados —
                    recomendamos manter ligado.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirming(true)}
                disabled={!primaryId}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Confirmação final.</strong> Vou:
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                  <li>
                    Renomear o evento principal para <strong>{effectiveTitle}</strong>
                    {effectiveTitle !== primary?.title ? (
                      <>
                        {' '}
                        (antes: <em>{primary?.title}</em>)
                      </>
                    ) : null}{' '}
                    com data {formatEventDateRange(dateRange.start, dateRange.end)} (vira o
                    "guarda-chuva" do festival).
                  </li>
                  {effectiveTicketsPerDay ? (
                    <li>
                      <strong>Preservar</strong> os links de venda originais de cada dia, apenas
                      reassociando-os ao festival. O botão <strong>Comprar Ingresso</strong> abrirá
                      um <strong>modal de seleção do dia</strong>, e cada dia abrirá o seu próprio
                      link.
                    </li>
                  ) : (
                    <li>
                      Repontar os {duplicates.length} link(s) de venda dos duplicados para o
                      principal — o botão <strong>Comprar Ingresso</strong> usará o{' '}
                      <strong>link único</strong> do evento principal.
                    </li>
                  )}
                  <li>
                    Criar redirect das URLs antigas (visitantes que abrirem o link antigo verão o
                    festival).
                  </li>
                  <li>
                    <strong>Inativar</strong> {duplicates.length} evento(s) duplicado(s) (ficam
                    ocultos do site mas podem ser reativados pelo admin).
                  </li>
                  <li>
                    Definir <strong>"Um link de venda por dia"</strong>:{' '}
                    {effectiveTicketsPerDay ? 'LIGADO (modal por dia)' : 'DESLIGADO (link único)'}.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={merging}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleMerge} disabled={merging}>
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mesclando...
                  </>
                ) : (
                  'Confirmar e mesclar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
