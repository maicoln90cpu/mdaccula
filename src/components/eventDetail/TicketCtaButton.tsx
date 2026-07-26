import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib';
import { safeExternalUrl } from '@/lib/safeExternalUrl';

// CTA principal de compra — reaproveitado no card mobile, card desktop e na barra fixa mobile.
export const TICKET_CTA_CLASSES =
  'w-full btn-ticket-glow animate-ticket-glow-pulse animate-ticket-glow-shift animate-ticket-scale-pulse';

export function TicketCtaButton({
  useDayPicker,
  ticketLink,
  ticketButtonText,
  onOpenDayPicker,
  className,
}: {
  useDayPicker: boolean;
  ticketLink: string;
  ticketButtonText: string;
  onOpenDayPicker: () => void;
  className?: string;
}) {
  if (useDayPicker) {
    return (
      <Button
        className={cn(TICKET_CTA_CLASSES, className)}
        size="lg"
        onClick={onOpenDayPicker}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {ticketButtonText}
      </Button>
    );
  }
  return (
    <Button asChild className={cn(TICKET_CTA_CLASSES, className)} size="lg">
      <a href={safeExternalUrl(ticketLink)} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        {ticketButtonText}
      </a>
    </Button>
  );
}
