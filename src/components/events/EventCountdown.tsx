import { useEffect, useState } from 'react';
import { Clock, PartyPopper } from 'lucide-react';
import { parseLocalDateTime } from '@/lib/dateUtils';
import { isEventActive } from '@/lib/eventDateHelper';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface EventCountdownProps {
  date: string;
  time?: string | null;
  end_date?: string | null;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Live countdown to an event's start, with an "encerrado" state once it's past the visibility window. */
export const EventCountdown = ({ date, time, end_date }: EventCountdownProps) => {
  const { settings } = useSiteSettings();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const eventSettings = {
    timezoneOffset: settings.timezone_offset ? parseInt(settings.timezone_offset, 10) : -3,
    hoursAfterStart: settings.event_hours_after_start
      ? parseInt(settings.event_hours_after_start, 10)
      : 12,
    hoursWithoutTime: settings.event_hours_without_time
      ? parseInt(settings.event_hours_without_time, 10)
      : 24,
  };

  const active = isEventActive({ date, end_date, time }, eventSettings);

  if (!active) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-muted-foreground/30 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        Evento encerrado
      </div>
    );
  }

  const start = parseLocalDateTime(date, time);
  const remaining = start.getTime() - now;

  if (remaining <= 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
        <PartyPopper className="w-4 h-4" />
        Rolando agora
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
      <Clock className="w-4 h-4" />
      Faltam {formatRemaining(remaining)}
    </div>
  );
};
