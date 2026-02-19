import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploadWithCrop } from "@/components/ui/ImageUploadWithCrop";
import { ThemeSelector } from "./ThemeSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cardBorderOptions,
  cardShadowOptions,
  cardRoundednessOptions,
  cardBackdropOptions,
  cardHoverOptions,
  cardColorOptions,
  cardBorderColorOptions,
} from "@/lib/linkThemes";

interface LinksPageSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string;
  currentHandle?: string;
  currentTheme?: string;
  currentCardBorder?: string;
  currentCardShadow?: string;
  currentCardRoundedness?: string;
  currentCardBackdrop?: string;
  currentCardHover?: string;
  currentCardColor?: string;
  currentCardBorderColor?: string;
}

export const LinksPageSettings = ({
  open,
  onOpenChange,
  currentAvatar,
  currentHandle,
  currentTheme,
  currentCardBorder,
  currentCardShadow,
  currentCardRoundedness,
  currentCardBackdrop,
  currentCardHover,
  currentCardColor,
  currentCardBorderColor,
}: LinksPageSettingsProps) => {
  const [handle, setHandle] = useState(currentHandle || "@MDAccula");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(currentTheme || "sunset");
  const [cardBorder, setCardBorder] = useState(currentCardBorder || 'border border-white/10');
  const [cardShadow, setCardShadow] = useState(currentCardShadow || 'shadow-lg hover:shadow-xl');
  const [cardRoundedness, setCardRoundedness] = useState(currentCardRoundedness || 'rounded-2xl');
  const [cardBackdrop, setCardBackdrop] = useState(currentCardBackdrop || 'backdrop-blur-sm');
  const [cardHoverEffect, setCardHoverEffect] = useState(currentCardHover || 'hover:scale-[1.02]');
  const [cardColor, setCardColor] = useState(currentCardColor || '');
  const [cardBorderColor, setCardBorderColor] = useState(currentCardBorderColor || '');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setLoading(true);
    try {
      let avatarUrl = currentAvatar;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `avatar-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("link-thumbnails")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("link-thumbnails")
          .getPublicUrl(uploadData.path);

        avatarUrl = publicUrl;
      }

      // Update settings
      const updates = [
        { key: "links_page_avatar_url", value: avatarUrl },
        { key: "links_page_handle", value: handle },
        { key: "links_page_theme", value: selectedTheme },
        { key: "links_page_card_border", value: cardBorder },
        { key: "links_page_card_shadow", value: cardShadow },
        { key: "links_page_card_roundedness", value: cardRoundedness },
        { key: "links_page_card_backdrop", value: cardBackdrop },
        { key: "links_page_card_hover", value: cardHoverEffect },
        { key: "links_page_card_color", value: cardColor },
        { key: "links_page_card_border_color", value: cardBorderColor },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("site_settings")
          .upsert(update, { onConflict: "key" });

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Configurações salvas com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurações da Página de Links</DialogTitle>
          <DialogDescription>
            Personalize o avatar, handle e tema da sua página de links
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto">
          <div>
            <Label>Avatar</Label>
            <ImageUploadWithCrop
              onImageSelect={setAvatarFile}
              currentImageUrl={currentAvatar}
              aspectRatio={1}
              label="Escolher Avatar"
            />
          </div>

          <div>
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@SeuHandle"
            />
          </div>

          <div>
            <Label>Tema</Label>
            <ThemeSelector
              selectedTheme={selectedTheme}
              onThemeSelect={setSelectedTheme}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Customização de Cards</h3>
            
            <div>
              <Label htmlFor="cardColor">Cor Padrão dos Cards</Label>
              <Select value={cardColor} onValueChange={setCardColor}>
                <SelectTrigger id="cardColor">
                  <SelectValue placeholder="Padrão do Tema">
                    {cardColor && cardColor !== 'default' && (
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded bg-gradient-to-r ${cardColor}`} />
                        <span>{cardColorOptions.find(o => o.value === cardColor)?.label || 'Personalizado'}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {cardColorOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value || 'default'}>
                      <div className="flex items-center gap-2">
                        {opt.value ? (
                          <div className={`w-4 h-4 rounded bg-gradient-to-r ${opt.value}`} />
                        ) : (
                          <div className="w-4 h-4 rounded border border-dashed border-muted-foreground" />
                        )}
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Cor individual do card tem prioridade</p>
            </div>

            <div>
              <Label htmlFor="cardBorderColor">Cor da Borda</Label>
              <Select value={cardBorderColor} onValueChange={setCardBorderColor}>
                <SelectTrigger id="cardBorderColor">
                  <SelectValue placeholder="Padrão do Tema">
                    {cardBorderColor && cardBorderColor !== 'default' && (
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${cardBorderColor}`} />
                        <span>{cardBorderColorOptions.find(o => o.value === cardBorderColor)?.label || 'Personalizado'}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {cardBorderColorOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value || 'default'}>
                      <div className="flex items-center gap-2">
                        {opt.value ? (
                          <div className={`w-4 h-4 rounded ${opt.value}`} />
                        ) : (
                          <div className="w-4 h-4 rounded border border-dashed border-muted-foreground" />
                        )}
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cardBorder">Estilo da Borda</Label>
              <Select value={cardBorder} onValueChange={setCardBorder}>
                <SelectTrigger id="cardBorder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardBorderOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cardShadow">Sombra</Label>
              <Select value={cardShadow} onValueChange={setCardShadow}>
                <SelectTrigger id="cardShadow">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardShadowOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cardRoundedness">Arredondamento</Label>
              <Select value={cardRoundedness} onValueChange={setCardRoundedness}>
                <SelectTrigger id="cardRoundedness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardRoundednessOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cardBackdrop">Efeito Blur</Label>
              <Select value={cardBackdrop} onValueChange={setCardBackdrop}>
                <SelectTrigger id="cardBackdrop">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardBackdropOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cardHover">Efeito Hover</Label>
              <Select value={cardHoverEffect} onValueChange={setCardHoverEffect}>
                <SelectTrigger id="cardHover">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardHoverOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
