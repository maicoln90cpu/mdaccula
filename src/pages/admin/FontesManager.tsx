import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";

import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useToast } from "@/hooks";
import { logger } from "@/lib";
import { supabase } from "@/integrations/supabase/client";
import type { NewsSource, NewsSourceInsert, EventSource, EventSourceInsert } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Globe, Radar } from "lucide-react";

type SourceKind = "news" | "events";

interface SourceFormValues {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}

const emptyForm: SourceFormValues = { name: "", url: "", description: "", enabled: true };

const FontesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SourceKind>("news");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormValues>(emptyForm);

  const table = activeTab === "news" ? "news_sources" : "event_sources";
  const queryKey = [activeTab === "news" ? "news-sources" : "event-sources"];

  const { data: sources = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (activeTab === "news") {
        const { data, error } = await supabase
          .from("news_sources")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data as NewsSource[];
      }
      const { data, error } = await supabase
        .from("event_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EventSource[];
    },
  });

  // Realtime: reflete mudanças feitas em background (ex: scan-event-sources
  // atualizando last_scanned_at) sem exigir refresh manual.
  useRealtimeTable(table, () => queryClient.invalidateQueries({ queryKey }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (source: NewsSource | EventSource) => {
    setEditingId(source.id);
    setForm({
      name: source.name,
      url: source.url,
      description: activeTab === "news" ? (source as NewsSource).description || "" : "",
      enabled: source.enabled,
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      if (activeTab === "news") {
        const payload: NewsSourceInsert = {
          name: values.name,
          url: values.url,
          description: values.description || null,
          enabled: values.enabled,
        };
        const { error } = await supabase.from("news_sources").insert([payload]);
        if (error) throw error;
      } else {
        const payload: EventSourceInsert = {
          name: values.name,
          url: values.url,
          type: "site",
          enabled: values.enabled,
        };
        const { error } = await supabase.from("event_sources").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fonte adicionada!" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      logger.error("Erro ao adicionar fonte", error, { component: "FontesManager" });
      toast({ title: "Erro ao adicionar fonte", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      if (!editingId) return;
      if (activeTab === "news") {
        const payload: NewsSourceInsert = {
          name: values.name,
          url: values.url,
          description: values.description || null,
          enabled: values.enabled,
        };
        const { error } = await supabase.from("news_sources").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_sources")
          .update({ name: values.name, url: values.url, enabled: values.enabled })
          .eq("id", editingId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fonte atualizada!" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      logger.error("Erro ao atualizar fonte", error, { component: "FontesManager" });
      toast({ title: "Erro ao atualizar fonte", description: error.message, variant: "destructive" });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from(table).update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => {
      logger.error("Erro ao atualizar fonte", error, { component: "FontesManager" });
      toast({ title: "Erro ao atualizar fonte", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Fonte removida" });
    },
    onError: (error: Error) => {
      logger.error("Erro ao remover fonte", error, { component: "FontesManager" });
      toast({ title: "Erro ao remover fonte", description: error.message, variant: "destructive" });
    },
  });

  const isEditing = editingId !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (isEditing) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as SourceKind);
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div>
              <NavLink
                to="/admin"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Painel
              </NavLink>
              <h1 className="text-3xl font-bold hero-text flex items-center gap-3">
                <Radar className="w-7 h-7 text-primary" />
                Fontes
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeTab === "news"
                  ? "Sites que a IA usa como referência para gerar posts do blog"
                  : "Sites monitorados pelo Event Watcher para extração automática de eventos"}
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Fonte
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditing ? "Editar Fonte" : "Adicionar Nova Fonte"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="source-name">Nome</Label>
                    <Input
                      id="source-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Resident Advisor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-url">URL</Label>
                    <Input
                      id="source-url"
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  {activeTab === "news" && (
                    <div className="space-y-2">
                      <Label htmlFor="source-description">Descrição (opcional)</Label>
                      <Textarea
                        id="source-description"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Breve descrição da fonte"
                        rows={3}
                      />
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="source-enabled"
                      checked={form.enabled}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
                    />
                    <Label htmlFor="source-enabled">Fonte ativa</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSubmit}
                    disabled={!form.name || !form.url || isSaving}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditing ? "Atualizar" : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
            <TabsList>
              <TabsTrigger value="news">
                <Globe className="w-4 h-4 mr-2" /> Notícias
              </TabsTrigger>
              <TabsTrigger value="events">
                <Radar className="w-4 h-4 mr-2" /> Eventos
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Fontes cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sources.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {activeTab === "news" ? (
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  ) : (
                    <Radar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  )}
                  <p>Nenhuma fonte cadastrada ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>URL</TableHead>
                        {activeTab === "news" && <TableHead>Descrição</TableHead>}
                        <TableHead>Ativa</TableHead>
                        {activeTab === "events" && <TableHead>Última varredura</TableHead>}
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((source) => (
                        <TableRow key={source.id}>
                          <TableCell className="font-medium">{source.name}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-xs">
                            {source.url}
                          </TableCell>
                          {activeTab === "news" && (
                            <TableCell className="text-muted-foreground truncate max-w-xs">
                              {(source as NewsSource).description || "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            <Switch
                              checked={source.enabled}
                              onCheckedChange={(checked) =>
                                toggleEnabledMutation.mutate({ id: source.id, enabled: checked })
                              }
                            />
                          </TableCell>
                          {activeTab === "events" && (
                            <TableCell className="text-sm text-muted-foreground">
                              {(source as EventSource).last_scanned_at
                                ? new Date((source as EventSource).last_scanned_at as string).toLocaleString(
                                    "pt-BR",
                                  )
                                : "Nunca"}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(source)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      A fonte <strong>{source.name}</strong> será removida permanentemente
                                      {activeTab === "events"
                                        ? " e não será mais varrida pelo Event Watcher."
                                        : "."}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(source.id)}>
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default FontesManager;
