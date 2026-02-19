import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, MapPin, Clock, Search, Plus, Edit, Copy, Save, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { EventForm } from "@/components/events/EventForm";
import { EventModal } from "@/components/events/EventModal";
import EventsCarousel from "@/components/events/EventsCarousel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import djImage from "@/assets/dj-performance.jpg";
import { parseLocalDate } from "@/lib/utils";
import { useEvents } from "@/hooks/useEvents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Event } from "@/types";

const BRAZILIAN_STATES = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'PE', 'CE', 'PA', 'MA', 'PB', 'ES', 'PI', 'AL', 'RN', 'MT', 'MS', 'DF', 'SE', 'RO', 'TO', 'AC', 'AM', 'RR', 'AP'
];

const Eventos = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // React Query hook for events with caching
  const { events, isLoading: loading, refetch: refetchEvents } = useEvents();
  
  // Input states (raw user input)
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  
  // Debounced values for filtering (reduces re-renders during typing)
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const debouncedCityFilter = useDebouncedValue(cityFilter, 300);
  
  // Select states (no debounce needed - immediate selection)
  const [genreFilter, setGenreFilter] = useState('Todos');
  const [stateFilter, setStateFilter] = useState('Todos');
  const [dateFilter, setDateFilter] = useState<string>('');
  
  // UI states
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [calendarView, setCalendarView] = useState<'events-only' | 'monthly' | 'timeline'>('timeline');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Derived data using useMemo (consolidated from multiple useEffects)
  const availableStates = useMemo(() => 
    [...new Set(events.map((e) => e.location_state))].sort(),
    [events]
  );

  const availableGenres = useMemo(() => 
    [...new Set(events.flatMap((e) => e.genres || []))].sort(),
    [events]
  );

  // Cities filtered by state (cascading filter logic)
  const availableCities = useMemo(() => {
    if (stateFilter && stateFilter !== 'Todos') {
      return [...new Set(events.filter(e => e.location_state === stateFilter).map(e => e.location_city))].sort();
    }
    return [...new Set(events.map(e => e.location_city))].sort();
  }, [events, stateFilter]);

  // Filter events using useMemo with debounced values for text inputs
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Use debounced search term to reduce re-renders during typing
    if (debouncedSearchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        event.venue.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    // Filtro por data específica (do calendário)
    if (dateFilter) {
      filtered = filtered.filter(event => event.date === dateFilter);
    }

    if (genreFilter !== 'Todos') {
      filtered = filtered.filter(event => 
        event.genres && event.genres.includes(genreFilter)
      );
    }

    if (stateFilter !== 'Todos') {
      filtered = filtered.filter(event => event.location_state === stateFilter);
    }

    // Use debounced city filter for text input scenarios
    if (debouncedCityFilter && debouncedCityFilter !== 'Todos') {
      filtered = filtered.filter(event => event.location_city === debouncedCityFilter);
    }

    return filtered;
  }, [events, debouncedSearchTerm, dateFilter, genreFilter, stateFilter, debouncedCityFilter]);

  // Reset city filter when state changes and city is not in new state
  useEffect(() => {
    if (cityFilter && !availableCities.includes(cityFilter)) {
      setCityFilter('');
    }
  }, [availableCities, cityFilter]);

  // Note: refetchEvents comes from useEvents hook

  const handleEventClick = (event: Event) => {
    navigate(`/eventos/${event.slug}`);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
    setShowEventModal(false);
  };

  const handleDuplicateEvent = (event: Event) => {
    // Criar cópia do evento sem o ID para criar um novo
    const { id: _id, ...eventWithoutId } = event;
    const duplicatedEvent: Partial<Event> = {
      ...eventWithoutId,
      blog_post_id: null,
      title: `${event.title} (Cópia)`,
    };

    setEditingEvent(duplicatedEvent);
    setShowEventForm(true);
    setShowEventModal(false);
  };

  const handleFormSuccess = () => {
    setShowEventForm(false);
    setEditingEvent(null);
    refetchEvents();
  };

  const handleSaveAsTemplate = async (event: Event) => {
    try {
      const { error } = await supabase
        .from('event_templates')
        .insert({
          name: event.title,
          venue: event.venue,
          address: event.address,
          location_city: event.location_city,
          location_state: event.location_state,
          genres: event.genres,
          ticket_link: event.ticket_link,
          vip_link: event.vip_link,
          image_url: event.image_url,
        });

      if (error) throw error;
      toast.success('Evento salvo como template!');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Erro ao salvar template');
    }
  };

  const formatDate = (dateStr: string) => {
    return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  const getEventDates = () => {
    const eventDates: { date: string; count: number }[] = [];
    const dateCount: { [key: string]: number } = {};

    filteredEvents.forEach(event => {
      const date = event.date;
      dateCount[date] = (dateCount[date] || 0) + 1;
    });

    Object.entries(dateCount).forEach(([date, count]) => {
      eventDates.push({ date, count });
    });

    return eventDates.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return filteredEvents
      .filter(event => parseLocalDate(event.date) >= now)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  };

  // Note: Calendar date filtering now uses the filteredEvents useMemo
  // by updating the searchTerm or other filters as needed

  return (
    <>
      <SEOHead
        title="Eventos de Música Eletrônica em São Paulo - Festas Techno e House"
        description="Descubra os melhores eventos de música eletrônica em SP. Festas techno, house e underground 2025 com DJs internacionais. Ingressos e line-ups atualizados."
        keywords={[
          'eventos são paulo',
          'festas techno sp',
          'eventos eletrônicos 2025',
          'baladas são paulo',
          'festas underground sp',
          'eventos house music',
          'clubs são paulo',
          'ingressos festas sp'
        ]}
        url="https://mdaccula.com/eventos"
      />
      <StructuredData 
        type="breadcrumb" 
        data={{
          items: [
            { name: 'Home', url: 'https://mdaccula.com' },
            { name: 'Eventos', url: 'https://mdaccula.com/eventos' }
          ]
        }} 
      />
      
      <div className="min-h-screen">
        <Navigation />
        
        <main className="pt-16">
          {/* Breadcrumb */}
          <div className="container mx-auto px-4 pt-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Eventos</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        {/* Header */}
        <section className="py-20 bg-gradient-to-r from-primary/20 to-accent/20">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-5xl md:text-6xl font-bold mb-6 hero-text">
                  Eventos
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                  Descubra os melhores eventos de música eletrônica
                </p>
              </div>
              {isAdmin && (
                <Button onClick={() => setShowEventForm(true)} size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Novo Evento
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Mobile Events Carousel */}
        <section className="md:hidden py-6 bg-background">
          <div className="container mx-auto px-4">
            <h3 className="text-lg font-semibold mb-4">Próximos Eventos</h3>
            <EventsCarousel events={getUpcomingEvents().slice(0, 6)} />
          </div>
        </section>

        {/* Filters */}
        <section className="py-8 bg-card/50">
          <div className="container mx-auto px-4">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Filtros</h3>
            <div className="flex flex-col gap-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="search"
                  placeholder="Buscar eventos..." 
                  className="pl-10 h-12 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {dateFilter && (
                  <Badge 
                    variant="secondary" 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => setDateFilter('')}
                  >
                    <CalendarIcon className="w-3 h-3" />
                    {parseLocalDate(dateFilter).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    <X className="w-3 h-3" />
                  </Badge>
                )}
              </div>
              
              {/* Dropdown filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Vertente de som</Label>
                  <Select value={genreFilter} onValueChange={setGenreFilter}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Vertente de som" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {availableGenres.map((genre) => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                      <SelectItem value="Todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Estado</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Todos">Todos</SelectItem>
                    {availableStates.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Cidade</Label>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todas</SelectItem>
                      {availableCities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm">&nbsp;</Label>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setDateFilter('');
                      setGenreFilter('Todos');
                      setStateFilter('Todos');
                      setCityFilter('Todos');
                    }}
                    className="w-full h-12"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </div>
              
              {/* Genre buttons */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm">Filtrar por vertente</Label>
                <div className="flex items-center flex-wrap gap-2">
                  {availableGenres.map((genre) => (
                    <Badge 
                      key={genre}
                      variant={genreFilter === genre ? "default" : "outline"}
                      className="cursor-pointer min-h-[36px] px-4 text-sm"
                      onClick={() => setGenreFilter(genreFilter === genre ? 'Todos' : genre)}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calendar Section */}
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
                    {getEventDates().length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum evento encontrado
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {getEventDates().map((eventDate, index) => (
                          <div
                            key={index}
                            className="text-center p-2 sm:p-3 border rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors active:scale-95"
                            onClick={() => setDateFilter(eventDate.date)}
                          >
                            <div className="text-xs sm:text-sm font-medium text-primary">
                              {formatDate(eventDate.date)}
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
                        hasEvent: getEventDates().map(ed => parseLocalDate(ed.date))
                      }}
                      modifiersClassNames={{
                        hasEvent: "font-bold text-primary bg-primary/20 hover:bg-primary/30"
                      }}
                      onDayClick={(date) => {
                        const dateStr = date.toISOString().split('T')[0];
                        setDateFilter(dateStr);
                      }}
                    />
                  </div>
                )}

                {calendarView === 'timeline' && (
                  <div className="space-y-3 sm:space-y-4">
                    <h4 className="font-semibold text-base sm:text-lg">Próximos Eventos</h4>
                    {getUpcomingEvents().length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum evento próximo encontrado
                      </p>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {getUpcomingEvents().slice(0, 5).map((event) => (
                          <div
                            key={event.id}
                            className="flex items-start sm:items-center justify-between p-2 sm:p-3 border rounded hover:bg-muted/50 cursor-pointer transition-colors active:scale-[0.99] gap-2"
                            onClick={() => handleEventClick(event)}
                          >
                            <div className="flex items-start sm:items-center gap-2 sm:space-x-3 flex-1 min-w-0">
                              <div className="text-center min-w-[45px] sm:min-w-[60px] flex-shrink-0">
                                <div className="text-xs sm:text-sm font-bold text-primary">
                                  {parseLocalDate(event.date).getDate()}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  {parseLocalDate(event.date).toLocaleDateString('pt-BR', { month: 'short' })}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm sm:text-base truncate">{event.title}</div>
                                <div className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {event.venue} • {formatTime(event.time)}
                                </div>
                              </div>
                            </div>
                            <div className="hidden sm:flex flex-wrap gap-1 flex-shrink-0">
                              {event.genres && event.genres.length > 0 && event.genres.slice(0, 2).map((genre: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">{genre}</Badge>
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

        {/* Events List */}
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="text-center py-12">
                <p>Carregando eventos...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum evento encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredEvents.map((event, index) => (
                  <Card 
                    key={event.id} 
                    className="event-card group cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="relative overflow-hidden rounded-t-lg aspect-square bg-muted/20 flex items-center justify-center">
                      <img 
                        src={event.image_url || djImage} 
                        alt={event.title}
                        className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== djImage) {
                            target.src = djImage;
                          }
                        }}
                      />
                      <div className="absolute top-4 left-4 flex flex-wrap gap-1">
                        {event.genres && event.genres.length > 0 && event.genres.slice(0, 2).map((genre: string, idx: number) => (
                          <Badge key={idx} className="bg-primary/20 text-primary border-primary/30">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                      {isAdmin && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateEvent(event);
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveAsTemplate(event);
                            }}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
                        {event.title}
                      </CardTitle>
                      <div className="flex items-center text-base font-semibold text-white mt-2">
                        <CalendarIcon className="w-4 h-4 mr-2 text-primary" />
                        {formatDate(event.date)}
                      </div>
                      {event.subtitle && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {event.subtitle}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1 text-secondary" />
                          {formatTime(event.time)}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground truncate">
                          <MapPin className="w-3 h-3 mr-1 text-accent flex-shrink-0" />
                          <span className="truncate">{event.venue}, {event.location_city} - {event.location_state}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">Ver detalhes</span>
                        <Button size="sm" className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                          Ver
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Event Form Dialog */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <EventForm
            event={editingEvent}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowEventForm(false);
              setEditingEvent(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Event Details Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        onEdit={selectedEvent ? () => handleEditEvent(selectedEvent) : undefined}
      />

      <Footer />
      </div>
    </>
  );
};

export default Eventos;