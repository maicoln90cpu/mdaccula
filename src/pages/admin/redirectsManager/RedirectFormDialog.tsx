/**
 * RedirectFormDialog — modal de criar/editar link redirecionador.
 * Extraído na Onda 11 sem alterações de comportamento.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import {
  UTM_SOURCE_OPTIONS,
  UTM_MEDIUM_OPTIONS,
  type FormData,
} from './types';

interface RedirectFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  form: FormData;
  setForm: (f: FormData) => void;
  customSource: boolean;
  setCustomSource: (v: boolean) => void;
  customMedium: boolean;
  setCustomMedium: (v: boolean) => void;
  defaultSource: string;
  defaultMedium: string;
  siteUrl: string;
  isSaving: boolean;
  onSubmit: (form: FormData) => void;
}

export const RedirectFormDialog = ({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  customSource,
  setCustomSource,
  customMedium,
  setCustomMedium,
  defaultSource,
  defaultMedium,
  siteUrl,
  isSaving,
  onSubmit,
}: RedirectFormDialogProps) => {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Link' : 'Novo Link'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.slug || !form.destination_url) {
              toast({ title: 'Preencha slug e URL de destino', variant: 'destructive' });
              return;
            }
            onSubmit(form);
          }}
        >
          <div>
            <Label>Slug (identificador curto)</Label>
            <div className="flex items-center gap-1 mt-1">
              <span className="min-w-0 max-w-[45%] truncate text-xs text-muted-foreground">
                {siteUrl}/r/
              </span>
              <Input
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })
                }
                placeholder="whatsapp-carnaval"
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <Label>URL de destino</Label>
            <Input
              value={form.destination_url}
              onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
              placeholder="https://chat.whatsapp.com/..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>Descrição (interna)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Grupo WhatsApp do Carnaval"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">UTM Source</Label>
              {customSource ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    value={form.utm_source}
                    onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                    placeholder="fonte personalizada"
                    className="flex-1 h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs px-2"
                    onClick={() => {
                      setCustomSource(false);
                      setForm({ ...form, utm_source: defaultSource });
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.utm_source || '__empty__'}
                  onValueChange={(v) => {
                    if (v === '__custom__') {
                      setCustomSource(true);
                      setForm({ ...form, utm_source: '' });
                    } else if (v === '__empty__') {
                      setForm({ ...form, utm_source: '' });
                    } else {
                      setForm({ ...form, utm_source: v });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UTM_SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Personalizado...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-xs">UTM Medium</Label>
              {customMedium ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    value={form.utm_medium}
                    onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                    placeholder="medium personalizado"
                    className="flex-1 h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs px-2"
                    onClick={() => {
                      setCustomMedium(false);
                      setForm({ ...form, utm_medium: defaultMedium });
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.utm_medium || '__empty__'}
                  onValueChange={(v) => {
                    if (v === '__custom__') {
                      setCustomMedium(true);
                      setForm({ ...form, utm_medium: '' });
                    } else if (v === '__empty__') {
                      setForm({ ...form, utm_medium: '' });
                    } else {
                      setForm({ ...form, utm_medium: v });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UTM_MEDIUM_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Personalizado...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-xs">UTM Campaign</Label>
              <Input
                value={form.utm_campaign}
                onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                placeholder="carnaval-2026"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">UTM Content</Label>
              <Input
                value={form.utm_content}
                onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                placeholder="whatsapp-grupo"
                className="mt-1"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar link'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
