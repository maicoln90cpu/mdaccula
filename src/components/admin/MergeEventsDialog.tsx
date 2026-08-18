import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { formatEventDateRange } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUploadWithCrop } from '@/components/ui/ImageUploadWithCrop';
import { uploadImageWithThumb } from '@/lib/bunnyUploader';
import {
  hasDistinctTicketLinks,
  buildMergeShellPayload,
  type MergeableEventRow,
} from '@/lib/eventMergeHelper';

interface MergeableEvent {
  id: string;
  title: string;
  slug: string;
  date: string;
  end_date?: string | null;
  venue: string;
  views?: number | null;
  blog_post_id?: string | null;
  ticket_link?: string | null;
  image_url?: string | null;
  is_merge_shell?: boolean;
  merged_into_id?: string | null;
}

interface MergeEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MergeableEvent[];
  onSuccess: () => void;
}

/**
 * Mescla 2+ eventos criando 1 evento NOVO ("card-vitrine", is_merge_shell=true)
 * que herda nome/imagem/venue escolhidos + schedule/views agregados.
 * Os eventos selecionados NUNCA são alterados — só recebem
 * status='merged_inactive' + merged_into_id apontando pro card novo.
 * Desfazer (UndoMergeDialog) é sempre possível, em qualquer momento, porque
 * não existe nenhum dado original pra restaurar.
 */
export const MergeEventsDialog = ({
  open,
  onOpenChange,
  events,
  onSuccess,
}: MergeEventsDialogProps) => {
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [ticketsPerDay, setTicketsPerDay] = useState<boolean | null>(null);
  const [mergedTitle, setMergedTitle] = useState<string>('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [imageMode, setImageMode] = useState<'existing' | 'upload'>('existing');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const seed = events[0];

  const dateRange = useMemo(() => {
    if (!events.length) return null;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0].date;
    const end = sorted[sorted.length - 1].end_date || sorted[sorted.length - 1].date;
    return { start, end };
  }, [events]);

  const hasDistinctLinks = useMemo(() => hasDistinctTicketLinks(events), [events]);

  useEffect(() => {
    if (open) {
      setTicketsPerDay(hasDistinctLinks);
    }
  }, [open, hasDistinctLinks]);

  // Reseta tudo sempre que o modal abre pra um NOVO grupo de eventos (o
  // componente fica montado o tempo todo em EventsManager).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTitleTouched(false);
      setImageMode('existing');
      setSelectedImageUrl(seed?.image_url ?? null);
      setUploadedImageFile(null);
    }
    wasOpenRef.current = open;
  }, [open, seed]);

  // Sugere o nome com o título do primeiro evento marcado — só enquanto o
  // admin não tiver digitado nada (mesma proteção da R-024 original).
  useEffect(() => {
    if (open && seed && !titleTouched) {
      setMergedTitle(seed.title);
    }
  }, [open, seed, titleTouched]);

  const effectiveTicketsPerDay = ticketsPerDay ?? hasDistinctLinks;
  const effectiveTitle = (mergedTitle.trim() || seed?.title || '').trim();

  const handleMerge = async () => {
    if (!seed || !dateRange) return;

    if (events.some((e) => e.is_merge_shell || !!e.merged_into_id)) {
      toast({
        variant: 'destructive',
        title: 'Seleção inválida',
        description: 'Um dos eventos selecionados já faz parte de outra mesclagem.',
      });
      return;
    }

    setMerging(true);
    try {
      const allIds = events.map((e) => e.id);

      const { data: fullEvents, error: fetchErr } = await supabase
        .from('events')
        .select('*')
        .in('id', allIds);
      if (fetchErr) throw fetchErr;
      if (!fullEvents || fullEvents.length !== allIds.length) {
        throw new Error('Não foi possível carregar todos os eventos selecionados.');
      }

      let effectiveImageUrl = selectedImageUrl;
      if (imageMode === 'upload') {
        if (!uploadedImageFile) {
          throw new Error('Selecione uma imagem antes de continuar.');
        }
        logger.debug('[merge] fazendo upload da imagem do festival');
        const uploadedUrl = await uploadImageWithThumb(uploadedImageFile, 'event-images', {
          medium: true,
        });
        if (!uploadedUrl) throw new Error('Falha no upload da imagem do festival.');
        effectiveImageUrl = uploadedUrl;
      }

      const payload = buildMergeShellPayload(
        fullEvents as unknown as MergeableEventRow[],
        seed.id,
        {
          title: effectiveTitle,
          imageUrl: effectiveImageUrl,
          ticketsPerDay: effectiveTicketsPerDay,
        }
      );

      logger.debug('[merge] criando card-vitrine', { title: payload.title });
      const { data: shell, error: insertErr } = await supabase
        .from('events')
        .insert([payload])
        .select()
        .single();
      if (insertErr) throw insertErr;

      logger.debug('[merge] escondendo eventos originais', { count: allIds.length });
      const { error: updateErr } = await supabase
        .from('events')
        .update({
          status: 'merged_inactive',
          merged_into_id: shell.id,
          merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', allIds);
      if (updateErr) throw updateErr;

      try {
        localStorage.removeItem('mdaccula-events-cache');
      } catch {
        // localStorage indisponível — segue sem quebrar
      }
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: 'Eventos mesclados!',
        description: `${events.length} eventos viraram 1 festival de ${formatEventDateRange(payload.date, payload.end_date)}.`,
      });

      try {
        await Promise.resolve(onSuccess());
      } catch (cbErr) {
        logger.warn('[merge] onSuccess callback falhou (não bloqueia merge):', cbErr);
      }
      setMerging(false);
      onOpenChange(false);
      setConfirming(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('[MergeEventsDialog] Erro ao mesclar:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao mesclar eventos',
        description: message || 'Tente novamente. Nenhuma alteração foi salva.',
      });
      setMerging(false);
    }
  };

  if (!events.length || !dateRange) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (merging) return;
        if (!o) setConfirming(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar {events.length} eventos em 1 festival</DialogTitle>
          <DialogDescription>
            Cria um evento novo cobrindo{' '}
            <strong>{formatEventDateRange(dateRange.start, dateRange.end)}</strong>. Os{' '}
            {events.length} eventos selecionados ficam escondidos (não deletados) — nenhum dado
            deles é alterado, e você pode desfazer quando quiser.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 space-y-1">
                <Label className="text-base">Eventos selecionados:</Label>
                {events.map((e) => (
                  <div key={e.id} className="text-sm text-muted-foreground">
                    {e.title} — {e.date}
                    {e.end_date && e.end_date !== e.date ? ` → ${e.end_date}` : ''}
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="merged-title" className="text-base">
                  Nome do festival (evento novo):
                </Label>
                <Input
                  id="merged-title"
                  value={mergedTitle}
                  onChange={(e) => {
                    setMergedTitle(e.target.value);
                    setTitleTouched(true);
                  }}
                  placeholder={seed?.title || 'Nome do festival'}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  Sugerido a partir do primeiro evento marcado — edite livremente.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imagem do festival:
                </Label>
                <Tabs
                  value={imageMode}
                  onValueChange={(v) => setImageMode(v as 'existing' | 'upload')}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Usar imagem de um dos eventos</TabsTrigger>
                    <TabsTrigger value="upload">Enviar nova imagem</TabsTrigger>
                  </TabsList>
                  <TabsContent value="existing" className="mt-2">
                    {events.some((e) => e.image_url) ? (
                      <div className="flex flex-wrap gap-2">
                        {events.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedImageUrl(e.image_url ?? null)}
                            title={e.title}
                            className={`rounded border-2 overflow-hidden transition-colors ${
                              selectedImageUrl === (e.image_url ?? null)
                                ? 'border-primary'
                                : 'border-transparent'
                            }`}
                          >
                            {e.image_url ? (
                              <img
                                src={e.image_url}
                                alt={e.title}
                                className="h-16 w-24 object-cover"
                              />
                            ) : (
                              <span className="flex h-16 w-24 items-center justify-center text-[10px] text-muted-foreground bg-muted px-1 text-center">
                                Sem imagem
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nenhum dos eventos selecionados tem imagem.
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2">
                    {uploadedImageFile ? (
                      <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                        <img
                          src={URL.createObjectURL(uploadedImageFile)}
                          alt="Preview"
                          className="h-16 w-24 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadedImageFile.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedImageFile(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <ImageUploadWithCrop
                        onImageSelect={setUploadedImageFile}
                        aspectRatio={16 / 9}
                        label=""
                        cropMode="optional"
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ação totalmente reversível — nenhum evento é alterado ou deletado, só escondido.
              </AlertDescription>
            </Alert>

            <div
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                hasDistinctLinks
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-input bg-muted/30'
              }`}
            >
              <Switch
                id="merge-tickets-per-day"
                checked={effectiveTicketsPerDay}
                onCheckedChange={(v) => setTicketsPerDay(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="merge-tickets-per-day" className="cursor-pointer">
                  Um link de venda por dia (festival)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, o botão "Comprar Ingresso" abre um{' '}
                  <strong>modal de seleção do dia</strong>, buscando o link de cada dia direto no
                  evento escondido correspondente (sempre atualizado). Quando desligado, o botão
                  vai direto pro link único (precisa ser o mesmo em todos os eventos).
                </p>
                {hasDistinctLinks && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Detectamos <strong>links de venda diferentes</strong> nos eventos selecionados
                    — recomendamos manter ligado.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Confirmação final.</strong> Vou:
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                  <li>
                    Criar o evento novo <strong>{effectiveTitle}</strong>, cobrindo{' '}
                    {formatEventDateRange(dateRange.start, dateRange.end)}.
                  </li>
                  <li>
                    Esconder os {events.length} eventos selecionados (continuam existindo,
                    intactos, reativáveis a qualquer momento).
                  </li>
                  <li>
                    Definir <strong>"Um link de venda por dia"</strong>:{' '}
                    {effectiveTicketsPerDay ? 'LIGADO (modal por dia)' : 'DESLIGADO (link único)'}.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={merging}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleMerge} disabled={merging}>
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mesclando...
                  </>
                ) : (
                  'Confirmar e mesclar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
