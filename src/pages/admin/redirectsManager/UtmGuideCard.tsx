/**
 * UtmGuideCard — bloco estático explicando os parâmetros UTM.
 * Extraído na Onda 11 sem alterações de conteúdo.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const UtmGuideCard = () => (
  <Card variant="note" className="mt-4">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">
        📊 Guia de UTMs — Como configurar corretamente
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm text-muted-foreground">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">utm_source</p>
          <p>
            De onde vem o tráfego. Ex: <code className="text-primary">mdaccula</code>,{' '}
            <code className="text-primary">instagram</code>,{' '}
            <code className="text-primary">whatsapp</code>
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">utm_medium</p>
          <p>
            Tipo de canal. Ex: <code className="text-primary">link-curto</code>,{' '}
            <code className="text-primary">bio</code>,{' '}
            <code className="text-primary">stories</code>,{' '}
            <code className="text-primary">email</code>
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">utm_campaign</p>
          <p>
            Nome da campanha ou ação. Ex:{' '}
            <code className="text-primary">carnaval-2026</code>,{' '}
            <code className="text-primary">lancamento-ep</code>
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">utm_content</p>
          <p>
            Diferencia variações do mesmo link. Ex:{' '}
            <code className="text-primary">botao-cta</code>,{' '}
            <code className="text-primary">banner-topo</code>
          </p>
        </div>
      </div>
      <div className="border-t border-border pt-3 mt-3">
        <p className="font-semibold text-foreground mb-1">💡 Configuração recomendada</p>
        <p>
          Use sempre <code className="text-primary">utm_source=mdaccula</code> e{' '}
          <code className="text-primary">utm_medium=link-curto</code> como padrão.
          Personalize <code className="text-primary">utm_campaign</code> por ação e{' '}
          <code className="text-primary">utm_content</code> quando tiver mais de um link
          para a mesma campanha.
        </p>
      </div>
    </CardContent>
  </Card>
);
