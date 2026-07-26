/**
 * Dialog de edição de config recorrente.
 * Extraído de src/pages/admin/RecurringEventsManager.tsx (Onda 30).
 */
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { uploadImageWithThumb } from '@/lib/bunnyUploader';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { useState } from 'react';
import type { LinkGroup, RecurringConfig } from './types';

interface EditConfigDialogProps {
  editingConfig: RecurringConfig | null;
  setEditingConfig: (v: RecurringConfig | null) => void;
  linkGroups: LinkGroup[];
  saving: boolean;
  onSave: () => void;
}

export const EditConfigDialog = ({
  editingConfig,
  setEditingConfig,
  linkGroups,
  saving,
  onSave,
}: EditConfigDialogProps) => {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);

  return (
    <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {editingConfig?.name}</DialogTitle>
          <DialogDescription>Altere as configurações do evento recorrente</DialogDescription>
        </DialogHeader>
        {editingConfig && (
          <div className="space-y-4">
            <div>
              <Label>Título do Evento</Label>
              <Input
                value={editingConfig.title}
                onChange={(e) => setEditingConfig({ ...editingConfig, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input
                value={editingConfig.subtitle || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, subtitle: e.target.value })
                }
                placeholder="Ex: Edição Especial, Open Bar..."
              />
            </div>
            <div>
              <Label>Endereço Completo</Label>
              <Input
                value={editingConfig.address || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, address: e.target.value })
                }
                placeholder="Rua, número - bairro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Horário Início</Label>
                <Input
                  type="time"
                  value={editingConfig.time.slice(0, 5)}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, time: e.target.value + ':00' })
                  }
                />
              </div>
              <div>
                <Label>Horário Término</Label>
                <Input
                  type="time"
                  value={editingConfig.end_time?.slice(0, 5) || ''}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      end_time: e.target.value ? e.target.value + ':00' : null,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Descrição do Evento</Label>
              <Textarea
                value={editingConfig.description || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, description: e.target.value })
                }
                placeholder="Descrição completa do evento..."
                rows={3}
              />
            </div>
            <div>
              <Label>Grupo de Links</Label>
              <Select
                value={editingConfig.link_group_id || 'none'}
                onValueChange={(value) =>
                  setEditingConfig({
                    ...editingConfig,
                    link_group_id: value === 'none' ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (não criar link)</SelectItem>
                  {linkGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} {!group.enabled && '(desabilitado)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Se selecionado, o link será criado automaticamente junto com o evento.
              </p>
            </div>
            <div>
              <Label>Link Ingressos</Label>
              <Input
                value={editingConfig.ticket_link || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, ticket_link: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Link Camarote</Label>
              <Input
                value={editingConfig.vip_link || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, vip_link: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Imagem do Evento</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={editingConfig.image_url || ''}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, image_url: e.target.value })
                  }
                  placeholder="https://... ou faça upload"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById('recurring-image-upload')?.click()}
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </Button>
                <input
                  id="recurring-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingImage(true);
                    try {
                      const publicUrl = await uploadImageWithThumb(file, 'event-images', {
                        fullOpts: { maxSizeMB: 0.5, maxDimension: 1200 },
                        medium: true,
                      });
                      setEditingConfig({ ...editingConfig, image_url: publicUrl });
                      toast({
                        title: 'Imagem enviada!',
                        description: 'Upload concluído com sucesso.',
                      });
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro desconhecido';
                      toast({
                        title: 'Erro no upload',
                        description: message,
                        variant: 'destructive',
                      });
                    } finally {
                      setUploadingImage(false);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              {editingConfig.image_url && (
                <img
                  src={getOptimizedImageUrl(editingConfig.image_url)}
                  alt="Preview"
                  className="mt-2 h-20 w-32 object-contain rounded-md bg-muted/20"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingConfig(null)}>
                Cancelar
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
