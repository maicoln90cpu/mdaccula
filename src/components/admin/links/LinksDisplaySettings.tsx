import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Clock } from "lucide-react";
import { useToast } from "@/hooks/useToast";

const LinksDisplaySettings = () => {
  const [linksShowEventDate, setLinksShowEventDate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .eq("key", "links_show_event_date")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLinksShowEventDate(data.value !== "false");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
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
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "links_show_event_date", value: linksShowEventDate.toString() }, { onConflict: "key" });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações de exibição foram atualizadas.",
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
      <div className="w-full flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg sm:text-xl">Configurações de Exibição</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Timezone global e regras de visibilidade de eventos ficam em Configurações → Geral e em Eventos → Configurações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 sm:px-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="links-show-date">Exibir data nos cards de /links</Label>
            <p className="text-xs text-muted-foreground">
              Mostra a data e horário do evento nos cards da página de links
            </p>
          </div>
          <Switch
            id="links-show-date"
            checked={linksShowEventDate}
            onCheckedChange={setLinksShowEventDate}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LinksDisplaySettings;
