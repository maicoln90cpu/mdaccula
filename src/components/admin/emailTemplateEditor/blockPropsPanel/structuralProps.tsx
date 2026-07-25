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
import { type Block } from '@/lib/emailTemplates/blocks';
import { AlignControl, ColorControl } from '../controls';

type Patch = (p: Record<string, unknown>) => void;

export function renderStructuralProps(block: Block, patch: Patch): JSX.Element | null {
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
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
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
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <div className="flex items-center gap-2">
          <Switch
            checked={block.include_unsubscribe !== false}
            onCheckedChange={(v) => patch({ include_unsubscribe: v })}
          />
          <Label className="text-xs">Incluir botão "Descadastrar-se" (oficial E-goi)</Label>
        </div>
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
            </SelectContent>
          </Select>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <p className="text-xs text-muted-foreground">
          Ative e informe a URL de cada rede. Somente as ativadas com URL aparecem no e-mail.
        </p>
        {(block.networks || []).map((n, i) => (
          <div key={n.id} className="flex items-center gap-2 p-2 rounded border">
            <Switch
              checked={n.enabled}
              onCheckedChange={(v) => {
                const next = [...(block.networks || [])];
                next[i] = { ...n, enabled: v };
                patch({ networks: next });
              }}
            />
            <div className="flex-1">
              <div className="text-xs font-medium">{n.label}</div>
              <Input
                className="h-7 text-xs mt-1"
                value={n.url}
                placeholder="https://…"
                onChange={(e) => {
                  const next = [...(block.networks || [])];
                  next[i] = { ...n, url: e.target.value };
                  patch({ networks: next });
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
