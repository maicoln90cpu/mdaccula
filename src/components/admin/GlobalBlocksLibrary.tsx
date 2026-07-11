/**
 * Biblioteca de blocos globais (Fase C).
 * Permite salvar blocos individuais como "globais" reutilizáveis em vários templates.
 * Ao editar um bloco global, todos os templates que o referenciam recebem a atualização.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Save, Trash2, Library, Pencil,
  Image as ImageIcon, Type, AlignLeft, MousePointerClick, Minus,
  Share2, LayoutGrid, Clock, Map, FileText, Link as LinkIcon, Package,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useEmailGlobalBlocks } from "@/hooks/useEmailGlobalBlocks";
import type { Block, GlobalBlock } from "@/lib/emailTemplates/blocks";
import { BLOCK_LABELS } from "@/lib/emailTemplates/blocks";

// Ícone compacto por tipo de bloco — usado no card da biblioteca no lugar do
// texto redundante "Bloco global (biblioteca)". O nome do bloco global já
// aparece em destaque; o ícone dá a pista visual do que ele contém.
function BlockKindIcon({ kind, className }: { kind: Block["kind"]; className?: string }) {
  const cls = className || "w-3.5 h-3.5";
  switch (kind) {
    case "header": return <ImageIcon className={cls} />;
    case "hero_image":
    case "image_with_link":
    case "static_map": return <ImageIcon className={cls} />;
    case "eyebrow":
    case "title":
    case "subtitle": return <Type className={cls} />;
    case "description":
    case "text":
    case "article_summary": return <AlignLeft className={cls} />;
    case "cta_button":
    case "secondary_link": return <MousePointerClick className={cls} />;
    case "divider": return <Minus className={cls} />;
    case "social_icons": return <Share2 className={cls} />;
    case "weekend_grid":
    case "weekly_hero":
    case "event_meta": return <LayoutGrid className={cls} />;
    case "countdown":
    case "ticker": return <Clock className={cls} />;
    case "blog_posts_list": return <FileText className={cls} />;
    case "lineup": return <LinkIcon className={cls} />;
    case "dedge_block": return <Package className={cls} />;
    case "footer": return <AlignLeft className={cls} />;
    default: return <Library className={cls} />;
  }
}

interface Props {
  selectedBlock: Block | null;
  onInsert: (block: Block) => void;
}

export function GlobalBlocksLibrary({ selectedBlock, onInsert }: Props) {
  const { toast } = useToast();
  const { globals, loading, saveAsGlobal, updateGlobal, deleteGlobal } = useEmailGlobalBlocks();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalBlock | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "geral" });

  const openSaveDialog = () => {
    if (!selectedBlock) return;
    if (selectedBlock.kind === "global_ref") {
      toast({ variant: "destructive", title: "Não é possível", description: "Já é um bloco global. Edite o original." });
      return;
    }
    setForm({ name: BLOCK_LABELS[selectedBlock.kind] || "Bloco", description: "", category: "geral" });
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedBlock || !form.name.trim()) return;
    try {
      await saveAsGlobal(selectedBlock, form);
      toast({ title: "Bloco salvo na biblioteca" });
      setSaveDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const handleInsertRef = (g: GlobalBlock) => {
    onInsert({
      id: `b${Date.now()}${Math.floor(Math.random() * 1000)}`,
      kind: "global_ref",
      global_id: g.id,
      _cached_name: g.name,
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    try {
      await updateGlobal(editing.id, {
        name: editing.name,
        description: editing.description || null,
        category: editing.category,
      });
      toast({ title: "Bloco global atualizado — todos os templates refletirão a mudança" });
      setEditing(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  const handleDelete = async (g: GlobalBlock) => {
    if (!confirm(`Excluir "${g.name}"? Templates que referenciam este bloco exibirão um aviso de indisponível.`)) return;
    try {
      await deleteGlobal(g.id);
      toast({ title: "Bloco global excluído" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  // Agrupa por categoria
  const grouped = globals.reduce<Record<string, GlobalBlock[]>>((acc, g) => {
    (acc[g.category] ||= []).push(g);
    return acc;
  }, {});

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Biblioteca de blocos globais
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={openSaveDialog}
            disabled={!selectedBlock || selectedBlock.kind === "global_ref"}
            title={
              !selectedBlock
                ? "Selecione um bloco à esquerda"
                : selectedBlock.kind === "global_ref"
                ? "Este bloco já é uma referência global"
                : "Salvar bloco selecionado na biblioteca"
            }
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Salvar como global
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Blocos globais são <strong>compartilhados</strong>: editar aqui atualiza todos os templates que os usam automaticamente.
        </p>

        {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}

        {!loading && globals.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Nenhum bloco global ainda. Selecione um bloco no editor e clique em "Salvar como global".
          </p>
        )}

        {!loading && globals.length > 0 && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {cat}
                </div>
                <div className="space-y-1">
                  {items.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-1 p-2 rounded border border-border bg-card/60 hover:bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate flex items-center gap-1.5">
                          <BlockKindIcon kind={g.block.kind} />
                          <span className="truncate">{g.name}</span>
                        </div>
                        {g.description && (
                          <div className="text-[10px] text-muted-foreground truncate pl-5">
                            {g.description}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => handleInsertRef(g)}
                        title={`Inserir referência a "${g.name}" no template atual`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditing(g)}
                        title="Editar nome/descrição"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(g)}
                        title="Excluir bloco global"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog: salvar como global */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar bloco na biblioteca global</DialogTitle>
              <DialogDescription>
                Este bloco ficará disponível para todos os templates. Ao editá-lo aqui,
                todos os templates que o referenciam refletirão a mudança automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Rodapé padrão MDAccula"
                />
              </div>
              <div>
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Onde e quando usar este bloco"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="geral, rodape, header, cta…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>
                Salvar na biblioteca
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: editar global (meta apenas — o conteúdo do bloco é editado abrindo um template que o referencia) */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar bloco global</DialogTitle>
              <DialogDescription>
                Alterar nome, descrição e categoria. Para editar o <strong>conteúdo</strong> do bloco,
                use a página "Blocos Globais" (roadmap) ou refaça o salvamento a partir de um template.
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={editing.description || ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Input
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleEditSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
