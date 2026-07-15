import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks";
import type { EventWatchDraft } from "@/types";
import { buildArticlePayload, type EventLike } from "@/lib/eventArticlePayload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Check, X } from "lucide-react";

interface EditedFields {
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  locationCity: string;
  locationState: string;
  lineup: string;
  ticketLink: string;
  description: string;
}

function toEditedFields(draft: EventWatchDraft): EditedFields {
  return {
    title: draft.extracted_title,
    date: draft.extracted_date,
    time: draft.extracted_time ?? "",
    venue: draft.extracted_venue ?? "",
    address: draft.extracted_address ?? "",
    locationCity: draft.extracted_city ?? "",
    locationState: draft.extracted_state ?? "",
    lineup: (draft.extracted_lineup ?? []).join(", "),
    ticketLink: draft.extracted_ticket_link ?? "",
    description: draft.extracted_description ?? "",
  };
}

const confidenceColor: Record<string, string> = {
  high: "bg-green-500/20 text-green-400 border-green-500/40",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  low: "bg-red-500/20 text-red-400 border-red-500/40",
};

export default function EventWatchReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<EventWatchDraft | null>(null);
  const [edited, setEdited] = useState<EditedFields | null>(null);
  const [scanning, setScanning] = useState(false);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["event-watch-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_watch_drafts")
        .select("*, event_sources(name, url)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EventWatchDraft[];
    },
  });

  const openDraft = (draft: EventWatchDraft) => {
    setSelected(draft);
    setEdited(toEditedFields(draft));
  };

  const rejectMutation = useMutation({
    mutationFn: async (draft: EventWatchDraft) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("event_watch_drafts")
        .update({
          status: "rejected",
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
      toast({ title: "Rascunho rejeitado" });
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ draft, fields }: { draft: EventWatchDraft; fields: EditedFields }) => {
      const eventLike: EventLike = {
        title: fields.title,
        date: fields.date,
        time: fields.time || null,
        venue: fields.venue,
        address: fields.address || null,
        location_city: fields.locationCity,
        location_state: fields.locationState,
        lineup: fields.lineup ? fields.lineup.split(",").map((s) => s.trim()).filter(Boolean) : null,
        ticket_link: fields.ticketLink || null,
        description: fields.description || null,
      };

      const payload = buildArticlePayload(eventLike, { generateImage: true });
      const { data: blogData, error: blogError } = await supabase.functions.invoke("generate-blog-post-v2", {
        body: payload,
      });
      if (blogError) throw blogError;
      if (!blogData?.post?.id) throw new Error("Resposta inválida do gerador de artigo");

      const { data: userData } = await supabase.auth.getUser();
      const { error: draftError } = await supabase
        .from("event_watch_drafts")
        .update({
          status: "published",
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          published_blog_post_id: blogData.post.id,
        })
        .eq("id", draft.id);
      if (draftError) throw draftError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
      toast({ title: "Publicado!", description: "Artigo criado com sucesso." });
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao aprovar rascunho", description: error.message, variant: "destructive" });
    },
  });

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-event-sources", { body: {} });
      if (error) throw error;
      toast({
        title: "Varredura concluída",
        description: `${data.created} rascunho(s) criado(s) de ${data.sourcesScanned} fonte(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["event-watch-drafts"] });
    } catch (error) {
      toast({
        title: "Erro na varredura",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisão de Eventos (IA)</h1>
        <Button onClick={handleScanNow} disabled={scanning}>
          {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Executar Agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendentes de revisão</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : drafts.length === 0 ? (
            <p className="text-muted-foreground">Nenhum rascunho pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Confiança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDraft(draft)}>
                    <TableCell className="font-medium">{draft.extracted_title}</TableCell>
                    <TableCell>{draft.extracted_date}</TableCell>
                    <TableCell className="text-muted-foreground">{draft.event_sources?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={confidenceColor[draft.extracted_confidence]}>
                        {draft.extracted_confidence}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && edited && (
            <>
              <DialogHeader>
                <DialogTitle>Revisar rascunho</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={edited.title} onChange={(e) => setEdited({ ...edited, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={edited.date} onChange={(e) => setEdited({ ...edited, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Input type="time" value={edited.time} onChange={(e) => setEdited({ ...edited, time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Local (venue)</Label>
                  <Input value={edited.venue} onChange={(e) => setEdited({ ...edited, venue: e.target.value })} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={edited.address} onChange={(e) => setEdited({ ...edited, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={edited.locationCity} onChange={(e) => setEdited({ ...edited, locationCity: e.target.value })} />
                  </div>
                  <div>
                    <Label>Estado (UF)</Label>
                    <Input value={edited.locationState} onChange={(e) => setEdited({ ...edited, locationState: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Lineup (separado por vírgula)</Label>
                  <Input value={edited.lineup} onChange={(e) => setEdited({ ...edited, lineup: e.target.value })} />
                </div>
                <div>
                  <Label>Link de ingressos</Label>
                  <Input value={edited.ticketLink} onChange={(e) => setEdited({ ...edited, ticketLink: e.target.value })} />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={edited.description} onChange={(e) => setEdited({ ...edited, description: e.target.value })} />
                </div>
                {selected.source_raw_excerpt && (
                  <div>
                    <Label className="text-muted-foreground">Trecho original da fonte</Label>
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                      {selected.source_raw_excerpt}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate(selected)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Rejeitar
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ draft: selected, fields: edited })}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Aprovar e publicar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
