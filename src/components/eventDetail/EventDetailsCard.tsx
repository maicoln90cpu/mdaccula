import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEventDateRange } from '@/lib/dateUtils';

function formatTime(timeStr?: string | null) {
  if (!timeStr) return 'Horário a confirmar';
  return timeStr.slice(0, 5);
}

interface Props {
  date: string;
  endDate?: string | null;
  time: string;
  endTime?: string;
  venue: string;
  city: string;
  state: string;
}

export function EventDetailsCard({ date, endDate, time, endTime, venue, city, state }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes do Evento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
          <div>
            <p className="font-medium">Data</p>
            <p className="text-muted-foreground capitalize">
              {formatEventDateRange(date, endDate)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
          <div>
            <p className="font-medium">Horário</p>
            <p className="text-muted-foreground">
              {formatTime(time)}
              {endTime && ` - ${formatTime(endTime)}`}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
          <div>
            <p className="font-medium">Local</p>
            <p className="text-muted-foreground">
              {venue}
              <br />
              {city} - {state}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
