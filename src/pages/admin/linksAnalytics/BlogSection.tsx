import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, ChevronDown, ChevronRight, Eye, Heart } from 'lucide-react';
import type { BlogAnalytics } from './types';

interface Props {
  blogPosts: BlogAnalytics[];
}

export const BlogSection = ({ blogPosts }: Props) => {
  const [blogOpen, setBlogOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);

  return (
    <Collapsible open={blogOpen} onOpenChange={setBlogOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <CardTitle>Analytics do Blog</CardTitle>
              </div>
              {blogOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Clique para {blogOpen ? 'colapsar' : 'expandir'} os dados do blog
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <Collapsible open={viewsOpen} onOpenChange={setViewsOpen}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Posts Mais Vistos
                  </h3>
                  {viewsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-4">
                  {blogPosts.slice(0, 10).map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{post.title}</p>
                          <p className="text-sm text-muted-foreground">{post.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold">{post.views}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Heart className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold">{post.likes}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {blogPosts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum post publicado
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={likesOpen} onOpenChange={setLikesOpen}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Posts Mais Curtidos
                  </h3>
                  {likesOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-4">
                  {[...blogPosts]
                    .sort((a, b) => b.likes - a.likes)
                    .slice(0, 10)
                    .map((post, index) => (
                      <div
                        key={post.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            #{index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{post.title}</p>
                            <p className="text-sm text-muted-foreground">{post.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Heart className="h-4 w-4 text-red-500" />
                              <span className="font-bold">{post.likes}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <span className="font-bold">{post.views}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
