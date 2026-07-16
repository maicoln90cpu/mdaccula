import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";

import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useToast } from "@/hooks";
import { logger } from "@/lib";
import { supabase } from "@/integrations/supabase/client";
import type { EventSource, EventSourceInsert, EventSourceType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Radar, Play } from "lucide-react";

interface SourceFormValues {
  name: string;
  url: string;
  description: string;
  type: EventSourceType;
  enabled: boolean;
}

const emptyForm: SourceFormValues = {
  name: "",
  url: "",
  description: "",
  type: "site",
  enabled: true,
};

const queryKey = ["event-sources"];

const FontesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormValues>(emptyForm);
  const [scanning, setScanning] = useState(false);

  const { data: sources = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
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
  useRealtimeTable("event_sources", () => queryClient.invalidateQueries({ queryKey }));

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-event-sources", { body: {} });
      if (error) throw error;
      toast({
        title: "Varredura concluída",
        description: `${data.created} rascunho(s) de evento encontrados de ${data.sourcesScanned} fonte(s). Os artigos estão sendo gerados em segundo plano e vão aparecer como rascunho em Gerenciar Blog.`,
      });
      queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      logger.error("Erro na varredura", error, { component: "FontesManager" });
      toast({
        title: "Erro na varredura",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (source: EventSource) => {
    setEditingId(source.id);
    setForm({
      name: source.name,
      url: source.url,
      description: source.description || "",
      type: source.type,
      enabled: source.enabled,
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      const payload: EventSourceInsert = {
        name: values.name,
        url: values.url,
        description: values.description || null,
        type: values.type,
        enabled: values.enabled,
      };
      const { error } = await supabase.from("event_sources").insert([payload]);
      if (error) throw error;
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
      const payload: EventSourceInsert = {
        name: values.name,
        url: values.url,
        description: values.description || null,
        type: values.type,
        enabled: values.enabled,
      };
      const { error } = await supabase.from("event_sources").update(payload).eq("id", editingId);
      if (error) throw error;
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
      const { error } = await supabase.from("event_sources").update({ enabled }).eq("id", id);
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
      const { error } = await supabase.from("event_sources").delete().eq("id", id);
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
                Sites e perfis monitorados pelo Event Watcher e usados pela IA como referência para gerar posts do blog
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleScanNow} disabled={scanning}>
                {scanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Executar Varredura Agora
              </Button>
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
                  <div className="space-y-2">
                    <Label htmlFor="source-type">Tipo</Label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => setForm((f) => ({ ...f, type: value as EventSourceType }))}
                    >
                      <SelectTrigger id="source-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="site">Site</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
          </div>

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
                  <Radar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma fonte cadastrada ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ativa</TableHead>
                        <TableHead>Última varredura</TableHead>
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
                          <TableCell className="text-muted-foreground truncate max-w-xs">
                            {source.description || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {source.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={source.enabled}
                              onCheckedChange={(checked) =>
                                toggleEnabledMutation.mutate({ id: source.id, enabled: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {source.last_scanned_at
                              ? new Date(source.last_scanned_at).toLocaleString("pt-BR")
                              : "Nunca"}
                          </TableCell>
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
                                      A fonte <strong>{source.name}</strong> será removida permanentemente e não
                                      será mais varrida pelo Event Watcher.
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
