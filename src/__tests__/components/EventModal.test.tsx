import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventModal } from '@/components/events/EventModal';
import { AuthProvider } from '@/hooks/useAuth';

// Create a wrapper with all providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const mockEvent = {
  id: '1',
  title: 'Test Event',
  slug: 'test-event',
  subtitle: 'A test subtitle',
  date: '2026-01-15',
  time: '22:00',
  end_time: '06:00',
  venue: 'Test Venue',
  address: 'Test Address, 123',
  location_city: 'São Paulo',
  location_state: 'SP',
  genres: ['Techno', 'House'],
  lineup: ['DJ Test 1', 'DJ Test 2'],
  description: 'This is a test event description.',
  image_url: 'https://example.com/image.jpg',
  ticket_link: 'https://tickets.example.com',
  vip_link: 'https://vip.example.com',
  views: 100,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: null,
  blog_post_id: null,
};

describe('EventModal', () => {
  it('should not render when isOpen is false', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={false} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.queryByText('Test Event')).not.toBeInTheDocument();
  });

  it('should render event title when open', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });

  it('should render event subtitle', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('A test subtitle')).toBeInTheDocument();
  });

  it('should render venue information', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText(/Test Venue/)).toBeInTheDocument();
  });

  it('should render genres as badges', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('Techno')).toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();
  });

  it('should render lineup', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('DJ Test 1')).toBeInTheDocument();
    expect(screen.getByText('DJ Test 2')).toBeInTheDocument();
  });

  it('should render ticket link button when available', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    const ticketButton = screen.getByText(/Comprar Ingresso/i);
    expect(ticketButton).toBeInTheDocument();
  });

  it('should not render ticket link when not available', () => {
    const Wrapper = createWrapper();
    const eventWithoutTicket = { ...mockEvent, ticket_link: null };

    render(
      <Wrapper>
        <EventModal event={eventWithoutTicket} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.queryByText(/Comprar Ingresso/i)).not.toBeInTheDocument();
  });

  it('should render share buttons', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    // ShareButtons component should be rendered
    expect(screen.getByText(/Compartilhar/i)).toBeInTheDocument();
  });

  it('should render formatted date and time', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    // Should show formatted date (15 de janeiro de 2026 or similar)
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/22:00/)).toBeInTheDocument();
  });

  it('should render location', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText(/São Paulo/)).toBeInTheDocument();
  });

  it('should render event description', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('This is a test event description.')).toBeInTheDocument();
  });

  it('should render VIP link when available', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <EventModal event={mockEvent} isOpen={true} onClose={vi.fn()} />
      </Wrapper>
    );

    // Check for VIP section or button
    const vipElements = screen.queryAllByText(/VIP/i);
    expect(vipElements.length).toBeGreaterThan(0);
  });
});
