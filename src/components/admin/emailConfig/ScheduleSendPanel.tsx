/**
 * ScheduleSendPanel — bloco de agendamento de disparo dentro da aba
 * "Envio manual". Permite escolher uma data/hora futura para o envio (em
 * vez de "enviar agora"/"criar rascunho") e lista os agendamentos pendentes
 * do evento selecionado, com opção de cancelar.
 *
 * Cancelar não precisa de Edge Function: event_email_campaigns já tem RLS
 * de admin autenticado (mesmo padrão usado por resendEvent/markManual), então
 * é um UPDATE direto revertendo a linha para 'draft'.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { formatDateTimeBR } from "@/lib/formatters";

type ScheduledRow = {
  id: string;
  scheduled_at: string | null;
  scheduled_send_attempts: number | null;
  error_message: string | null;
};

interface ScheduleSendPanelProps {
  eventId: string;
  scheduleAt: string;
  onScheduleAtChange: (v: string) => void;
  disabled: boolean;
  scheduling: boolean;
  onSchedule: () => void;
}

export function ScheduleSendPanel({
  eventId,
  scheduleAt,
  onScheduleAtChange,
  disabled,
  scheduling,
  onSchedule,
}: ScheduleSendPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["scheduled-sends", eventId],
    queryFn: async (): Promise<ScheduledRow[]> => {
      if (!eventId) return [];
      const { data, error } = await (supabase.from as any)("event_email_campaigns")
        .select("id, scheduled_at, scheduled_send_attempts, error_message")
        .eq("event_id", eventId)
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data as ScheduledRow[]) ?? [];
    },
    enabled: !!eventId,
    refetchInterval: 30_000,
  });

  const pending = data ?? [];

  async function cancelSchedule(id: string) {
    setCancelingId(id);
    try {
      const { error } = await (supabase.from as any)("event_email_campaigns")
        .update({
          status: "draft",
          mode: "draft",
          scheduled_at: null,
          scheduled_send_claimed_at: null,
          scheduled_send_attempts: 0,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Agendamento cancelado", description: "A campanha voltou para rascunho." });
      queryClient.invalidateQueries({ queryKey: ["scheduled-sends", eventId] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao cancelar", description: e.message ?? String(e) });
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="batch-schedule-at">Agendar para</Label>
          <Input
            id="batch-schedule-at"
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => onScheduleAtChange(e.target.value)}
          />
        </div>
        <Button variant="outline" disabled={disabled || scheduling || !scheduleAt} onClick={onSchedule}>
          <CalendarClock className="w-4 h-4 mr-2" />
          {scheduling ? "Agendando..." : "Agendar"}
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agendamentos pendentes deste evento
          </div>
          {pending.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">Agendado</Badge>
                  <span>{formatDateTimeBR(row.scheduled_at)}</span>
                  {(row.scheduled_send_attempts ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {row.scheduled_send_attempts} tentativa{row.scheduled_send_attempts === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {row.error_message && (
                  <div className="text-xs text-red-500 mt-0.5 break-words">{row.error_message}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={cancelingId === row.id}
                onClick={() => cancelSchedule(row.id)}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScheduleSendPanel;
