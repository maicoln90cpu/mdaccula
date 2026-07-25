import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreationOptionsSectionProps {
  createLink: boolean;
  setCreateLink: (v: boolean) => void;
  linkUrlType: 'ticket' | 'slug';
  setLinkUrlType: (v: 'ticket' | 'slug') => void;
  generateBlogPost: boolean;
  setGenerateBlogPost: (v: boolean) => void;
  aiContext: string;
  setAiContext: (v: string) => void;
  dispatchEmail: boolean;
  setDispatchEmail: (v: boolean) => void;
  emailAutomationReady: boolean;
  emailAutomationReason: string;
  showCreationBlocks: boolean; // false when editing
}

export const CreationOptionsSection = ({
  createLink,
  setCreateLink,
  linkUrlType,
  setLinkUrlType,
  generateBlogPost,
  setGenerateBlogPost,
  aiContext,
  setAiContext,
  dispatchEmail,
  setDispatchEmail,
  emailAutomationReady,
  emailAutomationReason,
  showCreationBlocks,
}: CreationOptionsSectionProps) => (
  <>
    {showCreationBlocks && (
      <>
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createLink"
              checked={createLink}
              onCheckedChange={(checked) => setCreateLink(checked as boolean)}
            />
            <Label htmlFor="createLink" className="cursor-pointer font-medium">
              Criar link automaticamente em /links
            </Label>
          </div>

          {createLink && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="linkUrlType">URL do Link</Label>
              <Select
                value={linkUrlType}
                onValueChange={(value: 'ticket' | 'slug') => setLinkUrlType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket">Link do Ingresso</SelectItem>
                  <SelectItem value="slug">Página do Evento (/eventos/...)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O grupo será criado automaticamente baseado no mês do evento
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="generateBlogPost"
              checked={generateBlogPost}
              onCheckedChange={(checked) => setGenerateBlogPost(checked as boolean)}
            />
            <Label htmlFor="generateBlogPost" className="cursor-pointer font-medium">
              Gerar post do blog automaticamente com IA
            </Label>
          </div>

          {generateBlogPost && (
            <div className="space-y-3 pl-6">
              <p className="text-xs text-muted-foreground">
                Um post do blog será criado como rascunho e vinculado a este evento. Você poderá
                editá-lo após a criação.
              </p>
              <div className="space-y-2">
                <Label htmlFor="aiContext">Contexto para IA (opcional)</Label>
                <Textarea
                  id="aiContext"
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="Ex: Ingresso cortesia pelo link, 50% de desconto no primeiro lote, open bar até 01h, evento beneficente..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Informações extras que a IA deve considerar ao gerar o artigo. Essas instruções
                  têm prioridade máxima.
                </p>
              </div>
            </div>
          )}
        </div>
      </>
    )}

    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-start gap-3">
        <Checkbox
          id="dispatchEmail"
          checked={dispatchEmail}
          disabled={!emailAutomationReady}
          onCheckedChange={(checked) => setDispatchEmail(checked as boolean)}
        />
        <div className="flex-1 space-y-1">
          <Label
            htmlFor="dispatchEmail"
            className={`cursor-pointer font-medium ${!emailAutomationReady ? 'text-muted-foreground' : ''}`}
          >
            Criar rascunho de e-mail na E-goi ao salvar
          </Label>
          <p className="text-xs text-muted-foreground">
            {emailAutomationReady
              ? 'Um rascunho será criado na sua conta E-goi usando o template padrão. Você revisa e envia manualmente pela E-goi.'
              : emailAutomationReason || 'Automação de e-mail indisponível.'}
          </p>
        </div>
      </div>
    </div>
  </>
);
