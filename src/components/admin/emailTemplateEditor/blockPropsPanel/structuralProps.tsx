/**
 * Sub-painel de propriedades — grupo structuralProps.
 * Extraído de BlockPropsPanel.tsx (Onda 10) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_SOCIAL_ICON_URLS, type Block } from '@/lib/emailTemplates/blocks';
import { AlignControl, ColorControl } from '../controls';

type Patch = (p: Record<string, unknown>) => void;

export function renderStructuralProps(block: Block, patch: Patch): React.JSX.Element | null {
  if (block.kind === 'header') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Altura do logo: {block.logo_height ?? 64}px</Label>
          <Slider
            min={32}
            max={120}
            step={4}
            value={[block.logo_height ?? 64]}
            onValueChange={(v) => patch({ logo_height: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">Espaçamento superior: {block.padding_y ?? 32}px</Label>
          <Slider
            min={0}
            max={80}
            step={4}
            value={[block.padding_y ?? 32]}
            onValueChange={(v) => patch({ padding_y: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">Espaçamento inferior: {block.padding_bottom ?? 0}px</Label>
          <Slider
            min={0}
            max={80}
            step={4}
            value={[block.padding_bottom ?? 0]}
            onValueChange={(v) => patch({ padding_bottom: v[0] })}
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <ColorControl
          label="Cor de fundo do cabeçalho (opcional)"
          value={block.bg_color}
          onChange={(v) => patch({ bg_color: v })}
          placeholder="transparente"
        />
        <p className="text-xs text-muted-foreground">
          O logo em si é definido na aba "Template (marca)".
        </p>
      </div>
    );
  }

  if (block.kind === 'hero_image') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Largura máxima: {block.max_width ?? 552}px</Label>
          <Slider
            min={300}
            max={600}
            step={20}
            value={[block.max_width ?? 552]}
            onValueChange={(v) => patch({ max_width: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">Borda arredondada: {block.border_radius ?? 12}px</Label>
          <Slider
            min={0}
            max={24}
            step={2}
            value={[block.border_radius ?? 12]}
            onValueChange={(v) => patch({ border_radius: v[0] })}
          />
        </div>
        <ColorControl
          label="Borda sutil ao redor (opcional)"
          value={block.border_color}
          onChange={(v) => patch({ border_color: v })}
          placeholder="sem borda"
        />
        <div>
          <Label className="text-xs">Legenda abaixo da imagem (opcional)</Label>
          <Input
            value={block.caption || ''}
            onChange={(e) => patch({ caption: e.target.value })}
            placeholder="Ex.: Foto do line-up anterior"
          />
        </div>
        <p className="text-xs text-muted-foreground">A imagem vem do flyer do evento.</p>
      </div>
    );
  }

  if (block.kind === 'divider') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Espessura: {block.thickness ?? 1}px</Label>
          <Slider
            min={1}
            max={8}
            step={1}
            value={[block.thickness ?? 1]}
            onValueChange={(v) => patch({ thickness: v[0] })}
          />
        </div>
        <ColorControl
          label="Cor"
          value={block.color}
          onChange={(v) => patch({ color: v })}
          placeholder="rgba(255,255,255,0.08)"
        />
        <div>
          <Label className="text-xs">Espaçamento vertical</Label>
          <Select value={block.spacing || 'normal'} onValueChange={(v) => patch({ spacing: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compacto</SelectItem>
              <SelectItem value="normal">Normal (padrão)</SelectItem>
              <SelectItem value="wide">Largo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Largura</Label>
          <Select value={block.width || 'full'} onValueChange={(v) => patch({ width: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Linha inteira (padrão)</SelectItem>
              <SelectItem value="short">Centralizada curta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (block.kind === 'spacing') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Altura do respiro: {block.height ?? 24}px</Label>
          <Slider
            min={4}
            max={160}
            step={4}
            value={[block.height ?? 24]}
            onValueChange={(v) => patch({ height: v[0] })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Bloco invisível — só adiciona espaço vertical entre os blocos vizinhos.
        </p>
      </div>
    );
  }

  if (block.kind === 'footer') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto do rodapé (opcional — usa o padrão se vazio)</Label>
          <Textarea
            rows={3}
            value={block.text || ''}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#52525b"
        />
        <div>
          <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 11}px</Label>
          <Slider
            min={9}
            max={14}
            step={1}
            value={[block.font_size ?? 11]}
            onValueChange={(v) => patch({ font_size: v[0] })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.include_unsubscribe !== false}
            onCheckedChange={(v) => patch({ include_unsubscribe: v })}
          />
          <Label className="text-xs">Incluir botão "Descadastrar-se" (oficial E-goi)</Label>
        </div>
        {block.include_unsubscribe !== false && (
          <div>
            <Label className="text-xs">Texto do link de descadastro (opcional)</Label>
            <Input
              value={block.unsubscribe_label || ''}
              onChange={(e) => patch({ unsubscribe_label: e.target.value })}
              placeholder="Descadastrar-se"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          O link usa o placeholder{' '}
          <code className="bg-muted px-1 rounded">[E-GOI_UNSUBSCRIBE_LINK]</code>, substituído
          pela E-goi no momento do envio.
        </p>
      </div>
    );
  }

  if (block.kind === 'social_icons') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Estilo</Label>
          <Select value={block.style || 'text'} onValueChange={(v) => patch({ style: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto colorido (padrão)</SelectItem>
              <SelectItem value="pill">Pílulas coloridas</SelectItem>
              <SelectItem value="icon">Ícone da rede (imagem)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.style === 'icon' && (
          <div>
            <Label className="text-xs">Tamanho do ícone</Label>
            <Select
              value={block.icon_size || 'medium'}
              onValueChange={(v) => patch({ icon_size: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Pequeno (24px)</SelectItem>
                <SelectItem value="medium">Médio (32px — padrão)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <p className="text-xs text-muted-foreground">
          Ative e informe a URL de cada rede. Somente as ativadas com URL aparecem no e-mail.
          {block.style === 'icon' &&
            ' Redes conhecidas (Instagram, YouTube, TikTok, SoundCloud, Spotify, Linktree, WhatsApp) já vêm com ícone padrão — informe uma URL própria só se quiser trocar.'}
        </p>
        {(block.networks || []).map((n, i) => {
          const defaultIcon = DEFAULT_SOCIAL_ICON_URLS[n.id];
          const previewIcon = n.icon_url || defaultIcon;
          return (
            <div key={n.id} className="flex items-center gap-2 p-2 rounded border">
              <Switch
                checked={n.enabled}
                onCheckedChange={(v) => {
                  const next = [...(block.networks || [])];
                  next[i] = { ...n, enabled: v };
                  patch({ networks: next });
                }}
              />
              {block.style === 'icon' && previewIcon && (
                <img src={previewIcon} alt="" className="w-6 h-6 rounded shrink-0" />
              )}
              <div className="flex-1 space-y-1">
                <div className="text-xs font-medium">{n.label}</div>
                <Input
                  className="h-7 text-xs"
                  value={n.url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...(block.networks || [])];
                    next[i] = { ...n, url: e.target.value };
                    patch({ networks: next });
                  }}
                />
                {block.style === 'icon' && (
                  <Input
                    className="h-7 text-xs"
                    value={n.icon_url || ''}
                    placeholder={defaultIcon ? 'Ícone padrão já aplicado — cole uma URL pra trocar' : 'URL do ícone (PNG, ~64×64px)'}
                    onChange={(e) => {
                      const next = [...(block.networks || [])];
                      next[i] = { ...n, icon_url: e.target.value };
                      patch({ networks: next });
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}
