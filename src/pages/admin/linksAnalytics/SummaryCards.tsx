import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MousePointerClick,
  Link as LinkIcon,
  Calendar,
  Eye,
  Heart,
  FileText,
  Share2,
} from 'lucide-react';
import type { TimePeriod } from './types';

interface Props {
  timePeriod: TimePeriod;
  totalClicks: number;
  linksCount: number;
  totalEventViews: number;
  totalViews: number;
  totalLikes: number;
  blogCount: number;
  totalRedirectClicks: number;
  redirectsCount: number;
}

export const SummaryCards = ({
  timePeriod,
  totalClicks,
  linksCount,
  totalEventViews,
  totalViews,
  totalLikes,
  blogCount,
  totalRedirectClicks,
  redirectsCount,
}: Props) => {
  const showPeriodHint = timePeriod !== 'all';
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cliques em Links</CardTitle>
          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalClicks}</div>
          {showPeriodHint && <p className="text-xs text-muted-foreground">no período</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Links</CardTitle>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{linksCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Views em Eventos</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEventViews}</div>
          {showPeriodHint && <p className="text-xs text-muted-foreground">no período</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Views do Blog</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalViews}</div>
          {showPeriodHint && <p className="text-xs text-muted-foreground">no período</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Likes do Blog</CardTitle>
          <Heart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalLikes}</div>
          {showPeriodHint && <p className="text-xs text-muted-foreground">no período</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Posts Publicados</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{blogCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Redirects</CardTitle>
          <Share2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRedirectClicks}</div>
          <p className="text-xs text-muted-foreground">
            {redirectsCount} links{showPeriodHint ? ' • filtrado por período' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
