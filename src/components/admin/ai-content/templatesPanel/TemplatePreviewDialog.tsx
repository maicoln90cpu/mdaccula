import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemPrompt: string;
  userPromptTemplate: string;
}

const SAMPLE_VALUES: Record<string, string> = {
  seriesName: 'DEDGE SP',
  venue: 'D-Edge São Paulo',
  city: 'São Paulo',
  state: 'SP',
  startDate: '24/01/2026',
  endDate: '26/01/2026',
  genres: 'Techno, House, Minimal',
  dates: '[Programação detalhada seria inserida aqui]',
  additionalContext: 'Evento especial comemorativo.',
  eventName: 'Nome do Evento Exemplo',
  artistName: 'Artista Exemplo',
  festivalName: 'Festival Exemplo',
  topic: 'Tópico do Artigo',
  summary: 'Resumo breve do artigo',
  category: 'Eventos',
};

function renderPreview(template: string): string {
  let prompt = template || '(vazio)';
  Object.entries(SAMPLE_VALUES).forEach(([key, value]) => {
    prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), `【${value}】`);
  });
  return prompt;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  systemPrompt,
  userPromptTemplate,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview do Prompt com Dados de Exemplo
          </DialogTitle>
          <DialogDescription>
            Visualize como o prompt ficará com valores de exemplo
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-1">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                Valores de exemplo utilizados:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>seriesName:</strong> DEDGE SP</div>
                <div><strong>venue:</strong> D-Edge São Paulo</div>
                <div><strong>city:</strong> São Paulo</div>
                <div><strong>state:</strong> SP</div>
                <div><strong>startDate:</strong> 24/01/2026</div>
                <div><strong>endDate:</strong> 26/01/2026</div>
                <div><strong>genres:</strong> Techno, House</div>
                <div><strong>eventName:</strong> Nome do Evento</div>
                <div><strong>artistName:</strong> Artista Exemplo</div>
                <div><strong>topic:</strong> Tópico do Artigo</div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">System Prompt:</p>
              <pre className="p-4 rounded-lg bg-background border text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {systemPrompt || '(vazio)'}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">
                User Prompt (com variáveis substituídas):
              </p>
              <pre className="p-4 rounded-lg bg-background border text-xs font-mono whitespace-pre-wrap">
                {renderPreview(userPromptTemplate)}
              </pre>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground">
                <strong>Legenda:</strong> Valores entre 【colchetes】 são os dados de exemplo
                substituídos. Variáveis não substituídas permanecem como {'{{variavel}}'}.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
