import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Undo2, GitMerge, Loader2 } from 'lucide-react';
import { UndoMergeDialog, type MergeShellSummary } from '@/components/admin/UndoMergeDialog';
import { formatDateTimeBR } from '@/lib/formatters';

interface ShellRow {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
}

interface MemberRow {
  id: string;
  title: string;
  merged_into_id: string;
  merged_at: string | null;
}

interface MergeGroup {
  shell: ShellRow;
  memberCount: number;
  memberTitles: string[];
  latestMergedAt: string | null;
}

/**
 * Aba "Eventos Mesclados": fonte única de verdade = tabela `events`
 * (`is_merge_shell=true` pros cards, `merged_into_id` pros membros). Sem
 * nenhuma dependência de `application_logs` — funciona pra mesclagem de
 * qualquer idade.
 * Regra: só mostra grupos cujo card-vitrine ainda NÃO passou (end_date ??
 * date >= hoje).
 */
export const MergedEventsTab = ({ onChange }: { onChange?: () => void }) => {
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShell, setSelectedShell] = useState<MergeShellSummary | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data: shellRows } = await supabase
        .from('events')
        .select('id, title, date, end_date')
        .eq('is_merge_shell', true)
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(200);

      const shells = (shellRows || []) as ShellRow[];
      if (shells.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const shellIds = shells.map((s) => s.id);
      const { data: memberRows } = await supabase
        .from('events')
        .select('id, title, merged_into_id, merged_at')
        .in('merged_into_id', shellIds);

      const membersByShell = new Map<string, MemberRow[]>();
      ((memberRows || []) as MemberRow[]).forEach((m) => {
        const list = membersByShell.get(m.merged_into_id) || [];
        list.push(m);
        membersByShell.set(m.merged_into_id, list);
      });

      const groupsArr: MergeGroup[] = shells
        .map((shell) => {
          const members = membersByShell.get(shell.id) || [];
          const latestMergedAt = members.reduce<string | null>(
            (max, m) => (m.merged_at && (!max || m.merged_at > max) ? m.merged_at : max),
            null
          );
          return {
            shell,
            memberCount: members.length,
            memberTitles: members.map((m) => m.title),
            latestMergedAt,
          };
        })
        .filter((g) => g.memberCount > 0)
        .filter((g) => {
          const effectiveEnd =
            g.shell.end_date && g.shell.end_date >= g.shell.date ? g.shell.end_date : g.shell.date;
          return effectiveEnd >= todayStr;
        })
        .sort((a, b) => (b.latestMergedAt || '').localeCompare(a.latestMergedAt || ''));

      setGroups(groupsArr);
    } catch (err) {
      console.error('[MergedEventsTab] fetchGroups error:', err);
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
          const when = g.latestMergedAt ? formatDateTimeBR(g.latestMergedAt) : '—';
          return (
            <Card key={g.shell.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{g.shell.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.memberCount} evento(s) escondido(s) · Mesclado em {when}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    Escondidos: {g.memberTitles.join(', ')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedShell({ id: g.shell.id, title: g.shell.title })}
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
        open={!!selectedShell}
        onOpenChange={(o) => !o && setSelectedShell(null)}
        shell={selectedShell}
        onSuccess={() => {
          setSelectedShell(null);
          fetchGroups();
          onChange?.();
        }}
      />
    </>
  );
};
