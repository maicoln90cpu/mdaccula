import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, ArrowLeft } from "lucide-react";
import { NavLink } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";

interface NewsSource {
  id: string;
  name: string;
  url: string;
  description: string | null;
  enabled: boolean;
  last_checked_at: string | null;
  created_at: string;
}

const NewsSourcesManager = () => {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    enabled: true,
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_sources")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error("Erro ao buscar fontes:", error);
      toast.error("Erro ao carregar fontes de notícias");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSource) {
        const { error } = await supabase
          .from("news_sources")
          .update(formData)
          .eq("id", editingSource.id);

        if (error) throw error;
        toast.success("Fonte atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("news_sources")
          .insert([formData]);

        if (error) throw error;
        toast.success("Fonte adicionada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchSources();
    } catch (error) {
      console.error("Erro ao salvar fonte:", error);
      toast.error("Erro ao salvar fonte");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta fonte?")) return;

    try {
      const { error } = await supabase
        .from("news_sources")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Fonte excluída com sucesso!");
      fetchSources();
    } catch (error) {
      console.error("Erro ao excluir fonte:", error);
      toast.error("Erro ao excluir fonte");
    }
  };

  const toggleEnabled = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("news_sources")
        .update({ enabled: !currentState })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentState ? "Fonte desativada" : "Fonte ativada");
      fetchSources();
    } catch (error) {
      console.error("Erro ao atualizar fonte:", error);
      toast.error("Erro ao atualizar fonte");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      url: "",
      description: "",
      enabled: true,
    });
    setEditingSource(null);
  };

  const openEditDialog = (source: NewsSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      description: source.description || "",
      enabled: source.enabled,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-4xl font-bold mb-2 hero-text">Fontes de Notícias</h1>
                <p className="text-muted-foreground">
                  Configure os sites que a IA usará como referência para gerar posts
                </p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Fonte
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingSource ? "Editar Fonte" : "Adicionar Nova Fonte"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome da Fonte</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: Resident Advisor"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                          id="url"
                          type="url"
                          value={formData.url}
                          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                          placeholder="https://..."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Breve descrição da fonte"
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="enabled"
                          checked={formData.enabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                        />
                        <Label htmlFor="enabled">Fonte ativa</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">
                        {editingSource ? "Atualizar" : "Adicionar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Carregando fontes...</p>
              </div>
            ) : sources.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhuma fonte cadastrada. Adicione fontes para a IA usar como referência.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sources.map((source) => (
                  <Card key={source.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-xl">{source.name}</CardTitle>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                source.enabled
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {source.enabled ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                          <CardDescription className="break-all">{source.url}</CardDescription>
                          {source.description && (
                            <p className="text-sm text-muted-foreground mt-2">{source.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => toggleEnabled(source.id, source.enabled)}
                          >
                            <Switch checked={source.enabled} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(source)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(source.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default NewsSourcesManager;
