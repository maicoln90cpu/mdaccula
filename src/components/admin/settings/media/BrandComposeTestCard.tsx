import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Stamp } from 'lucide-react';

interface Props {
  brandImageUrl: string;
  brandTitle: string;
  brandTesting: boolean;
  brandResult: { imageUrl: string; composed: boolean } | null;
  onBrandImageUrlChange: (v: string) => void;
  onBrandTitleChange: (v: string) => void;
  onTest: () => void;
}

export const BrandComposeTestCard = ({
  brandImageUrl,
  brandTitle,
  brandTesting,
  brandResult,
  onBrandImageUrlChange,
  onBrandTitleChange,
  onTest,
}: Props) => {
  return (
    <Card className="border-purple-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Stamp className="w-5 h-5 text-purple-500" />
          <CardTitle className="text-lg sm:text-xl">Testar Aplicação de Marca</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Cola a URL de uma imagem já hospedada e vê o resultado da barra + logo MDAccula (mesma
          function que o Event Watcher aplica automaticamente todo dia às 08h). Útil pra testar
          sem precisar esperar o agendamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor="brand-image-url">URL da imagem</Label>
          <Input
            id="brand-image-url"
            placeholder="https://mdaccula.b-cdn.net/event-images/exemplo.webp"
            value={brandImageUrl}
            onChange={(e) => onBrandImageUrlChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-title">Título de teste</Label>
          <Input
            id="brand-title"
            placeholder="Nome do evento a exibir na barra"
            value={brandTitle}
            onChange={(e) => onBrandTitleChange(e.target.value)}
          />
        </div>

        <Button onClick={onTest} disabled={brandTesting} variant="outline" className="w-full">
          {brandTesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Aplicando marca...
            </>
          ) : (
            <>
              <Stamp className="w-4 h-4 mr-2" />
              Aplicar Marca Nesta Imagem
            </>
          )}
        </Button>

        {brandResult && (
          <div className="space-y-2">
            <div
              className={`p-2 rounded-md text-xs ${
                brandResult.composed
                  ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                  : 'bg-destructive/10 border border-destructive/30 text-destructive'
              }`}
            >
              {brandResult.composed
                ? '✅ Marca aplicada com sucesso'
                : '⚠️ Falhou — mostrando a imagem original sem alteração'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Original</p>
                <img
                  src={brandImageUrl}
                  alt="Imagem original"
                  className="w-full rounded-lg border object-cover"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Resultado</p>
                <img
                  src={brandResult.imageUrl}
                  alt="Imagem com marca aplicada"
                  className="w-full rounded-lg border object-cover"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
