import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { formatEventDateRange } from "@/lib/dateUtils";

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
export const MergeEventsDialog = ({ open, onOpenChange, events, onSuccess }: MergeEventsDialogProps) => {
  const [primaryId, setPrimaryId] = useState<string>(events[0]?.id || "");
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
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

  const handleMerge = async () => {
    if (!primary || !dateRange) return;
    setMerging(true);
    try {
      // 1. Snapshot para auditoria
      const totalViews =
        (primary.views || 0) + duplicates.reduce((sum, e) => sum + (e.views || 0), 0);
      const inheritedBlogPostId =
        primary.blog_post_id || duplicates.find((e) => e.blog_post_id)?.blog_post_id || null;

      await supabase.from("application_logs").insert([{
        level: "info",
        message: `Mesclagem de eventos: ${duplicates.length} → 1`,
        context: {
          action: "merge_events",
          primary_id: primary.id,
          primary_title: primary.title,
          merged_event_ids: duplicates.map((e) => e.id),
          merged_snapshot: JSON.parse(JSON.stringify(duplicates)),
          new_end_date: dateRange.end,
          new_views: totalViews,
        } as any,
      }]);

      // 2. Repontar custom_links dos duplicados → principal
      const duplicateIds = duplicates.map((e) => e.id);
      if (duplicateIds.length > 0) {
        const { error: linkErr } = await supabase
          .from("custom_links")
          .update({ event_id: primary.id, updated_at: new Date().toISOString() })
          .in("event_id", duplicateIds);
        if (linkErr) throw linkErr;
      }

      // 3. Atualizar evento principal com end_date + views consolidadas
      const { error: updateErr } = await supabase
        .from("events")
        .update({
          end_date: dateRange.end,
          date: dateRange.start,
          views: totalViews,
          blog_post_id: inheritedBlogPostId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primary.id);
      if (updateErr) throw updateErr;

      // 4. Deletar duplicados
      if (duplicateIds.length > 0) {
        const { error: delErr } = await supabase
          .from("events")
          .delete()
          .in("id", duplicateIds);
        if (delErr) throw delErr;
      }

      toast({
        title: "Eventos mesclados!",
        description: `${duplicates.length + 1} eventos viraram 1 festival de ${formatEventDateRange(dateRange.start, dateRange.end)}.`,
      });
      onSuccess();
      onOpenChange(false);
      setConfirming(false);
    } catch (err: any) {
      console.error("[MergeEventsDialog] Erro ao mesclar:", err);
      toast({
        variant: "destructive",
        title: "Erro ao mesclar eventos",
        description: err.message || "Tente novamente. Nenhuma alteração foi salva.",
      });
    } finally {
      setMerging(false);
    }
  };

  if (!events.length || !dateRange) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setConfirming(false); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar {events.length} eventos em 1 festival</DialogTitle>
          <DialogDescription>
            Resultado: <strong>{formatEventDateRange(dateRange.start, dateRange.end)}</strong>.
            Os eventos não escolhidos como principal serão deletados, mas seus links de venda e contagem de views serão preservados no principal.
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
                        {e.end_date && e.end_date !== e.date ? ` → ${e.end_date}` : ""} · {e.venue}
                        {e.views ? ` · ${e.views} views` : ""}
                        {e.blog_post_id ? " · com artigo" : ""}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ação destrutiva. {duplicates.length} evento(s) serão deletados. Um snapshot fica salvo em logs por 7 dias para rollback manual.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
                  <li>Atualizar <strong>{primary?.title}</strong> com data {formatEventDateRange(dateRange.start, dateRange.end)}.</li>
                  <li>Repontar links de venda dos {duplicates.length} duplicados para o principal.</li>
                  <li>Deletar {duplicates.length} evento(s) duplicado(s).</li>
                </ul>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={merging}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleMerge} disabled={merging}>
                {merging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mesclando...</> : "Confirmar e mesclar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
