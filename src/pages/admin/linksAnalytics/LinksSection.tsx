import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  MousePointerClick,
} from 'lucide-react';
import type { LinkAnalytics, GroupAnalytics } from './types';

interface Props {
  links: LinkAnalytics[];
  groups: GroupAnalytics[];
  totalClicks: number;
}

export const LinksSection = ({ links, groups, totalClicks }: Props) => {
  const [linksOpen, setLinksOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [linkPerformanceOpen, setLinkPerformanceOpen] = useState(false);

  return (
    <Collapsible open={linksOpen} onOpenChange={setLinksOpen} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                <CardTitle>Analytics de Links</CardTitle>
              </div>
              {linksOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Clique para {linksOpen ? 'colapsar' : 'expandir'} os dados de links
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance por Grupo
                  </h3>
                  {groupsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 mt-4">
                  {groups.map((group) => (
                    <div key={group.group_name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{group.group_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {group.link_count} {group.link_count === 1 ? 'link' : 'links'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{group.total_clicks}</p>
                          <p className="text-xs text-muted-foreground">cliques</p>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{
                            width: `${totalClicks > 0 ? (group.total_clicks / totalClicks) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={linkPerformanceOpen} onOpenChange={setLinkPerformanceOpen}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MousePointerClick className="h-5 w-5" />
                    Performance por Link
                  </h3>
                  {linkPerformanceOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-4">
                  {links.slice(0, 10).map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{link.title}</p>
                          {link.is_internal ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded shrink-0">
                              Interno
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded shrink-0">
                              Externo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{link.group_name}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-xl font-bold">{link.clicks}</p>
                        <p className="text-xs text-muted-foreground">
                          {totalClicks > 0
                            ? `${((link.clicks / totalClicks) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {links.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum link encontrado
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
