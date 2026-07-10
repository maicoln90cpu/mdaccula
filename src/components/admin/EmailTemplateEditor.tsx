/**
 * Editor de blocos para templates de e-mail.
 *
 * Layout: lista drag-and-drop à esquerda, painel de propriedades à direita,
 * preview ao vivo abaixo. Usa dnd-kit (já no projeto).
 */
import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Copy, Save } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import {
  type Block, type Template, BLOCK_LABELS, AVAILABLE_BLOCKS, newBlockId,
  renderBlockedTemplate, type ArticleSummary,
  TEMPLATE_PRESETS, buildPresetBlocks,
} from "@/lib/emailTemplates/blocks";
import { MOCK_EVENT_DATA, type EventAnnouncementData, type EmailTemplateSettings } from "@/lib/emailTemplates/eventAnnouncement";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  templates: Template[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onReload: () => Promise<void>;
  settings: EmailTemplateSettings;
  previewEvent: EventAnnouncementData;
  previewArticle: ArticleSummary | null;
}

const defaultForKind = (kind: Block["kind"]): Block => {
  const id = newBlockId();
  switch (kind) {
    case "header": return { id, kind, logo_height: 64, align: "center", padding_y: 32 };
    case "hero_image": return { id, kind, max_width: 552, border_radius: 12 };
    case "eyebrow": return { id, kind, text: "Novo evento", align: "left" };
    case "title": return { id, kind, align: "left", font_size: 28 };
    case "subtitle": return { id, kind, align: "left" };
    case "event_meta": return { id, kind, layout: "columns" };
    case "description": return { id, kind, align: "left" };
    case "article_summary": return { id, kind, show_image: true };
    case "cta_button": return { id, kind, label: "Garantir ingresso", url_field: "ticket_link", align: "center", full_width: true, bg_style: "gradient" };
    case "secondary_link": return { id, kind, label: "Ver agenda completa", url_field: "agenda_url", align: "center" };
    case "image_with_link": return { id, kind, image_url: "", link_url: "", alt: "", max_width: 552, align: "center", border_radius: 8 };
    case "divider": return { id, kind, thickness: 1 };
    case "text": return { id, kind, html: "<p>Texto livre — suporta HTML básico.</p>", align: "left" };
    case "social_icons": return {
      id, kind, style: "text", align: "center", networks: [
        { id: "instagram", label: "Instagram", url: "", enabled: true },
        { id: "youtube", label: "YouTube", url: "", enabled: true },
        { id: "tiktok", label: "TikTok", url: "", enabled: false },
        { id: "soundcloud", label: "SoundCloud", url: "", enabled: false },
        { id: "spotify", label: "Spotify", url: "", enabled: false },
        { id: "linktree", label: "Linktree", url: "", enabled: false },
      ],
    };
    case "footer": return { id, kind, include_unsubscribe: true, align: "center" };
    default: return { id, kind } as Block;
  }
};

// Controle reutilizável de alinhamento (esq/centro/dir)
function AlignControl({ value, onChange }: { value?: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div>
      <Label className="text-xs">Alinhamento</Label>
      <Select value={value || "left"} onValueChange={(v) => onChange(v as any)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ColorControl({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 rounded border cursor-pointer bg-transparent"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "auto"}
          className="font-mono text-xs h-9"
        />
      </div>
    </div>
  );
}

function SortableRow({ block, active, onSelect, onRemove, onDuplicate }: {
  block: Block; active: boolean; onSelect: () => void;
  onRemove: () => void; onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded border ${active ? "border-primary bg-primary/10" : "border-border bg-card"}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground p-1" aria-label="Arrastar">
        <GripVertical className="w-4 h-4" />
      </button>
      <button className="flex-1 text-left text-sm truncate" onClick={onSelect}>
        {BLOCK_LABELS[block.kind]}
      </button>
      <button className="text-muted-foreground hover:text-foreground p-1" onClick={onDuplicate} aria-label="Duplicar">
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button className="text-muted-foreground hover:text-red-500 p-1" onClick={onRemove} aria-label="Remover">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function EmailTemplateEditor({
  templates, activeId, onActiveChange, onReload, settings, previewEvent, previewArticle,
}: Props) {
  const { toast } = useToast();
  const activeTpl = useMemo(() => templates.find((t) => t.id === activeId) || null, [templates, activeId]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localBlocks, setLocalBlocks] = useState<Block[] | null>(null);
  const [localName, setLocalName] = useState<string>("");

  // Sincroniza com template ativo
  const blocks = localBlocks ?? (activeTpl?.blocks as Block[]) ?? [];
  const currentName = localName || activeTpl?.name || "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setLocalBlocks(arrayMove(blocks, oldIdx, newIdx));
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setLocalBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } as Block : b)));
  };

  const addBlock = (kind: Block["kind"]) => {
    setLocalBlocks([...blocks, defaultForKind(kind)]);
  };

  const removeBlock = (id: string) => {
    setLocalBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const clone = { ...blocks[idx], id: newBlockId() };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    setLocalBlocks(next);
  };

  const saveTemplate = async () => {
    if (!activeTpl?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("email_templates")
        .update({ blocks, name: currentName })
        .eq("id", activeTpl.id);
      if (error) throw error;
      toast({ title: "Template salvo" });
      setLocalBlocks(null);
      setLocalName("");
      await onReload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async (
    presetKey?: "event_new" | "ticket_batch" | "weekly_digest",
  ) => {
    try {
      const preset = presetKey ? TEMPLATE_PRESETS.find((p) => p.key === presetKey) : null;
      const defaultName = preset ? preset.name : "Novo template";
      const name = prompt("Nome do novo template:", defaultName);
      if (!name) return;
      const blocks = preset
        ? buildPresetBlocks(preset.key)
        : [defaultForKind("header"), defaultForKind("hero_image"), defaultForKind("title"), defaultForKind("cta_button"), defaultForKind("footer")];
      const { data, error } = await (supabase.from as any)("email_templates")
        .insert({
          name,
          type: preset ? preset.key : "custom",
          blocks,
          subject_template: preset?.subject_template ?? null,
          preheader_template: preset?.preheader_template ?? null,
        })
        .select().single();
      if (error) throw error;
      await onReload();
      onActiveChange(data.id);
      toast({ title: preset ? `Template criado a partir do preset "${preset.name}"` : "Template criado" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const duplicateTemplate = async () => {
    if (!activeTpl) return;
    try {
      const { data, error } = await (supabase.from as any)("email_templates")
        .insert({
          name: `${activeTpl.name} (cópia)`,
          type: "custom",
          blocks: activeTpl.blocks,
          subject_template: activeTpl.subject_template,
          preheader_template: activeTpl.preheader_template,
        })
        .select().single();
      if (error) throw error;
      await onReload();
      onActiveChange(data.id);
      toast({ title: "Template duplicado" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const deleteTemplate = async () => {
    if (!activeTpl?.id || activeTpl.is_default) return;
    if (!confirm(`Excluir "${activeTpl.name}"? Não é possível desfazer.`)) return;
    try {
      const { error } = await (supabase.from as any)("email_templates").delete().eq("id", activeTpl.id);
      if (error) throw error;
      await onReload();
      toast({ title: "Template excluído" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const previewHtml = useMemo(
    () => renderBlockedTemplate(blocks, previewEvent, settings, previewArticle),
    [blocks, previewEvent, settings, previewArticle],
  );

  return (
    <div className="space-y-4">
      {/* Barra superior: seletor de template + ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px]">
          <Label className="text-xs">Template ativo</Label>
          <Select value={activeId || ""} onValueChange={onActiveChange}>
            <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id!} value={t.id!}>
                  {t.name} {t.is_default && "· padrão"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Criar a partir de preset</DropdownMenuLabel>
            {TEMPLATE_PRESETS.map((p) => (
              <DropdownMenuItem key={p.key} onClick={() => createTemplate(p.key)} className="flex-col items-start gap-0.5">
                <span className="font-medium">{p.name}</span>
                <span className="text-[11px] text-muted-foreground whitespace-normal">{p.description}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => createTemplate()}>Em branco</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={duplicateTemplate} disabled={!activeTpl}><Copy className="w-4 h-4 mr-1" />Duplicar</Button>
        <Button size="sm" variant="outline" onClick={deleteTemplate} disabled={!activeTpl || activeTpl.is_default}>
          <Trash2 className="w-4 h-4 mr-1" />Excluir
        </Button>
        <Button size="sm" onClick={saveTemplate} disabled={!activeTpl || saving || localBlocks === null && !localName}>
          <Save className="w-4 h-4 mr-1" />{saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {activeTpl && (
        <div>
          <Label className="text-xs">Nome do template</Label>
          <Input value={currentName} onChange={(e) => setLocalName(e.target.value)} placeholder="Nome do template" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
        {/* Lista de blocos */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Blocos do e-mail</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {blocks.map((b) => (
                    <SortableRow
                      key={b.id}
                      block={b}
                      active={selectedBlockId === b.id}
                      onSelect={() => setSelectedBlockId(b.id)}
                      onRemove={() => removeBlock(b.id)}
                      onDuplicate={() => duplicateBlock(b.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="pt-3 border-t mt-3">
              <Label className="text-xs mb-1 block">Adicionar bloco</Label>
              <Select onValueChange={(v) => addBlock(v as Block["kind"])}>
                <SelectTrigger><SelectValue placeholder="Escolher tipo" /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_BLOCKS.map((k) => (
                    <SelectItem key={k} value={k}>{BLOCK_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Painel de propriedades */}
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Propriedades</div>
            {!selectedBlock && (
              <p className="text-sm text-muted-foreground">Clique num bloco à esquerda para editar suas propriedades.</p>
            )}
            {selectedBlock && <BlockPropsPanel block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />}
          </CardContent>
        </Card>

        {/* Preview — A2 fix: iframe fixado em 600px (largura real do e-mail).
            Container com scroll horizontal em telas estreitas, para que o logo
            e todas as imagens apareçam no mesmo tamanho que o cliente receberá. */}
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview ao vivo (600px reais)</div>
              <div className="text-[10px] text-muted-foreground">≈ largura real na caixa de entrada</div>
            </div>
            <div className="overflow-x-auto rounded border bg-[#050505] p-2">
              <iframe
                title="preview"
                srcDoc={previewHtml}
                width={600}
                className="block mx-auto h-[900px] bg-white"
                style={{ width: 600, minWidth: 600, border: 0 }}
                sandbox=""
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Painel de propriedades por tipo de bloco
// ============================================

function BlockPropsPanel({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  switch (block.kind) {
    case "header":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Altura do logo: {block.logo_height ?? 64}px</Label>
            <Slider
              min={32} max={120} step={4}
              value={[block.logo_height ?? 64]}
              onValueChange={(v) => onChange({ logo_height: v[0] } as any)}
            />
          </div>
          <p className="text-xs text-muted-foreground">O logo em si é definido na aba "Template (marca)".</p>
        </div>
      );

    case "eyebrow":
      return (
        <div>
          <Label className="text-xs">Texto</Label>
          <Input value={block.text || ""} onChange={(e) => onChange({ text: e.target.value } as any)} />
        </div>
      );

    case "cta_button":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto do botão</Label>
            <Input value={block.label || ""} onChange={(e) => onChange({ label: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Link do botão</Label>
            <Select value={block.url_field || "ticket_link"} onValueChange={(v) => onChange({ url_field: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ticket_link">Link de ingresso do evento</SelectItem>
                <SelectItem value="vip_link">Link VIP do evento</SelectItem>
                <SelectItem value="event_url">Página do evento no site</SelectItem>
                <SelectItem value="custom">URL personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.url_field === "custom" && (
            <div>
              <Label className="text-xs">URL personalizada</Label>
              <Input value={block.custom_url || ""} onChange={(e) => onChange({ custom_url: e.target.value } as any)} placeholder="https://…" />
            </div>
          )}
        </div>
      );

    case "secondary_link":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Input value={block.label || ""} onChange={(e) => onChange({ label: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Link</Label>
            <Select value={block.url_field || "agenda_url"} onValueChange={(v) => onChange({ url_field: v as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agenda_url">Agenda completa</SelectItem>
                <SelectItem value="event_url">Página do evento</SelectItem>
                <SelectItem value="custom">URL personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.url_field === "custom" && (
            <Input value={block.custom_url || ""} onChange={(e) => onChange({ custom_url: e.target.value } as any)} placeholder="https://…" />
          )}
        </div>
      );

    case "image_with_link":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL da imagem</Label>
            <Input value={block.image_url} onChange={(e) => onChange({ image_url: e.target.value } as any)} placeholder="https://…" />
          </div>
          <div>
            <Label className="text-xs">Link ao clicar</Label>
            <Input value={block.link_url} onChange={(e) => onChange({ link_url: e.target.value } as any)} placeholder="https://…" />
          </div>
          <div>
            <Label className="text-xs">Texto alternativo (alt)</Label>
            <Input value={block.alt || ""} onChange={(e) => onChange({ alt: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Largura máxima: {block.max_width ?? 552}px</Label>
            <Slider min={200} max={600} step={20} value={[block.max_width ?? 552]} onValueChange={(v) => onChange({ max_width: v[0] } as any)} />
          </div>
        </div>
      );

    case "text":
      return (
        <div>
          <Label className="text-xs">HTML (tags básicas)</Label>
          <Textarea rows={6} value={block.html || ""} onChange={(e) => onChange({ html: e.target.value } as any)} />
          <p className="text-xs text-muted-foreground mt-1">Tags de script, style, iframe e handlers on* são removidos.</p>
        </div>
      );

    case "social_icons":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Ative e informe a URL de cada rede. Somente as ativadas com URL aparecem no e-mail.</p>
          {(block.networks || []).map((n, i) => (
            <div key={n.id} className="flex items-center gap-2 p-2 rounded border">
              <Switch checked={n.enabled} onCheckedChange={(v) => {
                const next = [...(block.networks || [])];
                next[i] = { ...n, enabled: v };
                onChange({ networks: next } as any);
              }} />
              <div className="flex-1">
                <div className="text-xs font-medium">{n.label}</div>
                <Input
                  className="h-7 text-xs mt-1"
                  value={n.url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...(block.networks || [])];
                    next[i] = { ...n, url: e.target.value };
                    onChange({ networks: next } as any);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      );

    case "footer":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto do rodapé (opcional — usa o padrão se vazio)</Label>
            <Textarea rows={3} value={block.text || ""} onChange={(e) => onChange({ text: e.target.value } as any)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={block.include_unsubscribe !== false} onCheckedChange={(v) => onChange({ include_unsubscribe: v } as any)} />
            <Label className="text-xs">Incluir botão "Descadastrar-se" (oficial E-goi)</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            O link usa o placeholder <code className="bg-muted px-1 rounded">[E-GOI_UNSUBSCRIBE_LINK]</code>, que a E-goi substitui automaticamente pelo link oficial rastreável no momento do envio.
          </p>
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">Este bloco não tem propriedades editáveis — sua aparência vem dos dados do evento e das configurações de marca.</p>;
  }
}
