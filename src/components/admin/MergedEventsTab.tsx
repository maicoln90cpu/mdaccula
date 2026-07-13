import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Undo2, GitMerge, Loader2 } from "lucide-react";
import { UndoMergeDialog } from "@/components/admin/UndoMergeDialog";

interface MergedEventRow {
  id: string;
  title: string;
  slug: string | null;
  date: string;
  end_date: string | null;
  merged_at: string | null;
  merged_into_id: string;
}

interface PrimaryRow {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
}

interface MergeGroup {
  primary: PrimaryRow;
  merged: MergedEventRow[];
  latestMergedAt: string | null;
  log: any | null; // application_logs row (se existir) com snapshot p/ desfazer
}

/**
 * Aba "Eventos Mesclados":
 * Fonte da verdade = tabela `events` (status='merged_inactive', merged_into_id NOT NULL).
 * Logs só são consultados como complemento para habilitar o botão "Desfazer" (quando existir
 * snapshot em application_logs). Sem log → item aparece mas com Desfazer desabilitado.
 * Regra: só mostra grupos cujo evento principal ainda NÃO passou (end_date ?? date >= hoje).
 */
export const MergedEventsTab = ({ onChange }: { onChange?: () => void }) => {
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1) Buscar todos os eventos mesclados (inativos com merged_into_id)
      const { data: mergedRows } = await supabase
        .from("events")
        .select("id, title, slug, date, end_date, merged_at, merged_into_id")
        .not("merged_into_id", "is", null)
        .order("merged_at", { ascending: false })
        .limit(500);

      const merged = (mergedRows || []) as MergedEventRow[];
      if (merged.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // 2) Buscar os eventos principais
      const primaryIds = Array.from(new Set(merged.map((m) => m.merged_into_id)));
      const { data: primaryRows } = await supabase
        .from("events")
        .select("id, title, date, end_date")
        .in("id", primaryIds);
      const primaryMap = new Map<string, PrimaryRow>(
        ((primaryRows || []) as PrimaryRow[]).map((p) => [p.id, p]),
      );

      // 3) Buscar logs com snapshot (últimos 90 dias) para habilitar undo quando existir
      const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from("application_logs")
        .select("id, logged_at, context")
        .eq("level", "info")
        .gte("logged_at", sinceIso)
        .order("logged_at", { ascending: false })
        .limit(500);

      const allLogs = (logs || []) as Array<{ id: string; logged_at: string; context: any }>;
      const undoneSourceIds = new Set(
        allLogs
          .filter((l) => l.context?.action === "undo_merge")
          .map((l) => l.context?.source_log_id)
          .filter(Boolean),
      );
      const logsByPrimary = new Map<string, any>();
      for (const l of allLogs) {
        if (l.context?.action !== "merge_events") continue;
        if (undoneSourceIds.has(l.id)) continue;
        const pid = l.context?.primary_id;
        if (!pid) continue;
        // manter o log mais recente por primary
        if (!logsByPrimary.has(pid)) logsByPrimary.set(pid, l);
      }

      // 4) Agrupar por primary e filtrar "ainda não passou"
      const grouped = new Map<string, MergeGroup>();
      for (const m of merged) {
        const primary = primaryMap.get(m.merged_into_id);
        if (!primary) continue; // órfão: principal foi apagado
        const effectiveEnd = primary.end_date && primary.end_date >= primary.date
          ? primary.end_date
          : primary.date;
        if (effectiveEnd < todayStr) continue; // já passou

        let g = grouped.get(primary.id);
        if (!g) {
          g = {
            primary,
            merged: [],
            latestMergedAt: null,
            log: logsByPrimary.get(primary.id) || null,
          };
          grouped.set(primary.id, g);
        }
        g.merged.push(m);
        if (m.merged_at && (!g.latestMergedAt || m.merged_at > g.latestMergedAt)) {
          g.latestMergedAt = m.merged_at;
        }
      }

      const arr = Array.from(grouped.values()).sort((a, b) => {
        const aKey = a.latestMergedAt || "";
        const bKey = b.latestMergedAt || "";
        return bKey.localeCompare(aKey);
      });
      setGroups(arr);
    } catch (err) {
      console.error("[MergedEventsTab] fetchGroups error:", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <GitMerge className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">Nenhuma mesclagem ativa</h3>
          <p className="text-sm text-muted-foreground">
            Mesclagens cujos eventos ainda não ocorreram aparecem aqui e podem ser desfeitas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((g) => {
          const canUndo = !!g.log?.context?.primary_pre_merge;
          const when = g.latestMergedAt
            ? formatDateTimeBR(g.latestMergedAt)
            : "—";
          return (
            <Card key={g.primary.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{g.primary.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.merged.length} evento(s) absorvido(s) · Mesclado em {when}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    Absorvidos: {g.merged.map((m) => m.title).join(", ")}
                  </div>
                  {!canUndo && (
                    <div className="text-xs text-amber-600 mt-1">
                      Mesclagem antiga sem snapshot em log — desfazer só via SQL manual.
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLog(g.log)}
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
        open={!!selectedLog}
        onOpenChange={(o) => !o && setSelectedLog(null)}
        log={selectedLog as any}
        onSuccess={() => {
          setSelectedLog(null);
          fetchGroups();
          onChange?.();
        }}
      />
    </>
  );
};
