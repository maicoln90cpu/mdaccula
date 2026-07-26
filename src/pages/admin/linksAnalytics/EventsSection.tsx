import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import type { EventAnalytics } from './types';

interface Props {
  events: EventAnalytics[];
  totalEventViews: number;
}

export const EventsSection = ({ events, totalEventViews }: Props) => {
  const [eventsOpen, setEventsOpen] = useState(false);
  return (
    <Collapsible open={eventsOpen} onOpenChange={setEventsOpen} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle>Analytics de Eventos</CardTitle>
              </div>
              {eventsOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              {events.length} eventos • {totalEventViews} views totais
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-3">
              {events.slice(0, 20).map((event, index) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/eventos/${event.slug}`}
                        className="font-medium hover:text-primary truncate block"
                        target="_blank"
                      >
                        {event.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {event.venue} •{' '}
                        {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xl font-bold">{event.views}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalEventViews > 0
                        ? `${((event.views / totalEventViews) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum evento encontrado
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
