import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { NavLink } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks";
import type { EventSource, EventSourceInsert } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Loader2, ArrowLeft, Radar } from "lucide-react";

const EventSourcesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EventSourceInsert>({ name: "", url: "", type: "site" });

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["event-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EventSource[];
    },
  });

  // Realtime: last_scanned_at é atualizado em background pela Edge Function
  // scan-event-sources, então refletimos mudanças sem exigir refresh manual.
  useRealtimeTable("event_sources", () =>
    queryClient.invalidateQueries({ queryKey: ["event-sources"] }),
  );

  const createMutation = useMutation({
    mutationFn: async (input: EventSourceInsert) => {
      const { error } = await supabase.from("event_sources").insert([input]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sources"] });
      toast({ title: "Fonte adicionada!" });
      setDialogOpen(false);
      setForm({ name: "", url: "", type: "site" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar fonte", description: error.message, variant: "destructive" });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("event_sources").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-sources"] }),
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar fonte", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sources"] });
      toast({ title: "Fonte removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover fonte", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="w-full">
          <div className="flex items-center justify-between mb-8">
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
                Fontes de Eventos
              </h1>
              <p className="text-muted-foreground mt-1">
                Sites monitorados pelo Event Watcher para extração automática de eventos
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Nova Fonte
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova fonte (site)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="source-name">Nome</Label>
                    <Input
                      id="source-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Resident Advisor SP"
                    />
                  </div>
                  <div>
                    <Label htmlFor="source-url">URL</Label>
                    <Input
                      id="source-url"
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://exemplo.com/agenda"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createMutation.mutate({ ...form, type: "site" })}
                    disabled={!form.name || !form.url || createMutation.isPending}
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                                    A fonte <strong>{source.name}</strong> será removida permanentemente e
                                    não será mais varrida pelo Event Watcher.
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

export default EventSourcesManager;
