import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/dateUtils";
import { parseSchedule } from "@/lib/eventScheduleHelper";

interface TicketDayPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  schedule: unknown;
  fallbackTicketLink?: string | null;
}

interface DayOption {
  date: string;
  label: string;
  url: string;
  linkTitle?: string;
}

/**
 * Modal exibido quando um evento mesclado tem `tickets_per_day = true`.
 * Lista os dias do `schedule` cruzados com `custom_links` (mesmo event_id, com override_date).
 * Se não houver link para um dia, mostra fallback (ticket_link principal) com aviso.
 */
export const TicketDayPickerModal = ({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  schedule,
  fallbackTicketLink,
}: TicketDayPickerModalProps) => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayOption[]>([]);

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from("custom_links")
        .select("title, url, override_date")
        .eq("event_id", eventId)
        .eq("enabled", true);

      if (cancelled) return;

      const scheduleDays = parseSchedule(schedule) || [];
      const linkByDate = new Map<string, { url: string; title?: string }>();
      (links || []).forEach((l) => {
        if (l.override_date && l.url) {
          linkByDate.set(l.override_date, { url: l.url, title: l.title });
        }
      });

      const built: DayOption[] = scheduleDays.map((d) => {
        const match = linkByDate.get(d.date);
        const label = parseLocalDate(d.date).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        return {
          date: d.date,
          label,
          url: match?.url || fallbackTicketLink || "",
          linkTitle: match?.title,
        };
      });

      setDays(built);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId, schedule, fallbackTicketLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha o dia</DialogTitle>
          <DialogDescription>
            {eventTitle} tem ingressos vendidos separadamente por dia. Selecione abaixo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum dia disponível no momento.
          </p>
        ) : (
          <div className="space-y-2 py-2">
            {days.map((d) => (
              <Button
                key={d.date}
                asChild={!!d.url}
                disabled={!d.url}
                variant="outline"
                className="w-full justify-between h-auto py-3"
              >
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center gap-2 capitalize text-left">
                      <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>
                        <span className="block font-medium">{d.label}</span>
                        {d.linkTitle && (
                          <span className="block text-xs text-muted-foreground font-normal">
                            {d.linkTitle}
                          </span>
                        )}
                      </span>
                    </span>
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="capitalize">{d.label} (sem link)</span>
                )}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
