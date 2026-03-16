import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/useToast";
import { X } from "lucide-react";
import { z } from "zod";
import { convertToWebP } from "@/lib/webpConverter";
import { uploadImageToBunny } from "@/lib/bunnyUploader";
import { LinkCardImage } from "./LinkCardImage";

const linkSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(100, "Título muito longo"),
  url: z.string().trim().url("URL inválida").max(500, "URL muito longa"),
  icon: z.string().trim().min(1, "Ícone é obrigatório"),
  color_gradient: z.string().optional(),
});

interface CustomLink {
  id: string;
  title: string;
  url: string;
  group_id: string | null;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string;
  is_internal: boolean;
  subtitle?: string | null;
  is_featured?: boolean;
  override_date?: string | null;
  override_time?: string | null;
}

interface LinkGroup {
  id: string;
  name: string;
}

interface CustomLinkFormProps {
  link: CustomLink | null;
  groups: LinkGroup[];
  preselectedGroupId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ICON_OPTIONS = [
  "ExternalLink", "Instagram", "Music", "MessageCircle", "Calendar", 
  "FileText", "Mail", "Youtube", "Twitter", "Facebook", "Linkedin",
  "Globe", "Phone", "MapPin", "Heart", "Star", "Zap"
];

const GRADIENT_OPTIONS = [
  { label: "Usar Padrão do Template", value: "" },
  { label: "Azul > Ciano", value: "from-blue-500 to-cyan-500" },
  { label: "Roxo > Rosa", value: "from-purple-500 to-pink-500" },
  { label: "Laranja > Vermelho", value: "from-orange-500 to-red-500" },
  { label: "Verde > Esmeralda", value: "from-green-500 to-emerald-500" },
  { label: "Índigo > Roxo", value: "from-indigo-500 to-purple-500" },
  { label: "Rosa > Rose", value: "from-pink-500 to-rose-500" },
  { label: "Amarelo > Laranja", value: "from-yellow-500 to-orange-500" },
  { label: "Teal > Azul", value: "from-teal-500 to-blue-500" },
  { label: "Vermelho > Rosa", value: "from-red-500 to-pink-500" },
  { label: "Cinza > Slate", value: "from-gray-600 to-slate-700" },
  { label: "Preto Gradiente", value: "from-gray-900 to-black" },
  { label: "Preto Escuro", value: "from-zinc-900 to-neutral-950" },
];

const normalizeUrl = (inputUrl: string): string => {
  const trimmed = inputUrl.trim();
  if (!trimmed) return trimmed;
  
  // Se já tem protocolo, retorna como está
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Adiciona https:// automaticamente
  return `https://${trimmed}`;
};

export const CustomLinkForm = ({ link, groups, preselectedGroupId, onSuccess, onCancel }: CustomLinkFormProps) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [icon, setIcon] = useState("ExternalLink");
  const [colorGradient, setColorGradient] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [autoFetchedThumbnail, setAutoFetchedThumbnail] = useState<string>("");
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideTime, setOverrideTime] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (link) {
      setTitle(link.title);
      setUrl(link.url);
      setSubtitle(link.subtitle || "");
      setGroupId(link.group_id);
      setIcon(link.icon);
      setColorGradient(link.color_gradient || "");
      setIsInternal(link.is_internal);
      setIsFeatured(link.is_featured || false);
      setThumbnailUrl(link.thumbnail_url);
      setOverrideDate(link.override_date || "");
      setOverrideTime(link.override_time || "");
    } else if (preselectedGroupId) {
      setGroupId(preselectedGroupId);
    }
  }, [link, preselectedGroupId]);

  const fetchLinkMetadata = async (linkUrl: string) => {
    if (!linkUrl || linkUrl === link?.url) return; // Don't fetch if editing existing link
    
    setIsFetchingMetadata(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
        body: { url: linkUrl }
      });

      if (error) throw error;

      if (data?.warning) {
        toast({
          title: "Aviso",
          description: data.warning,
        });
      }

      if (data?.success && data.imageUrl) {
        setAutoFetchedThumbnail(data.imageUrl);
        toast({
          title: "Thumbnail encontrada!",
          description: "Você pode usá-la ou fazer upload de uma imagem personalizada.",
        });
      } else if (data?.success && !data.imageUrl && !data.warning) {
        toast({
          title: "Nenhuma imagem encontrada",
          description: "Você pode fazer upload de uma imagem personalizada.",
        });
      }
    } catch (error) {
      logger.error('Error fetching metadata', error, { component: 'CustomLinkForm' });
      toast({
        title: "Não foi possível buscar metadados",
        description: "Você pode continuar e adicionar uma imagem manualmente.",
      });
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Erro", description: "Imagem muito grande (máx 2MB)" });
        return;
      }
      setThumbnailFile(file);
      setAutoFetchedThumbnail(""); // Clear auto-fetched when manual upload
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const useAutoFetchedThumbnail = () => {
    if (autoFetchedThumbnail) {
      setThumbnailUrl(autoFetchedThumbnail);
      setThumbnailFile(null); // Clear manual upload
      toast({
        title: "Thumbnail aplicada",
        description: "A imagem do link será usada.",
      });
    }
  };

  const uploadThumbnail = async (file: File): Promise<string | null> => {
    try {
      const webpFile = await convertToWebP(file);
      const fileName = `${crypto.randomUUID()}.webp`;
      
      const { error: uploadError } = await supabase.storage
        .from('link-thumbnails')
        .upload(fileName, webpFile, { contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('link-thumbnails')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      logger.error('Error uploading thumbnail', error, { component: 'CustomLinkForm' });
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
      return null;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors({});

    try {
      const parsedData = linkSchema.parse({
        title: title.trim(),
        url: url.trim(),
        icon,
        color_gradient: colorGradient,
      });

      const subtitleValue = subtitle.trim() || null;

      // Handle thumbnail: priority is manual upload > auto-fetched > existing
      let finalThumbnailUrl = link?.thumbnail_url || null;
      
      if (thumbnailFile) {
        // Manual upload takes priority
        setUploading(true);
        finalThumbnailUrl = await uploadThumbnail(thumbnailFile);
        setUploading(false);
        if (!finalThumbnailUrl) {
          setLoading(false);
          return;
        }
      } else if (autoFetchedThumbnail && thumbnailUrl === autoFetchedThumbnail) {
        // Use auto-fetched if selected
        finalThumbnailUrl = autoFetchedThumbnail;
      }

      // Convert 'default' to null for database
      const finalColorGradient = colorGradient === 'default' || colorGradient === '' ? null : colorGradient;

      if (link) {
        const { error } = await supabase
          .from("custom_links")
          .update({
            title: parsedData.title,
            url: parsedData.url,
            subtitle: subtitleValue,
            group_id: groupId,
            icon: parsedData.icon,
            color_gradient: finalColorGradient,
            is_internal: isInternal,
            is_featured: isFeatured,
            thumbnail_url: finalThumbnailUrl,
            override_date: overrideDate || null,
            override_time: overrideTime || null,
          })
          .eq("id", link.id);

        if (error) throw error;

        toast({ title: "Link atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("custom_links")
          .insert({
            title: parsedData.title,
            url: parsedData.url,
            subtitle: subtitleValue,
            group_id: groupId,
            icon: parsedData.icon,
            color_gradient: finalColorGradient,
            is_internal: isInternal,
            is_featured: isFeatured,
            thumbnail_url: finalThumbnailUrl,
            override_date: overrideDate || null,
            override_time: overrideTime || null,
          });

        if (error) throw error;

        toast({ title: "Link criado com sucesso!" });
      }

      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { title?: string; url?: string } = {};
        error.errors.forEach(err => {
          const field = err.path[0] as 'title' | 'url';
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        logger.error('Error saving link', error, { component: 'CustomLinkForm' });
        toast({
          variant: "destructive",
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao salvar link"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome do link"
          disabled={loading}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
        <Input
          id="subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Ex: Link sem taxa"
          maxLength={100}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Texto adicional que aparecerá abaixo do título do link
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">URL *</Label>
        <Input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={(e) => {
            const normalized = normalizeUrl(e.target.value);
            if (normalized !== e.target.value) {
              setUrl(normalized);
            }
            // Fetch metadata after normalizing URL
            if (normalized && !link) {
              fetchLinkMetadata(normalized);
            }
          }}
          placeholder="Ex: bit.ly/seu-link ou https://..."
          disabled={loading || isFetchingMetadata}
        />
        {isFetchingMetadata && (
          <p className="text-xs text-muted-foreground">Buscando thumbnail...</p>
        )}
        {errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="group">Grupo (opcional)</Label>
        <Select value={groupId || undefined} onValueChange={(value) => setGroupId(value || null)} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Sem grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Links sem grupo aparecerão sem categorização
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="icon">Ícone</Label>
        <Select value={icon} onValueChange={setIcon} disabled={loading}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((iconOption) => (
              <SelectItem key={iconOption} value={iconOption}>
                {iconOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campos de Data/Hora Override */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="overrideDate">Data (opcional)</Label>
          <Input
            id="overrideDate"
            type="date"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Sobrescreve a data do evento vinculado
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="overrideTime">Horário (opcional)</Label>
          <Input
            id="overrideTime"
            type="time"
            value={overrideTime}
            onChange={(e) => setOverrideTime(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Sobrescreve o horário do evento vinculado
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gradient">Gradiente de Cor</Label>
        <Select 
          value={colorGradient === '' ? 'default' : colorGradient} 
          onValueChange={(v) => setColorGradient(v === 'default' ? '' : v)} 
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Usar Padrão do Template">
              {colorGradient && colorGradient !== '' ? (
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded bg-gradient-to-r ${colorGradient}`} />
                  <span>{GRADIENT_OPTIONS.find(o => o.value === colorGradient)?.label || 'Personalizado'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-dashed border-muted-foreground" />
                  <span>Usar Padrão do Template</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            {GRADIENT_OPTIONS.map((option) => (
              <SelectItem key={option.value === '' ? 'default' : option.value} value={option.value === '' ? 'default' : option.value}>
                <div className="flex items-center gap-2">
                  {option.value && option.value !== '' ? (
                    <div className={`w-4 h-4 rounded bg-gradient-to-r ${option.value}`} />
                  ) : (
                    <div className="w-4 h-4 rounded border border-dashed border-muted-foreground" />
                  )}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se definido, tem prioridade sobre a cor do template
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="internal"
          checked={isInternal}
          onCheckedChange={setIsInternal}
          disabled={loading}
        />
        <Label htmlFor="internal" className="cursor-pointer">
          Link interno (não abre em nova aba)
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="featured"
          checked={isFeatured}
          onCheckedChange={setIsFeatured}
          disabled={loading}
        />
        <Label htmlFor="featured" className="cursor-pointer">
          Destacar este link (ocupará o dobro do espaço)
        </Label>
      </div>

      {/* Preview do card */}
      <div className="mt-4 p-4 border rounded-md bg-muted/30">
        <p className="text-sm font-medium mb-2">Preview:</p>
        <div 
          className={`relative flex items-center gap-4 rounded-xl p-4 bg-gradient-to-r ${colorGradient && colorGradient !== 'default' ? colorGradient : 'from-blue-500 to-cyan-500'} text-white shadow-lg transition-all duration-300`}
          style={{ minHeight: isFeatured ? '120px' : '80px', height: 'auto' }}
        >
          <LinkCardImage
            thumbnailUrl={thumbnailUrl}
            alt={title || "Preview"}
            iconName={icon || 'ExternalLink'}
            featured={isFeatured}
            skipOptimization
          />
          <div className="flex-1 min-w-0 text-left">
            <h3 className="font-semibold text-sm truncate">
              {title || "Título do Link"}
            </h3>
            {subtitle && (
              <p className="text-xs opacity-90 truncate mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isFeatured ? "Card destacado" : "Card normal (altura controlada em Ajustar Tamanhos)"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail">Thumbnail (opcional)</Label>
        
        {autoFetchedThumbnail && !thumbnailUrl && (
          <div className="p-3 border rounded-md bg-muted/50">
            <p className="text-sm mb-2">Thumbnail encontrada automaticamente:</p>
            <div className="flex items-center gap-3">
              <img 
                src={autoFetchedThumbnail} 
                alt="Auto-fetched thumbnail" 
                className="w-16 h-16 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useAutoFetchedThumbnail}
                disabled={loading}
              >
                Usar esta imagem
              </Button>
            </div>
          </div>
        )}
        
        <Input
          id="thumbnail"
          type="file"
          accept="image/*"
          onChange={handleThumbnailChange}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Upload manual de imagem (substituirá a thumbnail automática)
        </p>
        
        {thumbnailUrl && (
          <div className="mt-2 relative w-24 h-24">
            <img 
              src={thumbnailUrl} 
              alt="Preview" 
              className="w-full h-full object-cover rounded-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => {
                setThumbnailUrl(null);
                setThumbnailFile(null);
              }}
              disabled={loading}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onCancel} disabled={loading || uploading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={loading || uploading}>
          {uploading ? "Enviando..." : loading ? "Salvando..." : link ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </div>
  );
};
