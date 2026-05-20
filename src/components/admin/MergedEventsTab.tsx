import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Undo2, GitMerge, Loader2 } from "lucide-react";
import { UndoMergeDialog } from "@/components/admin/UndoMergeDialog";

interface MergeLog {
  id: string;
  logged_at: string;
  context: any;
}

/**
 * Aba "Eventos Mesclados": lista TODAS as mesclagens não desfeitas dos últimos 7 dias
 * e oferece botão de desfazer para cada uma. Reaproveita o UndoMergeDialog existente.
 */
export const MergedEventsTab = ({ onChange }: { onChange?: () => void }) => {
  const [logs, setLogs] = useState<MergeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MergeLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("application_logs")
      .select("id, logged_at, context")
      .eq("level", "info")
      .gte("logged_at", sinceIso)
      .order("logged_at", { ascending: false })
      .limit(200);

    const all = (data || []) as MergeLog[];
    const undoneIds = new Set(
      all
        .filter((l) => l.context?.action === "undo_merge")
        .map((l) => l.context?.source_log_id)
        .filter(Boolean),
    );
    const merges = all.filter(
      (l) => l.context?.action === "merge_events" && !undoneIds.has(l.id),
    );
    setLogs(merges);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!logs.length) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <GitMerge className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">Nenhuma mesclagem ativa</h3>
          <p className="text-sm text-muted-foreground">
            Mesclagens dos últimos 7 dias que ainda podem ser desfeitas aparecem aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {logs.map((log) => {
          const ctx = log.context || {};
          const when = new Date(log.logged_at).toLocaleString("pt-BR");
          const mergedCount = ctx.merged_event_ids?.length || 0;
          const canUndo = !!ctx.primary_pre_merge;
          return (
            <Card key={log.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{ctx.primary_title || "Evento principal"}</div>
                  <div className="text-xs text-muted-foreground">
                    {mergedCount} evento(s) absorvido(s) · {when}
                  </div>
                  {!canUndo && (
                    <div className="text-xs text-destructive mt-1">
                      Mesclagem antiga sem snapshot — não pode ser desfeita por aqui.
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(log)}
                  disabled={!canUndo}
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Desfazer
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <UndoMergeDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        log={selected as any}
        onSuccess={() => {
          setSelected(null);
          fetchLogs();
          onChange?.();
        }}
      />
    </>
  );
};
