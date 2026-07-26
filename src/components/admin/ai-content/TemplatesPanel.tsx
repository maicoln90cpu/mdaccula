import { useState, useEffect, useCallback } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import { TemplatesTable } from './templatesPanel/TemplatesTable';
import { TemplateFormDialog } from './templatesPanel/TemplateFormDialog';
import {
  EMPTY_FORM,
  normalizeRequiredFields,
  type PromptTemplate,
  type TemplateFormData,
} from './templatesPanel/types';

export function TemplatesPanel() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(EMPTY_FORM);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar templates',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useRealtimeTable('ai_prompt_templates', () => fetchTemplates());

  const handleOpenDialog = (template?: PromptTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category || 'Eventos',
        system_prompt: template.system_prompt,
        user_prompt_template: template.user_prompt_template,
        required_fields: normalizeRequiredFields(template.required_fields),
        enabled: template.enabled ?? true,
      });
    } else {
      setEditingTemplate(null);
      setFormData(EMPTY_FORM);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    if (
      !formData.name.trim() ||
      !formData.system_prompt.trim() ||
      !formData.user_prompt_template.trim()
    ) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome, System Prompt e User Prompt Template são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('ai_prompt_templates')
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
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: 'Template atualizado',
          description: 'As alterações foram salvas com sucesso',
        });
      } else {
        const { error } = await supabase.from('ai_prompt_templates').insert({
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
          title: 'Template criado',
          description: 'Novo template adicionado com sucesso',
        });
      }

      handleCloseDialog();
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao salvar template',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleEnabled = async (template: PromptTemplate) => {
    try {
      const { error } = await supabase
        .from('ai_prompt_templates')
        .update({ enabled: !template.enabled })
        .eq('id', template.id);

      if (error) throw error;

      toast({ title: template.enabled ? 'Template desativado' : 'Template ativado' });
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao alterar status',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (template: PromptTemplate) => {
    try {
      const { error: unsetError } = await supabase
        .from('ai_prompt_templates')
        .update({ is_default: false })
        .eq('category', template.category);

      if (unsetError) throw unsetError;

      const { error: setError } = await supabase
        .from('ai_prompt_templates')
        .update({ is_default: true })
        .eq('id', template.id);

      if (setError) throw setError;

      toast({
        title: 'Template padrão definido',
        description: `"${template.name}" agora é o padrão para ${template.category}`,
      });
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao definir padrão',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('ai_prompt_templates').delete().eq('id', id);

      if (error) throw error;

      toast({ title: 'Template deletado', description: 'Template removido com sucesso' });
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao deletar template',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando templates...</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-xl font-semibold">Templates de Prompts</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Gerencie templates de IA para diferentes tipos de conteúdo
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>

        <TemplatesTable
          templates={templates}
          onEdit={handleOpenDialog}
          onToggleEnabled={handleToggleEnabled}
          onSetDefault={handleSetDefault}
          onDelete={setDeleteConfirmId}
        />
      </div>

      <TemplateFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        isEditing={!!editingTemplate}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        onCancel={handleCloseDialog}
      />

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
    </>
  );
}
