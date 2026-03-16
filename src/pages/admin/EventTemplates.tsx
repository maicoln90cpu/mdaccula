import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Plus, Trash2, Edit2, Save, X, ArrowLeft } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ImageUploadWithCrop } from "@/components/ui/ImageUploadWithCrop";
import { convertToWebP } from "@/lib/webpConverter";
import { uploadImageToBunny } from "@/lib/bunnyUploader";

interface EventTemplate {
  id: string;
  name: string;
  venue: string;
  address: string | null;
  location_city: string;
  location_state: string;
  genres: string[];
  ticket_link: string | null;
  vip_link: string | null;
  image_url: string | null;
  title?: string | null;
  subtitle?: string | null;
  time?: string | null;
  description?: string | null;
}

const GENRES = [
  'Techno', 'House', 'Tech House', 'Deep House', 'Progressive', 'Trance', 
  'Psytrance', 'Drum & Bass', 'Dubstep', 'Trap', 'Hip Hop', 'Funk',
  'Sertanejo', 'Pagode', 'Samba', 'Rock', 'Pop', 'Eletrônica', 'EDM',
  'Open Format', 'Festival', 'Outros'
];

const STATES = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'PE', 'CE', 'PA', 
  'MA', 'PB', 'ES', 'PI', 'AL', 'RN', 'MT', 'MS', 'DF', 'SE', 'RO', 
  'TO', 'AC', 'AM', 'RR', 'AP'
];

const EventTemplates = () => {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    venue: "",
    address: "",
    location_city: "",
    location_state: "SP",
    genres: [] as string[],
    ticket_link: "",
    vip_link: "",
    image_url: "",
    title: "",
    subtitle: "",
    time: "",
    description: ""
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("event_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      logger.error("Erro ao buscar templates", error, { component: 'EventTemplates' });
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    
    try {
      const webpFile = await convertToWebP(imageFile);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, webpFile, { contentType: 'image/webp' });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error("Erro ao fazer upload da imagem");
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Upload de imagem se houver
      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploaded = await uploadImage();
        if (!uploaded) {
          setSubmitting(false);
          return;
        }
        imageUrl = uploaded;
      }

      const templateData = {
        name: formData.name,
        venue: formData.venue,
        address: formData.address || null,
        location_city: formData.location_city,
        location_state: formData.location_state,
        genres: formData.genres,
        ticket_link: formData.ticket_link || null,
        vip_link: formData.vip_link || null,
        image_url: imageUrl || null,
        title: formData.title || null,
        subtitle: formData.subtitle || null,
        time: formData.time || null,
        description: formData.description || null
      };
      
      if (editingId) {
        const { error } = await supabase
          .from("event_templates")
          .update(templateData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("event_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      resetForm();
      fetchTemplates();
    } catch (error) {
      logger.error("Erro ao salvar template", error, { component: 'EventTemplates' });
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar template";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (template: EventTemplate) => {
    setFormData({
      name: template.name,
      venue: template.venue,
      address: template.address || "",
      location_city: template.location_city,
      location_state: template.location_state,
      genres: template.genres || [],
      ticket_link: template.ticket_link || "",
      vip_link: template.vip_link || "",
      image_url: template.image_url || "",
      title: template.title || "",
      subtitle: template.subtitle || "",
      time: template.time || "",
      description: template.description || ""
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este template?")) return;

    try {
      const { error } = await supabase
        .from("event_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template deletado com sucesso!");
      fetchTemplates();
    } catch (error) {
      logger.error("Erro ao deletar template", error, { component: 'EventTemplates' });
      const errorMessage = error instanceof Error ? error.message : "Erro ao deletar template";
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      venue: "",
      address: "",
      location_city: "",
      location_state: "SP",
      genres: [],
      ticket_link: "",
      vip_link: "",
      image_url: "",
      title: "",
      subtitle: "",
      time: "",
      description: ""
    });
    setImageFile(null);
    setEditingId(null);
    setShowForm(false);
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const getVipLinkValue = () => {
    if (!formData.vip_link) return 'none';
    if (formData.vip_link.includes('5511999136884')) return 'maicoln';
    if (formData.vip_link.includes('5511997819194')) return 'guilherme';
    return 'none';
  };

  const handleVipLinkChange = (value: string) => {
    if (value === 'none') {
      setFormData({ ...formData, vip_link: '' });
    } else if (value === 'maicoln') {
      const message = `Olá MD, queria ver um camarote para ${formData.title || 'evento'}`;
      setFormData({
        ...formData,
        vip_link: `https://api.whatsapp.com/send?phone=5511999136884&text=${encodeURIComponent(message)}`
      });
    } else if (value === 'guilherme') {
      const message = `Olá Gui, queria ver um camarote para ${formData.title || 'evento'}`;
      setFormData({
        ...formData,
        vip_link: `https://api.whatsapp.com/send?phone=5511997819194&text=${encodeURIComponent(message)}`
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-8 pt-24">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-3xl font-bold">Templates de Eventos</h1>
                <p className="text-muted-foreground mt-2">
                  Crie templates com dados pré-preenchidos para agilizar a criação de eventos
                </p>
              </div>
              <Button onClick={() => setShowForm(true)} disabled={showForm}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </div>

            {showForm && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>{editingId ? "Editar Template" : "Novo Template"}</CardTitle>
                  <CardDescription>
                    Preencha os dados que devem ser reutilizados em múltiplos eventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Nome do Template *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: The Year"
                          required
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="title">Título do Evento</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Noite Techno na Casa Azul"
                          disabled={submitting}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="subtitle">Subtítulo</Label>
                        <Input
                          id="subtitle"
                          value={formData.subtitle}
                          onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                          placeholder="Ex: Especial Aniversário"
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="time">Horário de Início</Label>
                        <Input
                          id="time"
                          type="time"
                          value={formData.time}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="venue">Local *</Label>
                        <Input
                          id="venue"
                          value={formData.venue}
                          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                          placeholder="Ex: The Year"
                          required
                          disabled={submitting}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descrição completa do evento..."
                          rows={4}
                          disabled={submitting}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Imagem do Evento</Label>
                        <ImageUploadWithCrop
                          onImageSelect={(file) => setImageFile(file)}
                          currentImageUrl={formData.image_url}
                          aspectRatio={16/9}
                          label="Imagem do Template"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Ex: Rua Barra Funda, 1020 - Barra Funda"
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="location_city">Cidade *</Label>
                        <Input
                          id="location_city"
                          value={formData.location_city}
                          onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                          placeholder="Ex: São Paulo"
                          required
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="location_state">Estado *</Label>
                        <Select 
                          value={formData.location_state} 
                          onValueChange={(value) => setFormData({ ...formData, location_state: value })}
                          disabled={submitting}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATES.map(state => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="ticket_link">Link de Ingressos</Label>
                        <Input
                          id="ticket_link"
                          value={formData.ticket_link}
                          onChange={(e) => setFormData({ ...formData, ticket_link: e.target.value })}
                          placeholder="https://..."
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <Label htmlFor="vip_link">Link Camarote</Label>
                        <Select value={getVipLinkValue()} onValueChange={handleVipLinkChange} disabled={submitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma opção" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="maicoln">Maicoln Douglas</SelectItem>
                            <SelectItem value="guilherme">Guilherme Accula</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Label>Gêneros Musicais</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {GENRES.map(genre => (
                            <Badge
                              key={genre}
                              variant={formData.genres.includes(genre) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => !submitting && toggleGenre(genre)}
                            >
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" disabled={submitting}>
                        <Save className="w-4 h-4 mr-2" />
                        {submitting ? 'Salvando...' : editingId ? "Salvar Alterações" : "Criar Template"}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Nenhum template criado ainda</p>
                  </CardContent>
                </Card>
              ) : (
                templates.map(template => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{template.name}</CardTitle>
                          {template.title && <p className="text-sm text-muted-foreground mt-1">{template.title}</p>}
                          <CardDescription className="mt-2">
                            <strong>{template.venue}</strong> - {template.location_city}, {template.location_state}
                            {template.address && <><br />{template.address}</>}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(template.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {template.genres.length > 0 && (
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {template.genres.map(genre => (
                            <Badge key={genre} variant="secondary">{genre}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default EventTemplates;
