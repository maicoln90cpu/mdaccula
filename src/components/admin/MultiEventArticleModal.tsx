import { useState, useEffect, useMemo } from "react";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { ImageUploadWithCrop } from "@/components/ui/ImageUploadWithCrop";
import { uploadImageWithThumb } from "@/lib/bunnyUploader";
import { Search, Calendar, MapPin, Music, Loader2, FileText, X, ImageIcon, Upload, Link } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  slug: string;
  venue: string;
  date: string;
  time: string;
  location_city: string;
  location_state: string;
  genres: string[];
  image_url?: string;
  blog_post_id?: string | null;
  description?: string;
  lineup?: string[];
  ticket_link?: string;
  vip_link?: string;
}

interface MultiEventArticleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type EventFilter = "future" | "past" | "all";

export const MultiEventArticleModal = ({ open, onOpenChange, onSuccess }: MultiEventArticleModalProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [seriesName, setSeriesName] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generateImage, setGenerateImage] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("future");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [uploadingImage, setUploadingImage] = useState(false);
  const { toast } = useToast();

  // Fetch events when modal opens
  useEffect(() => {
    if (open) {
      fetchEvents();
      // Reset state on open
      setSelectedEventIds(new Set());
      setSeriesName("");
      setAdditionalContext("");
      setSearchQuery("");
      setEventFilter("future");
      setCustomImageUrl("");
      setUploadedFile(null);
      setImageInputMode("upload");
      setGenerateImage(true);
    }
  }, [open]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar eventos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search query AND date filter
  const filteredEvents = useMemo(() => {
    const today = startOfDay(new Date());
    
    let filtered = events;
    
    // Apply date filter
    if (eventFilter === "future") {
      filtered = filtered.filter(event => !isBefore(parseISO(event.date), today));
    } else if (eventFilter === "past") {
      filtered = filtered.filter(event => isBefore(parseISO(event.date), today));
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.venue.toLowerCase().includes(query) ||
        event.location_city.toLowerCase().includes(query) ||
        event.genres.some(g => g.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [events, searchQuery, eventFilter]);

  // Get selected events
  const selectedEvents = useMemo(() => 
    events.filter(e => selectedEventIds.has(e.id)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, selectedEventIds]
  );

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredEvents.length === selectedEventIds.size) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy (EEE)", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Upload image to storage if needed
  const uploadImageToStorage = async (file: File): Promise<string> => {
    return uploadImageWithThumb(file, 'event-images', { medium: true });
  };

  const handleGenerate = async () => {
    if (selectedEvents.length < 2) {
      toast({
        variant: "destructive",
        title: "Selecione pelo menos 2 eventos",
        description: "Para gerar um artigo multi-datas, selecione 2 ou mais eventos.",
      });
      return;
    }

    if (!seriesName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome da série obrigatório",
        description: "Informe o nome da série/temporada de eventos (ex: BOMA Carnario).",
      });
      return;
    }

    setGenerating(true);

    try {
      let finalImageUrl = customImageUrl;

      // Upload file if provided
      if (uploadedFile && imageInputMode === "upload") {
        setUploadingImage(true);
        try {
          finalImageUrl = await uploadImageToStorage(uploadedFile);
        } catch (uploadError: any) {
          toast({
            variant: "destructive",
            title: "Erro ao fazer upload da imagem",
            description: uploadError.message,
          });
          setGenerating(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      console.log('[MultiEventArticleModal] Iniciando geração multi-evento:', {
        seriesName,
        eventCount: selectedEvents.length,
        eventIds: selectedEvents.map(e => e.id),
        hasCustomImage: !!finalImageUrl,
        hasUploadedFile: !!uploadedFile,
      });

      const { data, error } = await supabase.functions.invoke('generate-multi-event-article', {
        body: {
          eventIds: selectedEvents.map(e => e.id),
          seriesName,
          additionalContext,
          generateImage: finalImageUrl ? false : generateImage,
          customImageUrl: finalImageUrl || undefined
        }
      });

      if (error) throw error;

      if (data?.success && data?.post) {
        toast({
          title: "Artigo consolidado gerado!",
          description: `"${data.post.title}" foi criado e vinculado aos ${selectedEvents.length} eventos.`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(data?.error || 'Resposta inválida da API');
      }
    } catch (error: any) {
      console.error('[MultiEventArticleModal] Erro:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar artigo",
        description: error.message || 'Ocorreu um erro ao gerar o artigo consolidado.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Count events per filter
  const futureCount = useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter(e => !isBefore(parseISO(e.date), today)).length;
  }, [events]);

  const pastCount = useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter(e => isBefore(parseISO(e.date), today)).length;
  }, [events]);

  // Check if user has provided an image
  const hasCustomImage = !!(customImageUrl || uploadedFile);

  // Handle image file selection
  const handleImageSelect = (file: File | null) => {
    setUploadedFile(file);
    if (file) {
      setCustomImageUrl(""); // Clear URL if file is selected
    }
  };

  // Handle removing uploaded image
  const handleRemoveUploadedImage = () => {
    setUploadedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Gerar Artigo Multi-Datas
          </DialogTitle>
          <DialogDescription>
            Selecione múltiplos eventos da mesma série para gerar um artigo consolidado.
          </DialogDescription>
        </DialogHeader>

        {/* Series Name Input */}
        <div className="space-y-2">
          <Label htmlFor="seriesName">Nome da Série/Temporada *</Label>
          <Input
            id="seriesName"
            placeholder="Ex: BOMA Carnario, Parador Reveillon..."
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Filter Tabs */}
        <Tabs value={eventFilter} onValueChange={(v) => setEventFilter(v as EventFilter)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="future" className="flex items-center gap-1.5">
              Futuros
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{futureCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-1.5">
              Passados
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{pastCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              Todos
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{events.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Events List */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[180px] border rounded-md">
              <div className="p-2 space-y-1">
                {/* Select All */}
                {filteredEvents.length > 0 && (
                  <div className="flex items-center gap-2 p-2 mb-2 border-b">
                    <Checkbox
                      checked={filteredEvents.length > 0 && filteredEvents.every(e => selectedEventIds.has(e.id))}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      Selecionar todos ({filteredEvents.length})
                    </span>
                  </div>
                )}

                {filteredEvents.map(event => (
                  <div 
                    key={event.id}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedEventIds.has(event.id) ? 'bg-primary/10 border border-primary/30' : 'border border-transparent'
                    }`}
                    onClick={() => toggleEventSelection(event.id)}
                  >
                    <Checkbox
                      checked={selectedEventIds.has(event.id)}
                      onCheckedChange={() => toggleEventSelection(event.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {event.image_url && (
                      <img 
                        src={getOptimizedImageUrl(event.image_url)} 
                        alt={event.title}
                        className="w-10 h-10 rounded object-contain flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{event.title}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.venue}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredEvents.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhum evento encontrado.
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Selected Events Preview */}
        {selectedEvents.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Selecionados ({selectedEvents.length})</Label>
            <div className="flex flex-wrap gap-1">
              {selectedEvents.slice(0, 5).map(event => (
                <Badge 
                  key={event.id} 
                  variant="outline"
                  className="flex items-center gap-1 text-xs py-0.5"
                >
                  {formatDate(event.date).split(' ')[0]}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive" 
                    onClick={() => toggleEventSelection(event.id)}
                  />
                </Badge>
              ))}
              {selectedEvents.length > 5 && (
                <Badge variant="secondary" className="text-xs py-0.5">
                  +{selectedEvents.length - 5} mais
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Additional Context */}
        <div className="space-y-1">
          <Label htmlFor="additionalContext" className="text-xs">Contexto Adicional (opcional)</Label>
          <Textarea
            id="additionalContext"
            placeholder="Informações extras sobre a série..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>

        {/* Image Section with Tabs */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-2">
            <ImageIcon className="w-3 h-3" />
            Imagem do Artigo (opcional)
          </Label>
          <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as "upload" | "url")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="upload" className="text-xs flex items-center gap-1">
                <Upload className="w-3 h-3" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs flex items-center gap-1">
                <Link className="w-3 h-3" />
                URL
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-2">
              {uploadedFile ? (
                <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                  <img 
                    src={URL.createObjectURL(uploadedFile)} 
                    alt="Preview" 
                    className="h-16 w-24 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRemoveUploadedImage}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <ImageUploadWithCrop
                  onImageSelect={handleImageSelect}
                  aspectRatio={16/9}
                  label=""
                  cropMode="optional"
                />
              )}
            </TabsContent>
            <TabsContent value="url" className="mt-2">
              <Input
                placeholder="https://..."
                value={customImageUrl}
                onChange={(e) => {
                  setCustomImageUrl(e.target.value);
                  setUploadedFile(null); // Clear file if URL is entered
                }}
                className="text-sm"
              />
              {customImageUrl && (
                <div className="mt-2">
                  <img 
                    src={customImageUrl} 
                    alt="Preview" 
                    className="h-16 w-24 object-cover rounded border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Generate Image Toggle - only show if no custom image */}
        {!hasCustomImage && (
          <div className="flex items-center gap-3">
            <Switch
              id="generateImage"
              checked={generateImage}
              onCheckedChange={setGenerateImage}
            />
            <Label htmlFor="generateImage" className="flex items-center gap-2 cursor-pointer text-sm">
              <ImageIcon className="w-4 h-4" />
              Gerar imagem com IA
            </Label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={generating || selectedEvents.length < 2 || !seriesName.trim()}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingImage ? 'Enviando imagem...' : 'Gerando artigo...'}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Gerar ({selectedEvents.length} eventos)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiEventArticleModal;
