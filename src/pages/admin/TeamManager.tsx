import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/useToast";
import { Loader2, Plus, Edit, Trash2, Instagram, ArrowLeft } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ImageUploadWithCrop } from "@/components/ui/ImageUploadWithCrop";

interface TeamMember {
  id: string;
  name: string;
  position: string;
  bio: string | null;
  image_url: string | null;
  instagram_url: string | null;
  display_order: number;
  active: boolean;
}

const TeamManager = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    bio: "",
    image_url: "",
    instagram_url: "",
    active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      logger.error("Erro ao carregar membros", error, { component: 'TeamManager' });
      toast({
        title: "Erro ao carregar membros",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      position: "",
      bio: "",
      image_url: "",
      instagram_url: "",
      active: true,
    });
    setEditingMember(null);
    setUploadedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let imageUrl = formData.image_url;

      // Upload da imagem se houver arquivo selecionado
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('team-images')
          .upload(filePath, uploadedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('team-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const dataToSave = {
        ...formData,
        image_url: imageUrl
      };
      
      if (editingMember) {
        const { error } = await supabase
          .from("team_members")
          .update(dataToSave)
          .eq("id", editingMember.id);

        if (error) throw error;
        toast({ title: "Membro atualizado com sucesso!" });
      } else {
        const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.display_order)) : 0;
        const { error } = await supabase
          .from("team_members")
          .insert([{ ...dataToSave, display_order: maxOrder + 1 }]);

        if (error) throw error;
        toast({ title: "Membro adicionado com sucesso!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      logger.error("Erro ao salvar membro", error, { component: 'TeamManager' });
      toast({
        title: "Erro ao salvar membro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({ title: "Membro removido com sucesso!" });
      fetchMembers();
    } catch (error) {
      logger.error("Erro ao remover membro", error, { component: 'TeamManager' });
      toast({
        title: "Erro ao remover membro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      position: member.position,
      bio: member.bio || "",
      image_url: member.image_url || "",
      instagram_url: member.instagram_url || "",
      active: member.active,
    });
    setDialogOpen(true);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-20 md:pt-24 pb-12 md:pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <div className="w-full sm:w-auto">
                <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold hero-text">Gerenciar Equipe</h1>
              </div>
              <Button onClick={handleNew} className="w-full sm:w-auto min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Membro
              </Button>
            </div>

            {members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum membro cadastrado.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {members.map((member) => (
                  <Card key={member.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg break-words">{member.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{member.position}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(member)}
                            className="min-w-[44px] min-h-[44px]"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(member.id)}
                            className="min-w-[44px] min-h-[44px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {member.image_url && (
                        <img
                          src={member.image_url}
                          alt={member.name}
                          className="w-full h-48 object-cover rounded-lg mb-4"
                        />
                      )}
                      {member.bio && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {member.bio}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {member.instagram_url && (
                          <a
                            href={member.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                          >
                            <Instagram className="w-4 h-4" />
                            Instagram
                          </a>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${member.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                          {member.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMember ? "Editar Membro" : "Novo Membro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Label htmlFor="position">Cargo *</Label>
                <Input
                  id="position"
                  placeholder="Ex: Fundador, Co-Fundador"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Breve descrição"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <ImageUploadWithCrop
                  onImageSelect={(file) => setUploadedFile(file)}
                  currentImageUrl={formData.image_url}
                  aspectRatio={1}
                  label="Foto do Membro"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Ou insira uma URL abaixo:
                </p>
              </div>
              <div>
                <Label htmlFor="image_url">URL da Foto (opcional)</Label>
                <Input
                  id="image_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="h-12"
                />
              </div>
              <div>
                <Label htmlFor="instagram_url">Instagram</Label>
                <Input
                  id="instagram_url"
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={formData.instagram_url}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 min-h-[48px]">
                  {editingMember ? "Atualizar" : "Adicionar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 min-h-[48px]">
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover este membro?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
};

export default TeamManager;
