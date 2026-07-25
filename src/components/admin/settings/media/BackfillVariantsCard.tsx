import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Loader2 } from 'lucide-react';
import type { BackfillResult } from '@/lib/eventImageBackfill';

interface Props {
  running: boolean;
  progress: { done: number; total: number } | null;
  results: BackfillResult[] | null;
  onRun: () => void;
}

export const BackfillVariantsCard = ({ running, progress, results, onRun }: Props) => {
  return (
    <Card className="border-blue-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          <CardTitle className="text-lg sm:text-xl">
            Backfill de Variantes — Eventos Ativos
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Gera as variantes thumb/medium para eventos com data futura e para as configurações de
          eventos recorrentes (a mesma imagem é reaproveitada em toda instância gerada). Eventos
          passados avulsos ficam de fora — tráfego neles é só de admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <Button onClick={onRun} disabled={running} variant="outline" className="w-full">
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando
              {progress ? ` (${progress.done}/${progress.total})` : '...'}
            </>
          ) : (
            <>
              <Layers className="w-4 h-4 mr-2" />
              Gerar Variantes para Eventos Ativos
            </>
          )}
        </Button>

        {results && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {results.filter((r) => r.status === 'uploaded').length}
                </div>
                <div className="text-muted-foreground">Processadas</div>
              </div>
              <div>
                <div className="text-lg font-bold text-muted-foreground">
                  {results.filter((r) => r.status === 'skipped').length}
                </div>
                <div className="text-muted-foreground">Já ok</div>
              </div>
              <div>
                <div className="text-lg font-bold text-destructive">
                  {results.filter((r) => r.status === 'error' || r.status === 'unsupported').length}
                </div>
                <div className="text-muted-foreground">Com problema</div>
              </div>
            </div>
            {results.some((r) => r.status === 'error' || r.status === 'unsupported') && (
              <details>
                <summary className="cursor-pointer text-destructive">Ver problemas</summary>
                <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-32 text-[10px]">
                  {results
                    .filter((r) => r.status === 'error' || r.status === 'unsupported')
                    .map((r) => `${r.url}: ${r.detail || r.status}`)
                    .join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
