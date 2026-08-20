/**
 * Seção Calendário do /eventos — extraído de src/pages/Eventos.tsx (Onda 17).
 */
import { Calendar as CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/lib/utils';
import type { Event } from '@/types';
import { formatEventDayShort, formatEventTime } from './eventosHelpers';

export type CalendarView = 'events-only' | 'monthly' | 'timeline';

interface CalendarSectionProps {
  calendarView: CalendarView;
  setCalendarView: (v: CalendarView) => void;
  selectedDate: Date | undefined;
  setSelectedDate: (d: Date | undefined) => void;
  eventDates: { date: string; count: number }[];
  upcomingEvents: Event[];
  setDateFilter: (v: string) => void;
  setWeekendDates: (v: string[]) => void;
  onEventClick: (event: Event) => void;
}

export const CalendarSection = ({
  calendarView,
  setCalendarView,
  selectedDate,
  setSelectedDate,
  eventDates,
  upcomingEvents,
  setDateFilter,
  setWeekendDates,
  onEventClick,
}: CalendarSectionProps) => {
  return (
    <section className="py-8 bg-background">
      <div className="container mx-auto px-4">
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                <span className="text-base sm:text-lg">Calendário de Eventos</span>
              </div>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant={calendarView === 'events-only' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('events-only')}
                  className="text-[10px] sm:text-xs min-h-[32px] sm:min-h-[36px] px-2 sm:px-3 flex-1 sm:flex-none"
                >
                  Datas
                </Button>
                <Button
                  variant={calendarView === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('monthly')}
                  className="text-[10px] sm:text-xs min-h-[32px] sm:min-h-[36px] px-2 sm:px-3 flex-1 sm:flex-none"
                >
                  Mensal
                </Button>
                <Button
                  variant={calendarView === 'timeline' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalendarView('timeline')}
                  className="text-[10px] sm:text-xs min-h-[32px] sm:min-h-[36px] px-2 sm:px-3 flex-1 sm:flex-none"
                >
                  Timeline
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calendarView === 'events-only' && (
              <div className="space-y-2">
                {eventDates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento encontrado
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {eventDates.map((eventDate, index) => (
                      <div
                        key={index}
                        className="text-center p-2 sm:p-3 border rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors active:scale-95"
                        onClick={() => {
                          setDateFilter(eventDate.date);
                          setWeekendDates([]);
                        }}
                      >
                        <div className="text-xs sm:text-sm font-medium text-primary">
                          {formatEventDayShort(eventDate.date)}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                          {eventDate.count} evento{eventDate.count > 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {calendarView === 'monthly' && (
              <div className="flex justify-center overflow-x-auto">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border pointer-events-auto mx-auto"
                  modifiers={{
                    hasEvent: eventDates.map((ed) => parseLocalDate(ed.date)),
                  }}
                  modifiersClassNames={{
                    hasEvent: 'font-bold text-primary bg-primary/20 hover:bg-primary/30',
                  }}
                  onDayClick={(date) => {
                    const dateStr = date.toISOString().split('T')[0];
                    setDateFilter(dateStr);
                    setWeekendDates([]);
                  }}
                />
              </div>
            )}

            {calendarView === 'timeline' && (
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-base sm:text-lg">Próximos Eventos</h4>
                {upcomingEvents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento próximo encontrado
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {upcomingEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start sm:items-center justify-between p-2 sm:p-3 border rounded hover:bg-muted/50 cursor-pointer transition-colors active:scale-[0.99] gap-2"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start sm:items-center gap-2 sm:space-x-3 flex-1 min-w-0">
                          <div className="text-center min-w-[45px] sm:min-w-[60px] shrink-0">
                            <div className="text-xs sm:text-sm font-bold text-primary">
                              {parseLocalDate(event.date).getDate()}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {parseLocalDate(event.date).toLocaleDateString('pt-BR', {
                                month: 'short',
                              })}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm sm:text-base truncate">
                              {event.title}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">
                              {event.venue} • {formatEventTime(event.time)}
                            </div>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-wrap gap-1 shrink-0">
                          {event.genres &&
                            event.genres.length > 0 &&
                            event.genres.slice(0, 2).map((genre: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {genre}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
