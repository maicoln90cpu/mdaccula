import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Settings2, Users, ImageIcon, Clock, Bot, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { NavLink } from "react-router-dom";
import AIAnalyticsDashboard from "@/components/admin/AIAnalyticsDashboard";
import GeneralSettings from "@/components/admin/settings/GeneralSettings";
import SocialSettings from "@/components/admin/settings/SocialSettings";
import MediaSettings from "@/components/admin/settings/MediaSettings";
import TimezoneSettings from "@/components/admin/settings/TimezoneSettings";
import AISettings, { DEFAULT_IMAGE_PROMPT } from "@/components/admin/settings/AISettings";

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
  
  // AI settings
  const [aiModel, setAiModel] = useState("google/gemini-2.5-flash");
  const [aiTemperature, setAiTemperature] = useState(0.9);
  const [aiImagePrompt, setAiImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [aiHistoryLimit, setAiHistoryLimit] = useState(15);
  const [aiAutoGenerateEnabled, setAiAutoGenerateEnabled] = useState(false);
  const [aiAutoGenerateInterval, setAiAutoGenerateInterval] = useState("24");
  const [aiMaxArticleLength, setAiMaxArticleLength] = useState(5000);
  const [aiMaxScrapeSources, setAiMaxScrapeSources] = useState(3);
  
  // Timezone settings
  const [timezoneOffset, setTimezoneOffset] = useState("-3");
  const [timezoneName, setTimezoneName] = useState("America/Sao_Paulo");
  const [eventHoursAfterStart, setEventHoursAfterStart] = useState(12);
  const [eventHoursWithoutTime, setEventHoursWithoutTime] = useState(24);
  const [linksShowEventDate, setLinksShowEventDate] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
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
          case "ai_blog_model":
            setAiModel(setting.value || "google/gemini-2.5-flash");
            break;
          case "ai_temperature":
            setAiTemperature(parseFloat(setting.value || "0.9"));
            break;
          case "ai_image_prompt_template":
            setAiImagePrompt(setting.value || DEFAULT_IMAGE_PROMPT);
            break;
          case "ai_history_limit":
            setAiHistoryLimit(parseInt(setting.value || "15"));
            break;
          case "ai_auto_generate_enabled":
            setAiAutoGenerateEnabled(setting.value === "true");
            break;
          case "ai_auto_generate_interval_hours":
            setAiAutoGenerateInterval(setting.value || "24");
            break;
          case "ai_max_article_length":
            setAiMaxArticleLength(parseInt(setting.value || "5000"));
            break;
          case "ai_max_scrape_sources":
            setAiMaxScrapeSources(parseInt(setting.value || "3"));
            break;
          case "timezone_offset":
            setTimezoneOffset(setting.value || "-3");
            break;
          case "timezone_name":
            setTimezoneName(setting.value || "America/Sao_Paulo");
            break;
          case "event_hours_after_start":
            setEventHoursAfterStart(parseInt(setting.value || "12"));
            break;
          case "event_hours_without_time":
            setEventHoursWithoutTime(parseInt(setting.value || "24"));
            break;
          case "links_show_event_date":
            setLinksShowEventDate(setting.value !== "false");
            break;
        }
      });
    } catch (error: any) {
      console.error("[Settings] Erro ao carregar configurações:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar configurações",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

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
        { key: "ai_blog_model", value: aiModel },
        { key: "ai_temperature", value: aiTemperature.toString() },
        { key: "ai_image_prompt_template", value: aiImagePrompt },
        { key: "ai_history_limit", value: aiHistoryLimit.toString() },
        { key: "ai_auto_generate_enabled", value: aiAutoGenerateEnabled.toString() },
        { key: "ai_auto_generate_interval_hours", value: aiAutoGenerateInterval },
        { key: "ai_max_article_length", value: aiMaxArticleLength.toString() },
        { key: "ai_max_scrape_sources", value: aiMaxScrapeSources.toString() },
        { key: "timezone_offset", value: timezoneOffset },
        { key: "timezone_name", value: timezoneName },
        { key: "event_hours_after_start", value: eventHoursAfterStart.toString() },
        { key: "event_hours_without_time", value: eventHoursWithoutTime.toString() },
        { key: "links_show_event_date", value: linksShowEventDate.toString() },
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
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar configurações",
        description: error.message,
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8">
              <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Painel
              </NavLink>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold hero-text">Configurações</h1>
            </div>

            <Tabs defaultValue="geral" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-1 bg-muted/50 p-1">
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
                <TabsTrigger value="horario" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Horário</span>
                </TabsTrigger>
                <TabsTrigger value="ia" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <Bot className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">IA</span>
                </TabsTrigger>
                <TabsTrigger value="custos" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Custos</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="geral">
                <GeneralSettings
                  gtmId={gtmId}
                  setGtmId={setGtmId}
                  newsletterPopupEnabled={newsletterPopupEnabled}
                  setNewsletterPopupEnabled={setNewsletterPopupEnabled}
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

              <TabsContent value="horario">
                <TimezoneSettings
                  timezoneOffset={timezoneOffset}
                  setTimezoneOffset={setTimezoneOffset}
                  timezoneName={timezoneName}
                  setTimezoneName={setTimezoneName}
                  eventHoursAfterStart={eventHoursAfterStart}
                  setEventHoursAfterStart={setEventHoursAfterStart}
                  eventHoursWithoutTime={eventHoursWithoutTime}
                  setEventHoursWithoutTime={setEventHoursWithoutTime}
                  linksShowEventDate={linksShowEventDate}
                  setLinksShowEventDate={setLinksShowEventDate}
                />
              </TabsContent>

              <TabsContent value="ia">
                <AISettings
                  aiModel={aiModel}
                  setAiModel={setAiModel}
                  aiTemperature={aiTemperature}
                  setAiTemperature={setAiTemperature}
                  aiImagePrompt={aiImagePrompt}
                  setAiImagePrompt={setAiImagePrompt}
                  aiHistoryLimit={aiHistoryLimit}
                  setAiHistoryLimit={setAiHistoryLimit}
                  aiAutoGenerateEnabled={aiAutoGenerateEnabled}
                  setAiAutoGenerateEnabled={setAiAutoGenerateEnabled}
                  aiAutoGenerateInterval={aiAutoGenerateInterval}
                  setAiAutoGenerateInterval={setAiAutoGenerateInterval}
                  aiMaxArticleLength={aiMaxArticleLength}
                  setAiMaxArticleLength={setAiMaxArticleLength}
                  aiMaxScrapeSources={aiMaxScrapeSources}
                  setAiMaxScrapeSources={setAiMaxScrapeSources}
                />
              </TabsContent>

              <TabsContent value="custos">
                <Card>
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-lg sm:text-xl">Dashboard de Custos IA</CardTitle>
                    <CardDescription className="text-sm">
                      Análise detalhada de custos, tokens e comparativo por modelo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <AIAnalyticsDashboard />
                  </CardContent>
                </Card>
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
