/**
 * Sub-painel de propriedades — grupo actionProps.
 * Extraído de BlockPropsPanel.tsx (Onda 10) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function renderActionProps(block: Block, patch: Patch): JSX.Element | null {
  if (block.kind === 'cta_button') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto do botão</Label>
          <Input value={block.label || ''} onChange={(e) => patch({ label: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Link do botão</Label>
          <Select
            value={block.url_field || 'ticket_link'}
            onValueChange={(v) => patch({ url_field: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ticket_link">Link de ingresso do evento</SelectItem>
              <SelectItem value="vip_link">Link Camarote do evento</SelectItem>
              <SelectItem value="event_url">Página do evento no site</SelectItem>
              <SelectItem value="custom">URL personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.url_field === 'custom' && (
          <div>
            <Label className="text-xs">URL personalizada</Label>
            <Input
              value={block.custom_url || ''}
              onChange={(e) => patch({ custom_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            checked={block.full_width !== false}
            onCheckedChange={(v) => patch({ full_width: v })}
          />
          <Label className="text-xs">Ocupar toda a largura</Label>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <div>
          <Label className="text-xs">Cor de fundo</Label>
          <Select
            value={block.bg_style || 'gradient'}
            onValueChange={(v) => patch({ bg_style: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gradient">Gradiente da marca (padrão)</SelectItem>
              <SelectItem value="solid">Cor sólida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.bg_style === 'solid' && (
          <ColorControl
            label="Cor sólida do botão"
            value={block.bg_color}
            onChange={(v) => patch({ bg_color: v })}
            placeholder="#a855f7"
          />
        )}
        <div>
          <Label className="text-xs">Tamanho do botão</Label>
          <Select value={block.size || 'medium'} onValueChange={(v) => patch({ size: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequeno</SelectItem>
              <SelectItem value="medium">Médio (padrão)</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Formato</Label>
          <Select value={block.shape || 'rounded'} onValueChange={(v) => patch({ shape: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rounded">Arredondado (padrão)</SelectItem>
              <SelectItem value="pill">Pílula (bem arredondado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (block.kind === 'pix_button') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Só aparece no e-mail quando o evento tem Pix sem taxa habilitado (link de WhatsApp
          configurado). A cor verde do botão é fixa — reforça o reconhecimento visual de
          "Pix/sem taxa", igual ao site.
        </p>
        <div>
          <Label className="text-xs">Texto do botão</Label>
          <Input
            value={block.label || ''}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Comprar Sem Taxa via Pix"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.full_width !== false}
            onCheckedChange={(v) => patch({ full_width: v })}
          />
          <Label className="text-xs">Ocupar toda a largura</Label>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
      </div>
    );
  }

  if (block.kind === 'secondary_link') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto</Label>
          <Input value={block.label || ''} onChange={(e) => patch({ label: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Link</Label>
          <Select
            value={block.url_field || 'agenda_url'}
            onValueChange={(v) => patch({ url_field: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agenda_url">Agenda completa</SelectItem>
              <SelectItem value="event_url">Página do evento</SelectItem>
              <SelectItem value="custom">URL personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.url_field === 'custom' && (
          <Input
            value={block.custom_url || ''}
            onChange={(e) => patch({ custom_url: e.target.value })}
            placeholder="https://…"
          />
        )}
        <div>
          <Label className="text-xs">Estilo</Label>
          <Select
            value={block.variant || 'underline'}
            onValueChange={(v) => patch({ variant: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="underline">Sublinhado (padrão)</SelectItem>
              <SelectItem value="ghost">Botão fantasma (com borda)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#71717a"
        />
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
      </div>
    );
  }

  if (block.kind === 'image_with_link') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">URL da imagem</Label>
          <Input
            value={block.image_url}
            onChange={(e) => patch({ image_url: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <div>
          <Label className="text-xs">Link ao clicar</Label>
          <Input
            value={block.link_url}
            onChange={(e) => patch({ link_url: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <div>
          <Label className="text-xs">Texto alternativo (alt)</Label>
          <Input value={block.alt || ''} onChange={(e) => patch({ alt: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">
            Largura máxima: {block.max_width ?? 552}px (máx. 552 = largura útil do e-mail)
          </Label>
          <Slider
            min={200}
            max={552}
            step={8}
            value={[block.max_width ?? 552]}
            onValueChange={(v) => patch({ max_width: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">Borda arredondada: {block.border_radius ?? 8}px</Label>
          <Slider
            min={0}
            max={24}
            step={2}
            value={[block.border_radius ?? 8]}
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
          <Input value={block.caption || ''} onChange={(e) => patch({ caption: e.target.value })} />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
      </div>
    );
  }
  return null;
}
