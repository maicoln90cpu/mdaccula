import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mic,
  Search,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  Users,
  TrendingUp,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Music,
  Instagram,
  ChevronDown,
  Save,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import type { PodcastSubmission, PodcastSubmissionStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============= STATUS CONFIG =============
const statusConfig: Record<PodcastSubmissionStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  contacted: { label: "Contatado", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: MessageCircle },
  approved: { label: "Aprovado", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "Rejeitado", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
};

// ============= MAIN COMPONENT =============
const PodcastManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<PodcastSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ============= FETCH DATA =============
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["podcast-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PodcastSubmission[];
    },
  });

  // ============= MUTATIONS =============
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PodcastSubmissionStatus }) => {
      const { error } = await supabase
        .from("podcast_submissions")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["podcast-submissions"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("podcast_submissions")
        .update({ admin_notes: notes })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["podcast-submissions"] });
      toast({ title: "Notas salvas!" });
      setIsSavingNotes(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar notas", variant: "destructive" });
      setIsSavingNotes(false);
    },
  });

  // ============= FILTERED DATA =============
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesSearch =
        sub.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.city.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || sub.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [submissions, searchTerm, statusFilter]);

  // ============= METRICS =============
  const metrics = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === "pending").length;
    const contacted = submissions.filter((s) => s.status === "contacted").length;
    const approved = submissions.filter((s) => s.status === "approved").length;
    const rejected = submissions.filter((s) => s.status === "rejected").length;

    return { total, pending, contacted, approved, rejected };
  }, [submissions]);

  // ============= EXPORT CSV =============
  const exportToCSV = () => {
    const headers = [
      "Nome",
      "Email",
      "Telefone",
      "Cidade",
      "Projeto",
      "Tempo",
      "Gênero",
      "Track Autoral",
      "Link Track",
      "Instagram",
      "Spotify",
      "SoundCloud",
      "TikTok",
      "Descrição",
      "Status",
      "Notas Admin",
      "Data Inscrição",
    ];

    const rows = filteredSubmissions.map((sub) => [
      sub.full_name,
      sub.email,
      sub.phone,
      sub.city,
      sub.project_name,
      sub.project_age,
      sub.genre,
      sub.has_original_track ? "Sim" : "Não",
      sub.original_track_link || "",
      sub.instagram || "",
      sub.spotify || "",
      sub.soundcloud || "",
      sub.tiktok || "",
      sub.project_description.replace(/"/g, '""'),
      statusConfig[sub.status].label,
      (sub.admin_notes || "").replace(/"/g, '""'),
      format(new Date(sub.created_at), "dd/MM/yyyy HH:mm"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `podcast-inscricoes-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "CSV exportado com sucesso!" });
  };

  // ============= HANDLERS =============
  const handleOpenDetails = (submission: PodcastSubmission) => {
    setSelectedSubmission(submission);
    setAdminNotes(submission.admin_notes || "");
  };

  const handleSaveNotes = () => {
    if (!selectedSubmission) return;
    setIsSavingNotes(true);
    updateNotesMutation.mutate({ id: selectedSubmission.id, notes: adminNotes });
  };

  const handleStatusChange = (id: string, status: PodcastSubmissionStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  // ============= RENDER =============
  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
                  <Mic className="w-8 h-8 text-primary" />
                  Inscrições Podcast
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie as inscrições para gravação de sets
                </p>
              </div>

              <Button onClick={exportToCSV} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <Card className="bg-card/50">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                  </div>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </CardHeader>
              </Card>
              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <CardTitle className="text-sm font-medium text-yellow-400">Pendentes</CardTitle>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{metrics.pending}</p>
                </CardHeader>
              </Card>
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-400" />
                    <CardTitle className="text-sm font-medium text-blue-400">Contatados</CardTitle>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{metrics.contacted}</p>
                </CardHeader>
              </Card>
              <Card className="bg-green-500/10 border-green-500/30">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <CardTitle className="text-sm font-medium text-green-400">Aprovados</CardTitle>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{metrics.approved}</p>
                </CardHeader>
              </Card>
              <Card className="bg-red-500/10 border-red-500/30">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <CardTitle className="text-sm font-medium text-red-400">Rejeitados</CardTitle>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{metrics.rejected}</p>
                </CardHeader>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, projeto, email ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="contacted">Contatados</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <Card className="bg-card/50">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma inscrição encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Artista</TableHead>
                          <TableHead>Projeto</TableHead>
                          <TableHead>Gênero</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubmissions.map((submission) => {
                          const status = statusConfig[submission.status];
                          const StatusIcon = status.icon;

                          return (
                            <TableRow
                              key={submission.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleOpenDetails(submission)}
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium">{submission.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{submission.email}</p>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{submission.project_name}</TableCell>
                              <TableCell className="text-muted-foreground">{submission.genre}</TableCell>
                              <TableCell className="text-muted-foreground">{submission.city}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={status.color}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(submission.created_at), "dd/MM/yy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm">
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(submission.id, "pending"); }}>
                                      <Clock className="w-4 h-4 mr-2 text-yellow-400" /> Pendente
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(submission.id, "contacted"); }}>
                                      <MessageCircle className="w-4 h-4 mr-2 text-blue-400" /> Contatado
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(submission.id, "approved"); }}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Aprovado
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(submission.id, "rejected"); }}>
                                      <XCircle className="w-4 h-4 mr-2 text-red-400" /> Rejeitado
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        {/* Details Dialog */}
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedSubmission && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-primary" />
                    {selectedSubmission.project_name}
                  </DialogTitle>
                  <DialogDescription>
                    Inscrição de {selectedSubmission.full_name}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status atual:</span>
                    <Select
                      value={selectedSubmission.status}
                      onValueChange={(value) => handleStatusChange(selectedSubmission.id, value as PodcastSubmissionStatus)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="contacted">Contatado</SelectItem>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${selectedSubmission.email}`} className="text-primary hover:underline text-sm">
                        {selectedSubmission.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${selectedSubmission.phone}`} className="text-primary hover:underline text-sm">
                        {selectedSubmission.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedSubmission.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedSubmission.genre}</span>
                    </div>
                  </div>

                  {/* Project Info */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Projeto</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Nome:</span>
                        <p className="font-medium">{selectedSubmission.project_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tempo de existência:</span>
                        <p className="font-medium">{selectedSubmission.project_age}</p>
                      </div>
                    </div>
                    {selectedSubmission.has_original_track && selectedSubmission.original_track_link && (
                      <div>
                        <span className="text-muted-foreground text-sm">Track Autoral:</span>
                        <a
                          href={selectedSubmission.original_track_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-sm mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ouvir track
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Redes Sociais</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubmission.instagram && (
                        <Badge variant="outline" className="gap-1">
                          <Instagram className="w-3 h-3" />
                          {selectedSubmission.instagram}
                        </Badge>
                      )}
                      {selectedSubmission.spotify && (
                        <a href={selectedSubmission.spotify} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="gap-1 hover:bg-green-500/20">
                            <ExternalLink className="w-3 h-3" /> Spotify
                          </Badge>
                        </a>
                      )}
                      {selectedSubmission.soundcloud && (
                        <a href={selectedSubmission.soundcloud} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="gap-1 hover:bg-orange-500/20">
                            <ExternalLink className="w-3 h-3" /> SoundCloud
                          </Badge>
                        </a>
                      )}
                      {selectedSubmission.tiktok && (
                        <Badge variant="outline" className="gap-1">
                          {selectedSubmission.tiktok}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Sobre o Projeto</h4>
                    <p className="text-sm leading-relaxed bg-muted/30 p-4 rounded-lg">
                      {selectedSubmission.project_description}
                    </p>
                  </div>

                  {/* Admin Notes */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notas do Admin</h4>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Adicione notas internas sobre esta inscrição..."
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdminNotes(selectedSubmission.admin_notes || "")}
                      >
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                      >
                        {isSavingNotes ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        Salvar Notas
                      </Button>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="text-xs text-muted-foreground border-t pt-4">
                    <p>Inscrito em: {format(new Date(selectedSubmission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    <p>ID: {selectedSubmission.id}</p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default PodcastManager;