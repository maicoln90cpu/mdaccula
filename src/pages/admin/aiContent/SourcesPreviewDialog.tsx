import { Search, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SourcesPreviewState } from './types';

interface Props {
  state: SourcesPreviewState | null;
  onClose: () => void;
}

/**
 * Modal que mostra o resultado da pré-visualização de fontes (Firecrawl) para
 * uma sugestão de artigo. Extraído de AIContent2.tsx (Onda Bônus PR-A).
 */
export function SourcesPreviewDialog({ state, onClose }: Props) {
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Fontes encontradas
          </DialogTitle>
          <DialogDescription>
            Resultado de uma busca aberta na web (Firecrawl) para "{state?.query}", feita agora.
            Não é o catálogo de Fontes cadastradas em Fontes / Event Watcher — o artigo final
            usará o que estiver disponível no momento em que for gerado, que pode variar em
            relação a esta prévia.
          </DialogDescription>
        </DialogHeader>
        {state?.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : state?.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : !state?.sources?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma fonte encontrada para este termo.</p>
        ) : (
          <ul className="space-y-3">
            {state.sources.map((source, i) => (
              <li key={i} className="space-y-0.5">
                <p className="font-medium text-sm">{source.title}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {source.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
