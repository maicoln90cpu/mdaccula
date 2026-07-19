/**
 * Diálogo com a lista canônica de placeholders aceitos pelo editor de e-mails.
 *
 * Motivo: antes o rodapé abaixo do campo Assunto só listava 4 placeholders,
 * escondendo weekend_range/week_range/time_label e as variações com ponto.
 * Agora o usuário abre uma referência única com botão copiar.
 */
import { useState } from 'react';
import { Copy, HelpCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { KNOWN_PLACEHOLDERS } from './inboxPreviewPlaceholders';

export function PlaceholdersHelpDialog() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignora falha silenciosamente (navegador antigo)
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 gap-1 text-[11px]">
          <HelpCircle className="w-3 h-3" />
          Ver placeholders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Placeholders disponíveis</DialogTitle>
          <DialogDescription>
            Cole no Assunto ou Preheader. Aceitamos as duas notações — com ponto (
            <code className="text-xs">{'{{event.title}}'}</code>) e com underline (
            <code className="text-xs">{'{{event_title}}'}</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {KNOWN_PLACEHOLDERS.map((p) => {
            const primary = `{{${p.key}}}`;
            const isCopied = copied === primary;
            return (
              <div
                key={p.key}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border">
                      {primary}
                    </code>
                    {p.aliases.map((a) => (
                      <code
                        key={a}
                        className="text-[10px] font-mono text-muted-foreground bg-background/60 px-1 py-0.5 rounded border"
                      >
                        {`{{${a}}}`}
                      </code>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                    Usado em: {p.scope}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isCopied ? 'default' : 'outline'}
                  className="h-7 px-2 gap-1 shrink-0"
                  onClick={() => copy(primary)}
                >
                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {isCopied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
