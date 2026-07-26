/**
 * Sub-painel de propriedades — grupo textProps.
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
import { AlignControl, ColorControl, RichHtmlEditor } from '../controls';

type Patch = (p: Record<string, unknown>) => void;

export function renderTextProps(block: Block, patch: Patch): JSX.Element | null {
  if (block.kind === 'eyebrow') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto</Label>
          <Input value={block.text || ''} onChange={(e) => patch({ text: e.target.value })} />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <ColorControl
          label="Cor do texto (deixe vazio para usar a cor primária)"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#a855f7"
        />
        <div>
          <Label className="text-xs">Fundo</Label>
          <Select value={block.bg_style || 'none'} onValueChange={(v) => patch({ bg_style: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem fundo (padrão)</SelectItem>
              <SelectItem value="pill">Fundo tipo "tag"</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (block.kind === 'title') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 28}px</Label>
          <Slider
            min={18}
            max={48}
            step={2}
            value={[block.font_size ?? 28]}
            onValueChange={(v) => patch({ font_size: v[0] })}
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#ffffff"
        />
        <div>
          <Label className="text-xs">Peso da fonte</Label>
          <Select
            value={block.font_weight || 'black'}
            onValueChange={(v) => patch({ font_weight: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="black">Extra-negrito (padrão)</SelectItem>
              <SelectItem value="bold">Negrito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.uppercase === true}
            onCheckedChange={(v) => patch({ uppercase: v })}
          />
          <Label className="text-xs">Caixa alta (uppercase)</Label>
        </div>
        <p className="text-xs text-muted-foreground">O texto vem do título do evento.</p>
      </div>
    );
  }

  if (block.kind === 'subtitle') {
    return (
      <div className="space-y-3">
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#a1a1aa"
        />
        <div>
          <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 16}px</Label>
          <Slider
            min={12}
            max={24}
            step={1}
            value={[block.font_size ?? 16]}
            onValueChange={(v) => patch({ font_size: v[0] })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.italic === true}
            onCheckedChange={(v) => patch({ italic: v })}
          />
          <Label className="text-xs">Itálico</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          O texto vem do subtítulo do evento (some se vazio).
        </p>
      </div>
    );
  }

  if (block.kind === 'event_meta') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Layout</Label>
          <Select value={block.layout || 'columns'} onValueChange={(v) => patch({ layout: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="columns">Duas colunas (data | local)</SelectItem>
              <SelectItem value="stacked">Empilhado (melhor no mobile)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_icons !== false}
            onCheckedChange={(v) => patch({ show_icons: v })}
          />
          <Label className="text-xs">Mostrar ícones (📅 data / 📍 local)</Label>
        </div>
        <ColorControl
          label="Cor de destaque dos rótulos"
          value={block.accent_color}
          onChange={(v) => patch({ accent_color: v })}
          placeholder="Cor de destaque"
        />
      </div>
    );
  }

  if (block.kind === 'description') {
    return (
      <div className="space-y-3">
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#a1a1aa"
        />
        <div>
          <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 15}px</Label>
          <Slider
            min={12}
            max={20}
            step={1}
            value={[block.font_size ?? 15]}
            onValueChange={(v) => patch({ font_size: v[0] })}
          />
        </div>
        <div>
          <Label className="text-xs">Espaçamento entre linhas</Label>
          <Select
            value={block.line_height || 'normal'}
            onValueChange={(v) => patch({ line_height: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal (padrão)</SelectItem>
              <SelectItem value="compact">Compacto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (block.kind === 'article_summary') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_image !== false}
            onCheckedChange={(v) => patch({ show_image: v })}
          />
          <Label className="text-xs">Mostrar imagem da matéria</Label>
        </div>
        <div>
          <Label className="text-xs">Layout</Label>
          <Select value={block.layout || 'card'} onValueChange={(v) => patch({ layout: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="card">Card com destaque (padrão)</SelectItem>
              <SelectItem value="compact">Lista compacta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Bloco só aparece quando o evento tem matéria vinculada.
        </p>
      </div>
    );
  }

  if (block.kind === 'text') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto</Label>
          <RichHtmlEditor
            rows={6}
            value={block.html || ''}
            onChange={(v) => patch({ html: v })}
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        <ColorControl
          label="Cor base do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#a1a1aa"
        />
        <div>
          <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 14}px</Label>
          <Slider
            min={11}
            max={22}
            step={1}
            value={[block.font_size ?? 14]}
            onValueChange={(v) => patch({ font_size: v[0] })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.bg_highlight === true}
            onCheckedChange={(v) => patch({ bg_highlight: v })}
          />
          <Label className="text-xs">Fundo em caixa (destaque)</Label>
        </div>
      </div>
    );
  }
  return null;
}
