import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Plus, Edit2, Trash2, Star, StarOff, CheckCircle2, XCircle, Eye } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  user_prompt_template: string;
  required_fields: Json;
  is_default: boolean | null;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const PromptTemplatesManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Eventos",
    system_prompt: "",
    user_prompt_template: "",
    required_fields: {} as Record<string, boolean>,
    enabled: true,
  });

  const [fieldKey, setFieldKey] = useState("");
  const [fieldRequired, setFieldRequired] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ai_prompt_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize required_fields from array to object
  const normalizeRequiredFields = (fields: unknown): Record<string, boolean> => {
    if (!fields) return {};
    
    // If it's already an object, use it directly
    if (typeof fields === 'object' && !Array.isArray(fields)) {
      return fields as Record<string, boolean>;
    }
    
    // If it's an array, convert to object
    if (Array.isArray(fields)) {
      return fields.reduce((acc, field) => {
        if (typeof field === 'string') {
          acc[field] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    }
    
    return {};
  };

  const handleOpenDialog = (template?: PromptTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || "",
        category: template.category || "Eventos",
        system_prompt: template.system_prompt,
        user_prompt_template: template.user_prompt_template,
        required_fields: normalizeRequiredFields(template.required_fields),
        enabled: template.enabled ?? true,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        description: "",
        category: "Eventos",
        system_prompt: "",
        user_prompt_template: "",
        required_fields: {},
        enabled: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFieldKey("");
    setFieldRequired(true);
  };

  const handleAddField = () => {
    if (!fieldKey.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite o nome do campo",
        variant: "destructive",
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      required_fields: {
        ...prev.required_fields,
        [fieldKey]: fieldRequired,
      },
    }));
    setFieldKey("");
    setFieldRequired(true);
  };

  const handleRemoveField = (key: string) => {
    setFormData(prev => {
      const newFields = { ...prev.required_fields };
      delete newFields[key];
      return { ...prev, required_fields: newFields };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim() || !formData.user_prompt_template.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, System Prompt e User Prompt Template são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("ai_prompt_templates")
          .update({
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            system_prompt: formData.system_prompt,
            user_prompt_template: formData.user_prompt_template,
            required_fields: formData.required_fields,
            enabled: formData.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Template atualizado",
          description: "As alterações foram salvas com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("ai_prompt_templates")
          .insert({
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            system_prompt: formData.system_prompt,
            user_prompt_template: formData.user_prompt_template,
            required_fields: formData.required_fields,
            enabled: formData.enabled,
            is_default: false,
          });

        if (error) throw error;

        toast({
          title: "Template criado",
          description: "Novo template adicionado com sucesso",
        });
      }

      handleCloseDialog();
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleEnabled = async (template: PromptTemplate) => {
    try {
      const { error } = await supabase
        .from("ai_prompt_templates")
        .update({ enabled: !template.enabled })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: template.enabled ? "Template desativado" : "Template ativado",
      });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (template: PromptTemplate) => {
    try {
      // Unset all defaults in the same category
      const { error: unsetError } = await supabase
        .from("ai_prompt_templates")
        .update({ is_default: false })
        .eq("category", template.category);

      if (unsetError) throw unsetError;

      // Set the new default
      const { error: setError } = await supabase
        .from("ai_prompt_templates")
        .update({ is_default: true })
        .eq("id", template.id);

      if (setError) throw setError;

      toast({
        title: "Template padrão definido",
        description: `"${template.name}" agora é o padrão para ${template.category}`,
      });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao definir padrão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ai_prompt_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Template deletado",
        description: "Template removido com sucesso",
      });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 pt-24 pb-16">
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Carregando templates...</p>
            </div>
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <NavLink to="/admin">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </NavLink>
                <div>
                  <h1 className="text-4xl font-bold hero-text">Templates de Prompts</h1>
                  <p className="text-muted-foreground mt-1">
                    Gerencie templates de IA para diferentes tipos de conteúdo
                  </p>
                </div>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Templates Disponíveis</CardTitle>
                <CardDescription>
                  {templates.length} template{templates.length !== 1 ? "s" : ""} cadastrado
                  {templates.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum template encontrado. Crie seu primeiro template!
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Padrão</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              {template.description && (
                                <div className="text-sm text-muted-foreground">
                                  {template.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{template.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {template.enabled ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="w-3 h-3" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {template.is_default && (
                              <Badge variant="default" className="gap-1">
                                <Star className="w-3 h-3 fill-current" />
                                Padrão
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(template)}
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleEnabled(template)}
                                title={template.enabled ? "Desativar" : "Ativar"}
                              >
                                {template.enabled ? (
                                  <XCircle className="w-4 h-4" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSetDefault(template)}
                                title="Definir como padrão"
                                disabled={template.is_default}
                              >
                                {template.is_default ? (
                                  <Star className="w-4 h-4 fill-current" />
                                ) : (
                                  <StarOff className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmId(template.id)}
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              Configure o template de prompt para geração de conteúdo com IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Evento Padrão"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Eventos">Eventos</SelectItem>
                    <SelectItem value="Multi-Eventos">Multi-Eventos</SelectItem>
                    <SelectItem value="Entrevistas">Entrevistas</SelectItem>
                    <SelectItem value="Reviews">Reviews</SelectItem>
                    <SelectItem value="Festivais">Festivais</SelectItem>
                    <SelectItem value="Lançamentos">Lançamentos</SelectItem>
                    <SelectItem value="Labels">Labels</SelectItem>
                    <SelectItem value="Sugestões">Sugestões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição do template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_prompt">System Prompt *</Label>
              <Textarea
                id="system_prompt"
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="Você é um especialista em..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="user_prompt_template">User Prompt Template *</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="h-8 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              </div>
              <Textarea
                id="user_prompt_template"
                value={formData.user_prompt_template}
                onChange={(e) =>
                  setFormData({ ...formData, user_prompt_template: e.target.value })
                }
                placeholder="Use {{variavel}} para campos dinâmicos e {{#if variavel}}...{{/if}} para condicionais"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{"{{campo}}"}</code> para inserir
                valores e <code className="bg-muted px-1 rounded">{"{{#if campo}}...{{/if}}"}</code>{" "}
                para condicionais
              </p>
            </div>

            <div className="space-y-2">
              <Label>Campos Obrigatórios</Label>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do campo"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                  />
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Switch
                      checked={fieldRequired}
                      onCheckedChange={setFieldRequired}
                    />
                    <span className="text-sm">Obrigatório</span>
                  </div>
                  <Button onClick={handleAddField} type="button">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {Object.keys(formData.required_fields).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(formData.required_fields).map(([key, required]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between bg-muted p-2 rounded"
                      >
                        <span className="font-mono text-sm">
                          {key} {required && <Badge variant="secondary">obrigatório</Badge>}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveField(key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Template ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview do Prompt com Dados de Exemplo
            </DialogTitle>
            <DialogDescription>
              Visualize como o prompt ficará com valores de exemplo
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 p-1">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Valores de exemplo utilizados:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>seriesName:</strong> DEDGE SP</div>
                  <div><strong>venue:</strong> D-Edge São Paulo</div>
                  <div><strong>city:</strong> São Paulo</div>
                  <div><strong>state:</strong> SP</div>
                  <div><strong>startDate:</strong> 24/01/2026</div>
                  <div><strong>endDate:</strong> 26/01/2026</div>
                  <div><strong>genres:</strong> Techno, House</div>
                  <div><strong>eventName:</strong> Nome do Evento</div>
                  <div><strong>artistName:</strong> Artista Exemplo</div>
                  <div><strong>topic:</strong> Tópico do Artigo</div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">System Prompt:</p>
                <pre className="p-4 rounded-lg bg-background border text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {formData.system_prompt || "(vazio)"}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">User Prompt (com variáveis substituídas):</p>
                <pre className="p-4 rounded-lg bg-background border text-xs font-mono whitespace-pre-wrap">
                  {(() => {
                    let prompt = formData.user_prompt_template || "(vazio)";
                    const sampleValues: Record<string, string> = {
                      seriesName: "DEDGE SP",
                      venue: "D-Edge São Paulo",
                      city: "São Paulo",
                      state: "SP",
                      startDate: "24/01/2026",
                      endDate: "26/01/2026",
                      genres: "Techno, House, Minimal",
                      dates: "[Programação detalhada seria inserida aqui]",
                      additionalContext: "Evento especial comemorativo.",
                      eventName: "Nome do Evento Exemplo",
                      artistName: "Artista Exemplo",
                      festivalName: "Festival Exemplo",
                      topic: "Tópico do Artigo",
                      summary: "Resumo breve do artigo",
                      category: "Eventos",
                    };
                    Object.entries(sampleValues).forEach(([key, value]) => {
                      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), `【${value}】`);
                    });
                    return prompt;
                  })()}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  <strong>Legenda:</strong> Valores entre 【colchetes】 são os dados de exemplo substituídos.
                  Variáveis não substituídas permanecem como {"{{variavel}}"}.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default PromptTemplatesManager;
