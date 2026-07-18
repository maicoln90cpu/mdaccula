import { useState, useEffect, useCallback } from "react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Play, Edit2, Loader2, Calendar, Clock, MapPin, Link as LinkIcon, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { uploadImageWithThumb } from "@/lib/bunnyUploader";

interface RecurringConfig {
  id: string;
  name: string;
  title: string;
  weekday: number;
  venue: string;
  address: string | null;
  location_city: string;
  location_state: string;
  time: string;
  end_time: string | null;
  subtitle: string | null;
  description: string | null;
  genres: string[];
  ticket_link: string | null;
  vip_link: string | null;
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  link_group_id: string | null;
}

interface LinkGroup {
  id: string;
  name: string;
  enabled: boolean;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const RecurringEventsManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<RecurringConfig[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RecurringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cronWeekday, setCronWeekday] = useState("2");
  const [cronHour, setCronHour] = useState("3");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [configsRes, groupsRes, settingsRes] = await Promise.all([
        supabase
          .from("recurring_event_configs")
          .select("*")
          .order("weekday"),
        supabase
          .from("link_groups")
          .select("id, name, enabled")
          .order("display_order"),
        supabase
          .from("site_settings")
          .select("key, value")
          .in("key", ["recurring_cron_weekday", "recurring_cron_hour"])
      ]);

      if (configsRes.error) throw configsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      
      setConfigs((configsRes.data as RecurringConfig[]) || []);
      setLinkGroups((groupsRes.data as LinkGroup[]) || []);
      
      // Load schedule settings
      settingsRes.data?.forEach(s => {
        if (s.key === "recurring_cron_weekday") setCronWeekday(s.value || "2");
        if (s.key === "recurring_cron_hour") setCronHour(s.value || "3");
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao carregar configurações",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useRealtimeTable("recurring_event_configs", () => fetchConfigs());

  const handleToggleEnabled = async (config: RecurringConfig) => {
    try {
      const { error } = await supabase
        .from("recurring_event_configs")
        .update({ enabled: !config.enabled })
        .eq("id", config.id);

      if (error) throw error;

      setConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? { ...c, enabled: !c.enabled } : c))
      );

      toast({
        title: config.enabled ? "Desativado" : "Ativado",
        description: `${config.name} foi ${config.enabled ? "desativado" : "ativado"}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleExecuteNow = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ created: number; results?: { linkCreated?: boolean }[] }>("create-recurring-events", {
        body: { force: true }
      });

      if (error) throw error;

      const linksCreated = data?.results?.filter((r) => r.linkCreated)?.length || 0;

      toast({
        title: "Execução concluída",
        description: `${data.created} evento(s) criado(s)${linksCreated > 0 ? `, ${linksCreated} link(s) criado(s)` : ''}`,
      });

      fetchConfigs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro na execução",
        description: message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const updates = [
        { key: "recurring_cron_weekday", value: cronWeekday },
        { key: "recurring_cron_hour", value: cronHour },
      ];
      for (const update of updates) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
        if (error) throw error;
      }
      toast({
        title: "Agendamento salvo",
        description: `Eventos recorrentes serão criados toda ${WEEKDAYS[parseInt(cronWeekday)]} às ${cronHour.padStart(2, '0')}:00 (BRT)`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar agendamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("recurring_event_configs")
        .update({
        title: editingConfig.title,
        subtitle: editingConfig.subtitle,
        description: editingConfig.description,
        address: editingConfig.address,
        time: editingConfig.time,
        end_time: editingConfig.end_time,
        ticket_link: editingConfig.ticket_link,
        vip_link: editingConfig.vip_link,
        image_url: editingConfig.image_url,
        link_group_id: editingConfig.link_group_id,
        })
        .eq("id", editingConfig.id);

      if (error) throw error;

      setConfigs((prev) =>
        prev.map((c) => (c.id === editingConfig.id ? editingConfig : c))
      );

      toast({
        title: "Salvo",
        description: `${editingConfig.name} atualizado com sucesso`,
      });

      setEditingConfig(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return null;
    return linkGroups.find(g => g.id === groupId)?.name || null;
  };

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Eventos Recorrentes</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Eventos Recorrentes</h1>
                  <p className="text-sm text-muted-foreground">
                    Configurações de eventos criados automaticamente toda terça-feira
                  </p>
                </div>
              </div>
              <Button onClick={handleExecuteNow} disabled={executing}>
                {executing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Executar Agora
              </Button>
            </div>

            {/* Schedule Config Card */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Agendamento do Cron Job
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  O cron roda diariamente. A função só cria eventos no dia e horário configurados abaixo (BRT).
                </p>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Dia da Semana</Label>
                    <Select value={cronWeekday} onValueChange={setCronWeekday}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((day, i) => (
                          <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Horário (BRT)</Label>
                    <Select value={cronHour} onValueChange={setCronHour}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveSchedule} disabled={savingSchedule} size="sm">
                    {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Salvar Agendamento
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Atual: <strong>{WEEKDAYS[parseInt(cronWeekday)]} às {cronHour.padStart(2, '0')}:00 (BRT)</strong>. 
                  Os eventos habilitados abaixo serão criados automaticamente neste horário.
                </p>
              </CardContent>
            </Card>

            {/* Configs List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((config) => (
                  <Card key={config.id} className={!config.enabled ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <Badge variant={config.enabled ? "default" : "secondary"}>
                              {config.enabled ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-1">{config.title}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingConfig(config)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={() => handleToggleEnabled(config)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{WEEKDAYS[config.weekday]}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{config.time.slice(0, 5)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          <span>{config.venue}</span>
                        </div>
                        {config.link_group_id && (
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="w-4 h-4" />
                            <span>{getGroupName(config.link_group_id)}</span>
                          </div>
                        )}
                      </div>
                      {config.image_url && (
                        <div className="mt-3">
                          <img
                            src={getOptimizedImageUrl(config.image_url)}
                            alt={config.name}
                            className="h-16 w-28 object-contain rounded-md"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        {/* Edit Dialog */}
        <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar {editingConfig?.name}</DialogTitle>
              <DialogDescription>
                Altere as configurações do evento recorrente
              </DialogDescription>
            </DialogHeader>
            {editingConfig && (
              <div className="space-y-4">
                <div>
                  <Label>Título do Evento</Label>
                  <Input
                    value={editingConfig.title}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Subtítulo</Label>
                  <Input
                    value={editingConfig.subtitle || ""}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, subtitle: e.target.value })
                    }
                    placeholder="Ex: Edição Especial, Open Bar..."
                  />
                </div>
                <div>
                  <Label>Endereço Completo</Label>
                  <Input
                    value={editingConfig.address || ""}
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
                        setEditingConfig({ ...editingConfig, time: e.target.value + ":00" })
                      }
                    />
                  </div>
                  <div>
                    <Label>Horário Término</Label>
                    <Input
                      type="time"
                      value={editingConfig.end_time?.slice(0, 5) || ""}
                      onChange={(e) =>
                        setEditingConfig({ 
                          ...editingConfig, 
                          end_time: e.target.value ? e.target.value + ":00" : null 
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Descrição do Evento</Label>
                  <Textarea
                    value={editingConfig.description || ""}
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
                    value={editingConfig.link_group_id || "none"}
                    onValueChange={(value) =>
                      setEditingConfig({ 
                        ...editingConfig, 
                        link_group_id: value === "none" ? null : value 
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (não criar link)</SelectItem>
                      {linkGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} {!group.enabled && "(desabilitado)"}
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
                    value={editingConfig.ticket_link || ""}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, ticket_link: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Link VIP</Label>
                  <Input
                    value={editingConfig.vip_link || ""}
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
                      value={editingConfig.image_url || ""}
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
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
                          toast({ title: "Imagem enviada!", description: "Upload concluído com sucesso." });
                        } catch (err: unknown) {
                          const message = err instanceof Error ? err.message : "Erro desconhecido";
                          toast({ title: "Erro no upload", description: message, variant: "destructive" });
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
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default RecurringEventsManager;
