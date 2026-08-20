import type { JSX } from 'react';
/**
 * Sub-painel de propriedades — grupo eventProps.
 * Extraído de BlockPropsPanel.tsx (Onda 10) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
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

export function renderEventProps(block: Block, patch: Patch): JSX.Element | null {
  if (block.kind === 'lineup') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Título da seção</Label>
          <Input
            value={block.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Line-up"
          />
        </div>
        <div>
          <Label className="text-xs">Layout</Label>
          <Select value={block.layout || 'chips'} onValueChange={(v) => patch({ layout: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chips">Pílulas (compacto)</SelectItem>
              <SelectItem value="list">Lista (um por linha)</SelectItem>
              <SelectItem value="grid">Grade (2 colunas)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <ColorControl
          label="Cor do título"
          value={block.title_color}
          onChange={(v) => patch({ title_color: v })}
          placeholder="#a855f7"
        />
        <ColorControl
          label="Cor dos nomes"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#ffffff"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={block.highlight_headliner === true}
            onCheckedChange={(v) => patch({ highlight_headliner: v })}
          />
          <Label className="text-xs">Destacar 1º nome (headliner maior)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.section_bg === true}
            onCheckedChange={(v) => patch({ section_bg: v })}
          />
          <Label className="text-xs">Fundo da seção (caixa sutil)</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Os artistas vêm do campo "Line-up" do evento. Se estiver vazio, o bloco some.
        </p>
      </div>
    );
  }

  if (block.kind === 'countdown') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Texto acima do contador</Label>
          <Input
            value={block.label || ''}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Lote atual encerra em"
          />
        </div>
        <div>
          <Label className="text-xs">Data-limite</Label>
          <Select
            value={block.deadline_source || 'today_2359'}
            onValueChange={(v) => patch({ deadline_source: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today_2359">Hoje às 23:59 (padrão virada de lote)</SelectItem>
              <SelectItem value="batch_deadline">
                Data da virada do evento (se cadastrada)
              </SelectItem>
              <SelectItem value="event_start">Início do evento</SelectItem>
              <SelectItem value="custom">Data/hora personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.deadline_source === 'custom' && (
          <div>
            <Label className="text-xs">Data/hora personalizada</Label>
            <Input
              type="datetime-local"
              value={block.custom_deadline ? block.custom_deadline.slice(0, 16) : ''}
              onChange={(e) =>
                patch({
                  custom_deadline: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </div>
        )}
        <div>
          <Label className="text-xs">Tamanho</Label>
          <Select value={block.size || 'large'} onValueChange={(v) => patch({ size: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="large">Grande — 3 caixas (dias/horas/min)</SelectItem>
              <SelectItem value="medium">Médio — 2 caixas (horas/minutos)</SelectItem>
              <SelectItem value="minimal">Minimalista — 1 linha compacta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Estilo de fundo</Label>
          <Select
            value={block.bg_style || 'gradient'}
            onValueChange={(v) => patch({ bg_style: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gradient">Gradiente da marca</SelectItem>
              <SelectItem value="solid">Cor sólida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.bg_style === 'solid' && (
          <ColorControl
            label="Cor de fundo"
            value={block.bg_color}
            onChange={(v) => patch({ bg_color: v })}
            placeholder="#a855f7"
          />
        )}
        <ColorControl
          label="Cor do texto/números"
          value={block.number_color}
          onChange={(v) => patch({ number_color: v })}
          placeholder="#ffffff"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_unit_labels !== false}
            onCheckedChange={(v) => patch({ show_unit_labels: v })}
          />
          <Label className="text-xs">Mostrar rótulos (dias/horas/min)</Label>
        </div>
        {block.show_unit_labels !== false && (
          <div className="space-y-2 rounded-md border p-2">
            <Label className="text-xs text-muted-foreground">
              Textos das unidades (opcional — útil pra traduzir/abreviar)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={block.unit_label_day || ''}
                onChange={(e) => patch({ unit_label_day: e.target.value })}
                placeholder="dia"
              />
              <Input
                value={block.unit_label_days || ''}
                onChange={(e) => patch({ unit_label_days: e.target.value })}
                placeholder="dias"
              />
              <Input
                value={block.unit_label_hour || ''}
                onChange={(e) => patch({ unit_label_hour: e.target.value })}
                placeholder="hora"
              />
              <Input
                value={block.unit_label_hours || ''}
                onChange={(e) => patch({ unit_label_hours: e.target.value })}
                placeholder="horas"
              />
              <Input
                value={block.unit_label_minutes || ''}
                onChange={(e) => patch({ unit_label_minutes: e.target.value })}
                placeholder="min"
              />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs">Prefixo da data-limite (opcional)</Label>
          <Input
            value={block.until_prefix || ''}
            onChange={(e) => patch({ until_prefix: e.target.value })}
            placeholder="até"
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
        <p className="text-xs text-muted-foreground">
          E-mail não roda JavaScript — o contador é <strong>congelado no momento do envio</strong>{' '}
          (dias/horas/minutos restantes).
        </p>
      </div>
    );
  }

  if (block.kind === 'ticker') {
    const msgs = block.messages || ['Últimas horas', 'Ingressos limitados', 'Restam poucos'];
    const setMsg = (i: number, v: string) => {
      const next = [...msgs];
      next[i] = v;
      patch({ messages: next.filter((x) => x !== '').slice(0, 3) });
    };
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Barra fina com mensagens curtas de urgência. Suporta até 3 frases. Animação funciona em
          Apple Mail/iOS; Gmail/Outlook mostram a 1ª mensagem estática (fallback automático).
        </p>
        <div>
          <Label className="text-xs">Mensagem 1</Label>
          <Input
            value={msgs[0] || ''}
            onChange={(e) => setMsg(0, e.target.value)}
            placeholder="Últimas horas"
          />
        </div>
        <div>
          <Label className="text-xs">Mensagem 2 (opcional)</Label>
          <Input
            value={msgs[1] || ''}
            onChange={(e) => setMsg(1, e.target.value)}
            placeholder="Ingressos limitados"
          />
        </div>
        <div>
          <Label className="text-xs">Mensagem 3 (opcional)</Label>
          <Input
            value={msgs[2] || ''}
            onChange={(e) => setMsg(2, e.target.value)}
            placeholder="Restam poucos"
          />
        </div>
        <div>
          <Label className="text-xs">Ícone</Label>
          <Select value={block.icon || 'clock'} onValueChange={(v) => patch({ icon: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="clock">⏰ Relógio</SelectItem>
              <SelectItem value="fire">🔥 Fogo</SelectItem>
              <SelectItem value="bolt">⚡ Raio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Animação</Label>
          <Select
            value={block.animation || 'fade'}
            onValueChange={(v) => patch({ animation: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Alternar mensagens (fade)</SelectItem>
              <SelectItem value="slide">Deslizar (marquee)</SelectItem>
              <SelectItem value="none">Sem animação (estática)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ColorControl
          label="Cor de fundo"
          value={block.bg_color}
          onChange={(v) => patch({ bg_color: v })}
          placeholder="Cor primária"
        />
        <ColorControl
          label="Cor do texto"
          value={block.text_color}
          onChange={(v) => patch({ text_color: v })}
          placeholder="#ffffff"
        />
        <div>
          <Label className="text-xs">Velocidade da animação</Label>
          <Select value={block.speed || 'normal'} onValueChange={(v) => patch({ speed: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slow">Lenta</SelectItem>
              <SelectItem value="normal">Normal (padrão)</SelectItem>
              <SelectItem value="fast">Rápida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Formato</Label>
          <Select value={block.shape || 'bar'} onValueChange={(v) => patch({ shape: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Barra reta (padrão)</SelectItem>
              <SelectItem value="pill">Pílula arredondada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} defaultAlign="center" />
      </div>
    );
  }

  if (block.kind === 'static_map') {
    return (
      <div className="space-y-3">
        <Alert variant="destructive" className="text-xs">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            O mapa estático no e-mail usa o Google Maps Static API, que é cobrado por cada abertura.
            Para evitar custos recorrentes, a imagem agora é pré-gerada automaticamente no Bunny CDN
            no momento do disparo (paga apenas 1x por campanha). Use com moderação e remova o bloco
            se quiser zerar o custo.
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          Mini-mapa do venue, clicável — abre no Waze/Google Maps do celular. Só aparece se o
          evento tiver <strong>coordenadas (latitude/longitude)</strong> preenchidas. Você
          configura isso no formulário do evento.
        </p>
        <div>
          <Label className="text-xs">Zoom ({block.zoom ?? 15})</Label>
          <input
            type="range"
            min={12}
            max={18}
            value={block.zoom ?? 15}
            onChange={(e) => patch({ zoom: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <Label className="text-xs">Altura</Label>
          <Select
            value={String(block.height ?? 300)}
            onValueChange={(v) => patch({ height: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="200">Baixa (200px)</SelectItem>
              <SelectItem value="300">Média (300px)</SelectItem>
              <SelectItem value="400">Alta (400px)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Estilo do mapa</Label>
          <Select
            value={block.map_style || 'roadmap'}
            onValueChange={(v) => patch({ map_style: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roadmap">Ruas (padrão)</SelectItem>
              <SelectItem value="terrain">Terreno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Bordas arredondadas</Label>
          <Select
            value={String(block.border_radius ?? 12)}
            onValueChange={(v) => patch({ border_radius: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sem borda</SelectItem>
              <SelectItem value="8">8px</SelectItem>
              <SelectItem value="12">12px</SelectItem>
              <SelectItem value="16">16px</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_address_label !== false}
            onCheckedChange={(v) => patch({ show_address_label: v })}
          />
          <Label className="text-xs">Mostrar nome do venue e cidade abaixo do mapa</Label>
        </div>
        <ColorControl
          label="Cor do marcador/pin"
          value={block.pin_color}
          onChange={(v) => patch({ pin_color: v })}
          placeholder="cor padrão do Maps"
        />
        <div>
          <Label className="text-xs">Texto do botão "Como chegar"</Label>
          <Input
            value={block.directions_label || ''}
            onChange={(e) => patch({ directions_label: e.target.value })}
            placeholder="Como chegar"
          />
        </div>
      </div>
    );
  }
  return null;
}
