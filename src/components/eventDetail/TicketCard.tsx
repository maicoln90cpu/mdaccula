import { forwardRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { safeExternalUrl } from '@/lib/safeExternalUrl';
import { TicketCtaButton } from './TicketCtaButton';

interface TicketCardProps {
  cardTitle: string;
  ticketLink: string;
  ticketButtonText: string;
  useDayPicker: boolean;
  onOpenDayPicker: () => void;
  pixWhatsAppLink: string | null;
  vipLink: string;
  className?: string;
}

export const TicketCard = forwardRef<HTMLDivElement, TicketCardProps>(function TicketCard(
  {
    cardTitle,
    ticketLink,
    ticketButtonText,
    useDayPicker,
    onOpenDayPicker,
    pixWhatsAppLink,
    vipLink,
    className,
  },
  primaryCtaRef
) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ticketLink && (
          <div ref={primaryCtaRef}>
            <TicketCtaButton
              useDayPicker={useDayPicker}
              ticketLink={ticketLink}
              ticketButtonText={ticketButtonText}
              onOpenDayPicker={onOpenDayPicker}
            />
          </div>
        )}
        {pixWhatsAppLink && (
          <Button
            asChild
            className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white hover:opacity-90"
            size="lg"
          >
            <a href={pixWhatsAppLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Comprar Sem Taxa via Pix
            </a>
          </Button>
        )}
        {vipLink && (
          <Button variant="secondary" asChild className="w-full" size="lg">
            <a href={safeExternalUrl(vipLink)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Reservas de Camarote
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
