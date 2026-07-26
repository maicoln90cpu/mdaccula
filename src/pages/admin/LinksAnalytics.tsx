import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLinksAnalytics } from './linksAnalytics/useLinksAnalytics';
import { SummaryCards } from './linksAnalytics/SummaryCards';
import { LinksSection } from './linksAnalytics/LinksSection';
import { EventsSection } from './linksAnalytics/EventsSection';
import { RedirectsSection } from './linksAnalytics/RedirectsSection';
import { BlogSection } from './linksAnalytics/BlogSection';
import type { TimePeriod } from './linksAnalytics/types';

const LinksAnalytics = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const {
    links,
    groups,
    blogPosts,
    events,
    redirects,
    loading,
    totalClicks,
    totalViews,
    totalLikes,
    totalEventViews,
    totalRedirectClicks,
  } = useLinksAnalytics(timePeriod);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Performance de links e blog posts</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(
            [
              { value: 'today', label: 'Hoje' },
              { value: '7d', label: '7 dias' },
              { value: '30d', label: '30 dias' },
              { value: 'all', label: 'Todo período' },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              variant={timePeriod === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          {timePeriod !== 'all' && (
            <span className="text-xs text-muted-foreground self-center ml-2">
              ℹ️ Dados filtrados por período usando tabelas de tracking. Dados anteriores à
              ativação do tracking não aparecem.
            </span>
          )}
        </div>

        <SummaryCards
          timePeriod={timePeriod}
          totalClicks={totalClicks}
          linksCount={links.length}
          totalEventViews={totalEventViews}
          totalViews={totalViews}
          totalLikes={totalLikes}
          blogCount={blogPosts.length}
          totalRedirectClicks={totalRedirectClicks}
          redirectsCount={redirects.length}
        />

        <LinksSection links={links} groups={groups} totalClicks={totalClicks} />
        <EventsSection events={events} totalEventViews={totalEventViews} />
        <RedirectsSection redirects={redirects} totalRedirectClicks={totalRedirectClicks} />
        <BlogSection blogPosts={blogPosts} />
      </main>
    </div>
  );
};

export default LinksAnalytics;
