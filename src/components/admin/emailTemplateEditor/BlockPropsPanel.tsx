/**
 * Painel de propriedades por tipo de bloco.
 * Extraído de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
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
import { AlignControl, ColorControl } from './controls';

export function BlockPropsPanel({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const patch = (p: Record<string, unknown>) => onChange(p as Partial<Block>);

  switch (block.kind) {
    case 'header':
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

    case 'hero_image':
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

    case 'eyebrow':
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
        </div>
      );

    case 'title':
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
          <p className="text-xs text-muted-foreground">O texto vem do título do evento.</p>
        </div>
      );

    case 'subtitle':
      return (
        <div className="space-y-3">
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
          <p className="text-xs text-muted-foreground">
            O texto vem do subtítulo do evento (some se vazio).
          </p>
        </div>
      );

    case 'event_meta':
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
        </div>
      );

    case 'description':
      return (
        <div className="space-y-3">
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
        </div>
      );

    case 'article_summary':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_image !== false}
              onCheckedChange={(v) => patch({ show_image: v })}
            />
            <Label className="text-xs">Mostrar imagem da matéria</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Bloco só aparece quando o evento tem matéria vinculada.
          </p>
        </div>
      );

    case 'cta_button':
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
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
        </div>
      );

    case 'secondary_link':
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'image_with_link':
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'divider':
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

    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">HTML (tags básicas)</Label>
            <Textarea
              rows={6}
              value={block.html || ''}
              onChange={(e) => patch({ html: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tags de script, style, iframe e handlers on* são removidos.
            </p>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor base do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
        </div>
      );

    case 'social_icons':
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

    case 'lineup':
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
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
          <p className="text-xs text-muted-foreground">
            Os artistas vêm do campo "Line-up" do evento. Se estiver vazio, o bloco some.
          </p>
        </div>
      );

    case 'countdown':
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <p className="text-xs text-muted-foreground">
            E-mail não roda JavaScript — o contador é <strong>congelado no momento do envio</strong>{' '}
            (dias/horas/minutos restantes).
          </p>
        </div>
      );

    case 'ticker': {
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
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );
    }

    case 'static_map':
      return (
        <div className="space-y-3">
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
        </div>
      );

    case 'weekend_grid':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Grade de eventos do fim de semana. Os eventos são coletados automaticamente pelo disparo
            semanal (sex/sáb/dom da semana em curso).
          </p>
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'cartaz'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cartaz">
                  Cartaz digital (recomendado — cards full-width)
                </SelectItem>
                <SelectItem value="timeline">
                  Timeline por dia (compacto, barra colorida)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Etiqueta (topo — opcional)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="AGENDA · FIM DE SEMANA"
            />
          </div>
          <div>
            <Label className="text-xs">Título (opcional)</Label>
            <Input
              value={block.title || ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="O que rola no fds"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_article_link !== false}
              onCheckedChange={(v) => patch({ show_article_link: v })}
            />
            <Label className="text-xs">
              Mostrar link "Ler matéria" quando o evento tiver artigo
            </Label>
          </div>
          {block.layout === 'timeline' && (
            <ColorControl
              label="Cor da barra do dia"
              value={block.day_bar_color}
              onChange={(v) => patch({ day_bar_color: v })}
              placeholder="Cor de destaque"
            />
          )}
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'weekly_hero':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Destaque grande no topo do e-mail. Usa o 1º evento do array <code>weekendEvents</code>{' '}
            ou os dados do evento principal (mock/real).
          </p>
          <div>
            <Label className="text-xs">Fonte dos dados</Label>
            <Select
              value={block.source || 'first_weekend'}
              onValueChange={(v) => patch({ source: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_weekend">
                  1º evento de weekendEvents (recomendado para digest)
                </SelectItem>
                <SelectItem value="main_event">
                  Evento principal (mock/real selecionado no preview)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Etiqueta (topo)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="DESTAQUE DA SEMANA"
            />
          </div>
          <div>
            <Label className="text-xs">Texto do CTA</Label>
            <Input
              value={block.cta_label || ''}
              onChange={(e) => patch({ cta_label: e.target.value })}
              placeholder="Garantir ingresso"
            />
          </div>
          <div>
            <Label className="text-xs">Intensidade do overlay sobre o flyer</Label>
            <Select
              value={block.overlay_intensity || 'strong'}
              onValueChange={(v) => patch({ overlay_intensity: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong">
                  Forte (recomendado — textos legíveis sobre qualquer flyer)
                </SelectItem>
                <SelectItem value="soft">Suave (flyer mais visível)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_venue !== false}
              onCheckedChange={(v) => patch({ show_venue: v })}
            />
            <Label className="text-xs">Mostrar local (venue + cidade)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_cta !== false}
              onCheckedChange={(v) => patch({ show_cta: v })}
            />
            <Label className="text-xs">Mostrar botão CTA</Label>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'blog_posts_list':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lista dos últimos posts do blog. Os posts são coletados automaticamente pelo disparo
            semanal (últimos publicados).
          </p>
          <div>
            <Label className="text-xs">Etiqueta (topo)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="MATÉRIAS"
            />
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={block.title || ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Do blog nesta semana"
            />
          </div>
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'list'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Lista compacta (miniatura + texto)</SelectItem>
                <SelectItem value="cards">Cards com imagem grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Máximo de posts</Label>
            <Select
              value={String(block.max_items ?? 3)}
              onValueChange={(v) => patch({ max_items: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_excerpt !== false}
              onCheckedChange={(v) => patch({ show_excerpt: v })}
            />
            <Label className="text-xs">Mostrar resumo (excerpt)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_category !== false}
              onCheckedChange={(v) => patch({ show_category: v })}
            />
            <Label className="text-xs">Mostrar categoria + data</Label>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'dedge_block':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Bloco fixo da residência Dedge (encerramento da newsletter do FDS). Por padrão usa a
            imagem/textos/noites configurados no disparo — marque "Personalizar" para sobrescrever
            aqui.
          </p>
          <div>
            <Label className="text-xs">Estilo dos botões das noites</Label>
            <Select
              value={block.button_style || 'dark'}
              onValueChange={(v) => patch({ button_style: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">
                  Preto minimalista (padrão — combina com layout cartaz)
                </SelectItem>
                <SelectItem value="primary">
                  Gradiente da marca (combina com layout timeline)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.override_content === true}
              onCheckedChange={(v) => patch({ override_content: v })}
            />
            <Label className="text-xs">Personalizar imagem e textos (sobrescreve o payload)</Label>
          </div>
          {block.override_content && (
            <>
              <div>
                <Label className="text-xs">URL da imagem Dedge</Label>
                <Input
                  value={block.image_url || ''}
                  onChange={(e) => patch({ image_url: e.target.value })}
                  placeholder="https://mdaccula.b-cdn.net/…"
                />
              </div>
              <div>
                <Label className="text-xs">Etiqueta</Label>
                <Input
                  value={block.eyebrow || ''}
                  onChange={(e) => patch({ eyebrow: e.target.value })}
                  placeholder="TODA SEMANA · RESIDÊNCIA"
                />
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={block.title || ''}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Dedge — sua residência da semana"
                />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  rows={2}
                  value={block.description || ''}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Texto do botão principal</Label>
                <Input
                  value={block.primary_label || ''}
                  onChange={(e) => patch({ primary_label: e.target.value })}
                  placeholder="Ver todos os eventos Dedge"
                />
              </div>
              <div>
                <Label className="text-xs">URL do botão principal</Label>
                <Input
                  value={block.primary_url || ''}
                  onChange={(e) => patch({ primary_url: e.target.value })}
                  placeholder="https://mdaccula.com/…"
                />
              </div>
            </>
          )}
        </div>
      );

    case 'footer':
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

    default:
      return (
        <p className="text-sm text-muted-foreground">
          Este bloco não tem propriedades editáveis — sua aparência vem dos dados do evento.
        </p>
      );
  }
}
