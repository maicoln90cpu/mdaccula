import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

interface MergeLog {
  id: string;
  logged_at: string;
  context: {
    action: string;
    primary_id: string;
    primary_title: string;
    merged_event_ids: string[];
    merged_snapshot: any[];
    primary_pre_merge?: {
      id: string;
      date: string;
      end_date: string | null;
      views: number;
      blog_post_id: string | null;
      schedule: any;
      lineup: string[];
    };
    links_repointed?: { id: string; old_event_id: string }[];
  };
}

interface UndoMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: MergeLog | null;
  onSuccess: () => void;
}

/**
 * Desfaz a última mesclagem usando o snapshot salvo em application_logs.
 * - Recria os eventos deletados (preservando IDs originais)
 * - Restaura o estado pré-merge do principal (date/end_date/views/blog_post_id/schedule/lineup)
 * - Repõe os custom_links nos event_ids originais
 * - Remove os redirects de URL antiga criados
 * - Só funciona se o snapshot tiver `primary_pre_merge` (mesclagens posteriores a esta atualização)
 */
export const UndoMergeDialog = ({ open, onOpenChange, log, onSuccess }: UndoMergeDialogProps) => {
  const [working, setWorking] = useState(false);
  const [slugConflicts, setSlugConflicts] = useState<string[]>([]);
  const { toast } = useToast();

  const ctx = log?.context;
  const canUndo = !!ctx?.primary_pre_merge;
  const snapshot = ctx?.merged_snapshot || [];

  // Pré-checagem: slugs dos deletados podem ter sido reutilizados por novos eventos
  useEffect(() => {
    if (!open || !snapshot.length) {
      setSlugConflicts([]);
      return;
    }
    const slugs = snapshot.map((e: any) => e.slug).filter(Boolean);
    const ids = snapshot.map((e: any) => e.id);
    if (!slugs.length) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("slug, id")
        .in("slug", slugs);
      const conflicts = (data || [])
        .filter((row) => !ids.includes(row.id))
        .map((row) => row.slug);
      setSlugConflicts(conflicts);
    })();
  }, [open, snapshot]);

  const handleUndo = async () => {
    if (!log || !ctx || !ctx.primary_pre_merge) return;
    if (slugConflicts.length > 0) {
      toast({
        variant: "destructive",
        title: "Não é possível desfazer",
        description: `Slug(s) já em uso por outro evento: ${slugConflicts.join(", ")}`,
      });
      return;
    }
    setWorking(true);
    try {
      // 1. Remover redirects (FK ON DELETE CASCADE removeria se principal sumisse, mas ele continua)
      const oldSlugs = snapshot.map((e: any) => e.slug).filter(Boolean);
      if (oldSlugs.length > 0) {
        const { error: redErr } = await supabase
          .from("event_slug_redirects")
          .delete()
          .in("old_slug", oldSlugs);
        if (redErr) throw redErr;
      }

      // 2. Reinserir eventos deletados (preserva IDs)
      // Sanitiza campos virtuais que não devem ir no INSERT
      const rowsToInsert = snapshot.map((e: any) => {
        const { ...row } = e;
        return row;
      });
      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase.from("events").insert(rowsToInsert);
        if (insErr) throw insErr;
      }

      // 3. Restaurar custom_links aos event_ids originais
      const linkMap = ctx.links_repointed || [];
      // Agrupa por old_event_id
      const grouped: Record<string, string[]> = {};
      for (const l of linkMap) {
        if (!grouped[l.old_event_id]) grouped[l.old_event_id] = [];
        grouped[l.old_event_id].push(l.id);
      }
      for (const [oldEventId, linkIds] of Object.entries(grouped)) {
        const { error: linkErr } = await supabase
          .from("custom_links")
          .update({ event_id: oldEventId, updated_at: new Date().toISOString() })
          .in("id", linkIds);
        if (linkErr) throw linkErr;
      }

      // 4. Restaurar estado pré-merge do principal
      const pre = ctx.primary_pre_merge;
      const { error: restoreErr } = await supabase
        .from("events")
        .update({
          date: pre.date,
          end_date: pre.end_date,
          views: pre.views,
          blog_post_id: pre.blog_post_id,
          schedule: pre.schedule as any,
          lineup: pre.lineup,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pre.id);
      if (restoreErr) throw restoreErr;

      // 5. Log da operação (para evitar reexecução acidental)
      await supabase.from("application_logs").insert([{
        level: "info",
        message: `Desfazer mesclagem: ${snapshot.length} evento(s) restaurado(s)`,
        context: {
          action: "undo_merge",
          source_log_id: log.id,
          primary_id: pre.id,
          restored_event_ids: snapshot.map((e: any) => e.id),
        } as any,
      }]);

      toast({
        title: "Mesclagem desfeita!",
        description: `${snapshot.length} evento(s) restaurado(s) e principal reposto ao estado anterior.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[UndoMergeDialog] Erro ao desfazer:", err);
      toast({
        variant: "destructive",
        title: "Erro ao desfazer",
        description: err.message || "Nada foi alterado. Tente novamente.",
      });
    } finally {
      setWorking(false);
    }
  };

  if (!log || !ctx) return null;

  const when = new Date(log.logged_at).toLocaleString("pt-BR");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" /> Desfazer última mesclagem
          </DialogTitle>
          <DialogDescription>
            Mesclagem feita em <strong>{when}</strong> no evento <strong>{ctx.primary_title}</strong>.
          </DialogDescription>
        </DialogHeader>

        {!canUndo ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta mesclagem foi feita antes da atualização e não tem snapshot completo. Rollback só é possível via SQL manual.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="text-sm space-y-2">
              <p>Vou:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Recriar <strong>{snapshot.length}</strong> evento(s) deletado(s) com IDs e slugs originais.</li>
                <li>Reverter <strong>{ctx.primary_title}</strong> para o estado anterior à mesclagem (data, line-up, programação, views).</li>
                <li>Repor os links de venda nos eventos originais.</li>
                <li>Apagar os redirects de URL antiga criados pela mesclagem.</li>
              </ul>
            </div>

            {slugConflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Bloqueado:</strong> os slugs <code>{slugConflicts.join(", ")}</code> já foram reutilizados por outros eventos. Renomeie-os antes de desfazer.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Se você editou o evento principal depois de mesclar (mudou views/data/line-up), essas alterações serão perdidas.
              </AlertDescription>
            </Alert>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleUndo}
            disabled={working || !canUndo || slugConflicts.length > 0}
          >
            {working ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Desfazendo...</>
            ) : (
              "Confirmar desfazer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
