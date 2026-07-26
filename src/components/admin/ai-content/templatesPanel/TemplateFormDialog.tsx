import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';
import type { TemplateFormData } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  onSave: () => void;
  onCancel: () => void;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSave,
  onCancel,
}: Props) {
  const { toast } = useToast();
  const [fieldKey, setFieldKey] = useState('');
  const [fieldRequired, setFieldRequired] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleAddField = () => {
    if (!fieldKey.trim()) {
      toast({
        title: 'Campo vazio',
        description: 'Digite o nome do campo',
        variant: 'destructive',
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      required_fields: { ...prev.required_fields, [fieldKey]: fieldRequired },
    }));
    setFieldKey('');
    setFieldRequired(true);
  };

  const handleRemoveField = (key: string) => {
    setFormData((prev) => {
      const newFields = { ...prev.required_fields };
      delete newFields[key];
      return { ...prev, required_fields: newFields };
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>
              Configure o template de prompt para geração de conteúdo com IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                Use <code className="bg-muted px-1 rounded">{'{{campo}}'}</code> para inserir
                valores e{' '}
                <code className="bg-muted px-1 rounded">{'{{#if campo}}...{{/if}}'}</code> para
                condicionais
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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                  />
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Switch checked={fieldRequired} onCheckedChange={setFieldRequired} />
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
            <Button
              variant="outline"
              onClick={() => {
                setFieldKey('');
                setFieldRequired(true);
                onCancel();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={onSave}>
              {isEditing ? 'Salvar Alterações' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        systemPrompt={formData.system_prompt}
        userPromptTemplate={formData.user_prompt_template}
      />
    </>
  );
}
