import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { StatusFilter, ArticleFilter } from './types';

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  articleFilter: ArticleFilter;
  onArticleChange: (value: ArticleFilter) => void;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  showMerged: boolean;
  onShowMergedChange: (value: boolean) => void;
}

export function EventsFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  articleFilter,
  onArticleChange,
  totalCount,
  activeCount,
  inactiveCount,
  showMerged,
  onShowMergedChange,
}: Props) {
  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar evento por nome ou local..."
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={statusFilter === 'todos' ? 'default' : 'outline'}
          onClick={() => onStatusChange('todos')}
          size="sm"
        >
          Todos ({totalCount})
        </Button>
        <Button
          variant={statusFilter === 'ativos' ? 'default' : 'outline'}
          onClick={() => onStatusChange('ativos')}
          size="sm"
        >
          Ativos ({activeCount})
        </Button>
        <Button
          variant={statusFilter === 'inativos' ? 'default' : 'outline'}
          onClick={() => onStatusChange('inativos')}
          size="sm"
        >
          Inativos ({inactiveCount})
        </Button>
        <span className="text-muted-foreground mx-1">|</span>
        <Button
          variant={articleFilter === 'todos' ? 'default' : 'outline'}
          onClick={() => onArticleChange('todos')}
          size="sm"
        >
          Artigo: Todos
        </Button>
        <Button
          variant={articleFilter === 'sem-artigo' ? 'default' : 'outline'}
          onClick={() => onArticleChange('sem-artigo')}
          size="sm"
        >
          Sem Artigo
        </Button>
        <Button
          variant={articleFilter === 'com-artigo' ? 'default' : 'outline'}
          onClick={() => onArticleChange('com-artigo')}
          size="sm"
        >
          Com Artigo
        </Button>
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm text-muted-foreground cursor-pointer select-none">
        <Checkbox
          checked={showMerged}
          onCheckedChange={(v) => onShowMergedChange(Boolean(v))}
        />
        Mostrar mesclados (inativos)
        <span className="text-xs text-muted-foreground/70">
          — eventos absorvidos em outro principal aparecem com a opção de Reativar
        </span>
      </label>
    </>
  );
}
