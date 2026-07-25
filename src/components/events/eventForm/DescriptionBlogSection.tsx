import { useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, X } from 'lucide-react';
import type { EventFormData } from './constants';

interface BlogPostOption {
  id: string;
  title: string;
  category: string;
}

interface DescriptionBlogSectionProps {
  aiContext: string;
  setAiContext: (v: string) => void;
  blogSearchTerm: string;
  setBlogSearchTerm: (v: string) => void;
  blogSearchResults: BlogPostOption[];
  setBlogSearchResults: (v: BlogPostOption[]) => void;
  selectedBlogPost: BlogPostOption | null;
  setSelectedBlogPost: (v: BlogPostOption | null) => void;
  showBlogDropdown: boolean;
  setShowBlogDropdown: (v: boolean) => void;
  blogPosts: BlogPostOption[];
}

export const DescriptionBlogSection = ({
  aiContext,
  setAiContext,
  blogSearchTerm,
  setBlogSearchTerm,
  blogSearchResults,
  setBlogSearchResults,
  selectedBlogPost,
  setSelectedBlogPost,
  showBlogDropdown,
  setShowBlogDropdown,
  blogPosts,
}: DescriptionBlogSectionProps) => {
  const { register, control, watch } = useFormContext<EventFormData>();
  const descLen = watch('description')?.trim().length ?? 0;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descrição do evento..."
          rows={4}
        />
        {descLen > 0 && descLen < 80 && (
          <p className="text-xs text-amber-500">
            Descrição curta — eventos com um texto único e mais detalhado (line-up, o que esperar da
            noite, diferenciais do local) tendem a se sair melhor no Google. Não é obrigatório, só
            uma sugestão.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="blog_post_id">Post do Blog Relacionado (Opcional)</Label>
        <Controller
          name="blog_post_id"
          control={control}
          render={({ field }) => (
            <div className="relative">
              {selectedBlogPost ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <span className="text-sm flex-1 truncate">
                    [{selectedBlogPost.category}] {selectedBlogPost.title}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setSelectedBlogPost(null);
                      field.onChange('none');
                      setBlogSearchTerm('');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar artigo por título..."
                    className="pl-9"
                    value={blogSearchTerm}
                    onChange={(e) => {
                      setBlogSearchTerm(e.target.value);
                      setShowBlogDropdown(true);
                    }}
                    onFocus={() => {
                      setShowBlogDropdown(true);
                      if (!blogSearchTerm) setBlogSearchResults(blogPosts.slice(0, 10));
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowBlogDropdown(false), 200);
                    }}
                  />
                </div>
              )}
              {showBlogDropdown && !selectedBlogPost && blogSearchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-background border rounded-md shadow-lg">
                  {blogSearchResults.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 truncate"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedBlogPost(post);
                        field.onChange(post.id);
                        setShowBlogDropdown(false);
                        setBlogSearchTerm('');
                      }}
                    >
                      <span className="text-muted-foreground">[{post.category}]</span> {post.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Vincule este evento a um post do blog para exibir informações adicionais.
        </p>
      </div>

      <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
        <Label htmlFor="aiContextAlways">Contexto para IA (opcional)</Label>
        <Textarea
          id="aiContextAlways"
          value={aiContext}
          onChange={(e) => setAiContext(e.target.value)}
          placeholder="Ex: Ingresso cortesia pelo link, 5% de desconto com cupom MDACCULA, open bar até 01h, evento beneficente..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Salvo no evento e respeitado em toda geração/regeneração de artigo. Tem prioridade máxima
          sobre o template.
        </p>
      </div>
    </>
  );
};

export type { BlogPostOption };
