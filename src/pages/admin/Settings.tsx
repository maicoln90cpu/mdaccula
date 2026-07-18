import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Settings2, Users, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { NavLink } from "react-router-dom";
import GeneralSettings from "@/components/admin/settings/GeneralSettings";
import SocialSettings from "@/components/admin/settings/SocialSettings";
import MediaSettings from "@/components/admin/settings/MediaSettings";

const Settings = () => {
  // General settings
  const [gtmId, setGtmId] = useState("");
  const [newsletterPopupEnabled, setNewsletterPopupEnabled] = useState(false);
  
  // Social settings
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [instagramLink, setInstagramLink] = useState("");
  const [soundcloudLink, setSoundcloudLink] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  
  // Timezone settings
  const [timezoneOffset, setTimezoneOffset] = useState("-3");
  const [timezoneName, setTimezoneName] = useState("America/Sao_Paulo");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

      if (error) throw error;
      
      data?.forEach((setting) => {
        switch (setting.key) {
          case "google_tag_manager_id":
            setGtmId(setting.value || "");
            break;
          case "whatsapp_number":
            setWhatsappNumber(setting.value || "");
            break;
          case "whatsapp_link":
            setWhatsappLink(setting.value || "");
            break;
          case "instagram_link":
            setInstagramLink(setting.value || "");
            break;
          case "soundcloud_link":
            setSoundcloudLink(setting.value || "");
            break;
          case "contact_email":
            setContactEmail(setting.value || "");
            break;
          case "newsletter_popup_enabled":
            setNewsletterPopupEnabled(setting.value === "true");
            break;
          case "timezone_offset":
            setTimezoneOffset(setting.value || "-3");
            break;
          case "timezone_name":
            setTimezoneName(setting.value || "America/Sao_Paulo");
            break;
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[Settings] Erro ao carregar configurações:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar configurações",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "google_tag_manager_id", value: gtmId },
        { key: "whatsapp_number", value: whatsappNumber },
        { key: "whatsapp_link", value: whatsappLink },
        { key: "instagram_link", value: instagramLink },
        { key: "soundcloud_link", value: soundcloudLink },
        { key: "contact_email", value: contactEmail },
        { key: "newsletter_popup_enabled", value: newsletterPopupEnabled.toString() },
        { key: "timezone_offset", value: timezoneOffset },
        { key: "timezone_name", value: timezoneName },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        variant: "destructive",
        title: "Erro ao salvar configurações",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full">
            <div className="mb-6 sm:mb-8">
              <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Painel
              </NavLink>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold hero-text">Configurações</h1>
            </div>

            <Tabs defaultValue="geral" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="geral" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Geral</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Social</span>
                </TabsTrigger>
                <TabsTrigger value="midia" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mídia</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="geral">
                <GeneralSettings
                  gtmId={gtmId}
                  setGtmId={setGtmId}
                  newsletterPopupEnabled={newsletterPopupEnabled}
                  setNewsletterPopupEnabled={setNewsletterPopupEnabled}
                  timezoneOffset={timezoneOffset}
                  setTimezoneOffset={setTimezoneOffset}
                  timezoneName={timezoneName}
                  setTimezoneName={setTimezoneName}
                />
              </TabsContent>

              <TabsContent value="social">
                <SocialSettings
                  instagramLink={instagramLink}
                  setInstagramLink={setInstagramLink}
                  soundcloudLink={soundcloudLink}
                  setSoundcloudLink={setSoundcloudLink}
                  whatsappNumber={whatsappNumber}
                  setWhatsappNumber={setWhatsappNumber}
                  whatsappLink={whatsappLink}
                  setWhatsappLink={setWhatsappLink}
                  contactEmail={contactEmail}
                  setContactEmail={setContactEmail}
                />
              </TabsContent>

              <TabsContent value="midia">
                <MediaSettings />
              </TabsContent>
            </Tabs>

            <div className="mt-6">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Todas as Configurações"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Settings;
