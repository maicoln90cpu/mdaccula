import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Share2, ChevronDown, ChevronRight } from 'lucide-react';
import type { RedirectAnalytics } from './types';

interface Props {
  redirects: RedirectAnalytics[];
  totalRedirectClicks: number;
}

export const RedirectsSection = ({ redirects, totalRedirectClicks }: Props) => {
  const [redirectsOpen, setRedirectsOpen] = useState(false);
  return (
    <Collapsible open={redirectsOpen} onOpenChange={setRedirectsOpen} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                <CardTitle>Analytics de Redirect Links</CardTitle>
              </div>
              {redirectsOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              {redirects.length} links curtos • {totalRedirectClicks} cliques totais
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-3">
              {redirects.map((redirect, index) => (
                <div
                  key={redirect.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">/r/{redirect.slug}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {redirect.description || redirect.destination_url}
                      </p>
                    </div>
                    {!redirect.enabled && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded flex-shrink-0">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xl font-bold">{redirect.clicks}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalRedirectClicks > 0
                        ? `${((redirect.clicks / totalRedirectClicks) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              ))}
              {redirects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum redirect link encontrado
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
