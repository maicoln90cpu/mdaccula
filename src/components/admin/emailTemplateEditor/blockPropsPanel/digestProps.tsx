/**
 * Sub-painel de propriedades — grupo digestProps.
 * Extraído de BlockPropsPanel.tsx (Onda 10) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

export function renderDigestProps(block: Block, patch: Patch): JSX.Element | null {
  if (block.kind === 'weekend_grid') {
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
              <SelectItem value="grid">
                Grid adaptativo (1 evento = card único, 2+ = 2 colunas)
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
        <ColorControl
          label="Cor de destaque (barra do dia / badges)"
          value={block.day_bar_color}
          onChange={(v) => patch({ day_bar_color: v })}
          placeholder="Cor de destaque"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_time !== false}
            onCheckedChange={(v) => patch({ show_time: v })}
          />
          <Label className="text-xs">Mostrar horário nos cards</Label>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
      </div>
    );
  }

  if (block.kind === 'event_grid') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Grade de 2 colunas para vários eventos que viram de lote no mesmo dia. Os eventos são
          selecionados manualmente no disparo (não vêm da agenda automática).
        </p>
        <div>
          <Label className="text-xs">Etiqueta (topo — opcional)</Label>
          <Input
            value={block.eyebrow || ''}
            onChange={(e) => patch({ eyebrow: e.target.value })}
            placeholder="ÚLTIMAS HORAS · VIRADA DE LOTE"
          />
        </div>
        <div>
          <Label className="text-xs">Título (opcional)</Label>
          <Input
            value={block.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
      </div>
    );
  }

  if (block.kind === 'weekly_hero') {
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
            checked={block.show_datetime !== false}
            onCheckedChange={(v) => patch({ show_datetime: v })}
          />
          <Label className="text-xs">Mostrar dia/hora</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_cta !== false}
            onCheckedChange={(v) => patch({ show_cta: v })}
          />
          <Label className="text-xs">Mostrar botão CTA</Label>
        </div>
        <ColorControl
          label="Cor da etiqueta/destaque"
          value={block.accent_color}
          onChange={(v) => patch({ accent_color: v })}
          placeholder="Cor de destaque"
        />
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
      </div>
    );
  }

  if (block.kind === 'blog_posts_list') {
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
        <ColorControl
          label="Cor de destaque da categoria"
          value={block.category_color}
          onChange={(v) => patch({ category_color: v })}
          placeholder="Cor de destaque"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={block.show_read_more_link === true}
            onCheckedChange={(v) => patch({ show_read_more_link: v })}
          />
          <Label className="text-xs">
            Mostrar link "Ler matéria →" também no layout lista
          </Label>
        </div>
        <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
      </div>
    );
  }

  if (block.kind === 'dedge_block') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Bloco fixo da residência Dedge (encerramento da newsletter do FDS). Por padrão usa a
          imagem/textos/noites configurados no disparo — marque "Personalizar" para sobrescrever
          aqui.
        </p>
        <div>
          <Label className="text-xs">Estilo do card</Label>
          <Select
            value={block.card_style || 'featured'}
            onValueChange={(v) => patch({ card_style: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">
                Destaque (padrão — imagem grande, caixa preta)
              </SelectItem>
              <SelectItem value="compact">
                Compacto (discreto — como os cards do resumo de blog)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {block.card_style !== 'compact' && (
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
        )}
        {block.card_style === 'compact' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_description !== false}
              onCheckedChange={(v) => patch({ show_description: v })}
            />
            <Label className="text-xs">Mostrar descrição no card compacto</Label>
          </div>
        )}
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
  }
  return null;
}
