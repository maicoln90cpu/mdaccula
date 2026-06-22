import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, ExternalLink, Edit } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { parseLocalDate } from '@/lib/utils';
import { formatEventDateRange } from '@/lib/dateUtils';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { safeExternalUrl } from '@/lib/safeExternalUrl';

interface EventModalProps {
  event: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export const EventModal = ({ event, isOpen, onClose, onEdit }: EventModalProps) => {
  const { isAdmin } = useAuth();

  if (!event) return null;

  const formatDate = (dateStr: string) => {
    return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return 'Horário a confirmar';
    return timeStr.slice(0, 5);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl break-words pr-8 sm:pr-0">{event.title}</DialogTitle>
              {event.subtitle && (
                <p className="text-sm sm:text-base text-muted-foreground italic mt-1 break-words">
                  {event.subtitle}
                </p>
              )}
            </div>
            {isAdmin && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px] w-full sm:w-auto">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {event.image_url && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted/20">
              <img 
                src={getOptimizedImageUrl(event.image_url)} 
                alt={event.title}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  target.parentElement!.classList.add('flex', 'items-center', 'justify-center', 'bg-gradient-to-br', 'from-primary/20', 'via-muted/30', 'to-accent/20');
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                {formatEventDateRange(event.date, event.end_date)}
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-secondary" />
                {formatTime(event.time)}
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="w-4 h-4 mr-2 text-accent" />
                {event.venue}, {event.location_city} - {event.location_state}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium">Vertentes:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {event.genres && event.genres.length > 0 ? (
                    event.genres.map((genre: string, index: number) => (
                      <Badge key={index} className="bg-primary/20 text-primary border-primary/30">
                        {genre}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Não especificado</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {event.lineup && event.lineup.length > 0 && (() => {
            const cleanLineup = normalizeLineup(event.lineup);
            return (
              <div>
                <h3 className="text-lg font-semibold mb-3">Line-up</h3>
                <div className="flex flex-wrap gap-2">
                  {cleanLineup.map((artist: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-sm px-3 py-1 leading-relaxed whitespace-normal break-words max-w-full">
                      {artist}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })()}

          {event.description && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Descrição</h3>
              <p className="text-muted-foreground leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            {event.ticket_link && (
              <Button asChild className="flex-1 min-h-[48px] text-base">
                <a href={safeExternalUrl(event.ticket_link)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Comprar Ingresso
                </a>
              </Button>
            )}
            {event.vip_link && (
              <Button variant="secondary" asChild className="flex-1 min-h-[48px] text-base">
                <a href={safeExternalUrl(event.vip_link)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Camarote
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};