import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

export interface MergeShellSummary {
  id: string;
  title: string;
}

interface MergeMember {
  id: string;
  title: string;
  merged_at: string | null;
}

interface UndoMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shell: MergeShellSummary | null;
  onSuccess: () => void;
}

/**
 * Desfaz uma mesclagem lendo o grupo direto de `events`
 * (`merged_into_id = shell.id`) — sem nenhum snapshot/log envolvido. Como a
 * mesclagem nunca altera dado nenhum dos eventos escondidos, desfazer é
 * sempre seguro: reativa todos os membros e inativa o card-vitrine.
 */
export const UndoMergeDialog = ({ open, onOpenChange, shell, onSuccess }: UndoMergeDialogProps) => {
  const [working, setWorking] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<MergeMember[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !shell) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, merged_at')
        .eq('merged_into_id', shell.id);
      setMembers((data as MergeMember[]) || []);
      setLoadingMembers(false);
    })();
  }, [open, shell]);

  const handleUndo = async () => {
    if (!shell) return;
    setWorking(true);
    try {
      const { error: reactErr } = await supabase
        .from('events')
        .update({
          status: 'active',
          merged_into_id: null,
          merged_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('merged_into_id', shell.id);
      if (reactErr) throw reactErr;

      const { error: shellErr } = await supabase
        .from('events')
        .update({ status: 'merged_inactive', updated_at: new Date().toISOString() })
        .eq('id', shell.id);
      if (shellErr) throw shellErr;

      toast({
        title: 'Mesclagem desfeita!',
        description: `${members.length} evento(s) voltaram a ficar ativos, exatamente como estavam.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('[UndoMergeDialog] Erro ao desfazer:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer',
        description: message || 'Nada foi alterado. Tente novamente.',
      });
    } finally {
      setWorking(false);
    }
  };

  if (!shell) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" /> Desfazer mesclagem
          </DialogTitle>
          <DialogDescription>
            Vai desfazer <strong>{shell.title}</strong> por completo.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-2">
          <p>Vou:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Reativar {members.length} evento(s): {members.map((m) => m.title).join(', ') || '—'}.
              Nenhum deles teve qualquer dado alterado pela mesclagem — voltam exatamente como
              estavam.
            </li>
            <li>Deixar "{shell.title}" inativo (guardado, não aparece mais em nenhuma tela).</li>
          </ul>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Ação reversível a qualquer momento, sem limite de tempo.</AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleUndo}
            disabled={working || loadingMembers || members.length === 0}
          >
            {working ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Desfazendo...
              </>
            ) : (
              'Confirmar desfazer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
