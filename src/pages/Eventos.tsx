import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { SEOHead } from '@/components/SEOHead';
import { StructuredData } from '@/components/StructuredData';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuthContext';
import { EventForm } from '@/components/events/EventForm';
import { EventModal } from '@/components/events/EventModal';
import EventsCarousel from '@/components/events/EventsCarousel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEvents } from '@/hooks/useEvents';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Event } from '@/types';
import {
  computeEventDateCounts,
  eventOccursOnDate,
  filterUpcomingEvents,
} from '@/components/eventos/eventosHelpers';
import { FiltersSection } from '@/components/eventos/FiltersSection';
import { CalendarSection, type CalendarView } from '@/components/eventos/CalendarSection';
import { EventListCard } from '@/components/eventos/EventListCard';

const Eventos = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const { events, isLoading: loading, refetch: refetchEvents } = useEvents();

  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const debouncedCityFilter = useDebouncedValue(cityFilter, 300);

  const [genreFilter, setGenreFilter] = useState('Todos');
  const [stateFilter, setStateFilter] = useState('Todos');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [weekendDates, setWeekendDates] = useState<string[]>([]);

  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('timeline');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const availableStates = useMemo(
    () => [...new Set(events.map((e) => e.location_state))].sort(),
    [events]
  );

  const availableGenres = useMemo(
    () => [...new Set(events.flatMap((e) => e.genres || []))].sort(),
    [events]
  );

  const availableCities = useMemo(() => {
    if (stateFilter && stateFilter !== 'Todos') {
      return [
        ...new Set(
          events.filter((e) => e.location_state === stateFilter).map((e) => e.location_city)
        ),
      ].sort();
    }
    return [...new Set(events.map((e) => e.location_city))].sort();
  }, [events, stateFilter]);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (debouncedSearchTerm) {
      filtered = filtered.filter(
        (event) =>
          (event.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ?? false) ||
          (event.venue?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ?? false)
      );
    }

    if (dateFilter) {
      filtered = filtered.filter((event) => eventOccursOnDate(event, dateFilter));
    }

    if (weekendDates.length > 0) {
      filtered = filtered.filter((event) =>
        weekendDates.some((weekendDate) => eventOccursOnDate(event, weekendDate))
      );
    }

    if (genreFilter !== 'Todos') {
      filtered = filtered.filter((event) => event.genres && event.genres.includes(genreFilter));
    }

    if (stateFilter !== 'Todos') {
      filtered = filtered.filter((event) => event.location_state === stateFilter);
    }

    if (debouncedCityFilter && debouncedCityFilter !== 'Todos') {
      filtered = filtered.filter((event) => event.location_city === debouncedCityFilter);
    }

    return filtered;
  }, [
    events,
    debouncedSearchTerm,
    dateFilter,
    weekendDates,
    genreFilter,
    stateFilter,
    debouncedCityFilter,
  ]);

  useEffect(() => {
    if (cityFilter && !availableCities.includes(cityFilter)) {
      setCityFilter('');
    }
  }, [availableCities, cityFilter]);

  const eventDates = useMemo(() => computeEventDateCounts(filteredEvents), [filteredEvents]);
  const upcomingEvents = useMemo(() => filterUpcomingEvents(filteredEvents), [filteredEvents]);

  const handleEventClick = (event: Event) => {
    navigate(`/eventos/${event.slug}`);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
    setShowEventModal(false);
  };

  const handleDuplicateEvent = (event: Event) => {
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
      const { error } = await supabase.from('event_templates').insert({
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

  return (
    <>
      <SEOHead
        title="Eventos de Música Eletrônica em São Paulo"
        description="Descubra os melhores eventos de música eletrônica em SP. Festas techno, house e underground 2025 com DJs internacionais. Ingressos e line-ups atualizados."
        keywords={[
          'eventos são paulo',
          'festas techno sp',
          'eventos eletrônicos 2025',
          'baladas são paulo',
          'festas underground sp',
          'eventos house music',
          'clubs são paulo',
          'ingressos festas sp',
        ]}
        url="https://mdaccula.com/eventos"
      />
      <StructuredData
        type="breadcrumb"
        data={{
          items: [
            { name: 'Home', url: 'https://mdaccula.com' },
            { name: 'Eventos', url: 'https://mdaccula.com/eventos' },
          ],
        }}
      />

      <div className="min-h-screen">
        <Navigation />

        <main id="main-content" className="pt-16">
          <PageHeader
            title="Eventos"
            subtitle="Descubra os melhores eventos de música eletrônica"
            breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Eventos' }]}
            actions={
              isAdmin && (
                <Button onClick={() => setShowEventForm(true)} size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Novo Evento
                </Button>
              )
            }
          />

          {/* Mobile Events Carousel */}
          <section className="md:hidden py-6 bg-background">
            <div className="container mx-auto px-4">
              <h3 className="text-lg font-semibold mb-4">Próximos Eventos</h3>
              <EventsCarousel events={upcomingEvents.slice(0, 6)} />
            </div>
          </section>

          <FiltersSection
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            weekendDates={weekendDates}
            setWeekendDates={setWeekendDates}
            genreFilter={genreFilter}
            setGenreFilter={setGenreFilter}
            stateFilter={stateFilter}
            setStateFilter={setStateFilter}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            availableGenres={availableGenres}
            availableStates={availableStates}
            availableCities={availableCities}
          />

          <CalendarSection
            calendarView={calendarView}
            setCalendarView={setCalendarView}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            eventDates={eventDates}
            upcomingEvents={upcomingEvents}
            setDateFilter={setDateFilter}
            setWeekendDates={setWeekendDates}
            onEventClick={handleEventClick}
          />

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
                    <EventListCard
                      key={event.id}
                      event={event}
                      index={index}
                      isAdmin={isAdmin}
                      onClick={handleEventClick}
                      onEdit={handleEditEvent}
                      onDuplicate={handleDuplicateEvent}
                      onSaveAsTemplate={handleSaveAsTemplate}
                    />
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
