import { useState } from "react";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import { useToast } from "@/hooks/useToast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Instagram, MessageCircle, Music, Mail, MapPin, Clock } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const contactSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").max(255),
  subject: z.string().min(3, "Assunto deve ter pelo menos 3 caracteres").max(200),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(1000),
});

const Contato = () => {
  const { settings, isLoading } = useSiteSettings();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = contactSchema.parse(formData);
      setIsSubmitting(true);

      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: validated,
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: "Entraremos em contato em breve.",
      });

      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao enviar",
          description: "Tente novamente mais tarde.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    settings.whatsapp_number && {
      icon: MessageCircle,
      title: "WhatsApp",
      value: settings.whatsapp_number,
      link: settings.whatsapp_link || `https://wa.me/55${settings.whatsapp_number.replace(/\D/g, '')}`,
      color: "text-secondary"
    },
    {
      icon: Mail,
      title: "Email",
      value: settings.contact_email || "contato@mdaccula.com",
      link: `mailto:${settings.contact_email || "contato@mdaccula.com"}`,
      color: "text-primary"
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: settings.instagram_link ? `@${settings.instagram_link.split('/').pop()}` : "@mdaccula",
      link: settings.instagram_link || "https://instagram.com/mdaccula",
      color: "text-accent"
    },
    {
      icon: Music,
      title: "SoundCloud",
      value: "MDAccula Radio",
      link: settings.soundcloud_link || "https://soundcloud.com/mdaccula",
      color: "text-primary"
    }
  ].filter((info): info is Exclude<typeof info, false | ""> => Boolean(info));

  const workingHours = [
    { day: "Segunda - Sexta", hours: "09:00 - 18:00" },
    { day: "Sábado", hours: "10:00 - 16:00" },
    { day: "Domingo", hours: "Fechado" }
  ];

  return (
    <>
      <SEOHead
        title="Contato - MDAccula DJ e Eventos"
        description="Entre em contato com a MDAccula para contratar DJ techno em SP, parcerias de eventos e informações sobre festas eletrônicas. WhatsApp e Instagram disponíveis."
        keywords={[
          'contato mdaccula',
          'contratar dj são paulo',
          'dj techno sp contato',
          'eventos eletrônicos sp',
          'whatsapp dj são paulo'
        ]}
        url="https://mdaccula.com/contato"
      />
      <StructuredData 
        type="breadcrumb" 
        data={{
          items: [
            { name: 'Home', url: 'https://mdaccula.com' },
            { name: 'Contato', url: 'https://mdaccula.com/contato' }
          ]
        }} 
      />
      
      <div className="min-h-screen">
        <Navigation />
        
        <main id="main-content" className="pt-16">
          {/* Breadcrumb */}
          <div className="container mx-auto px-4 pt-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Contato</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-r from-primary/20 to-accent/20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 hero-text">
              Contato
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Entre em contato conosco e faça parte da cena eletrônica de São Paulo
            </p>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-12 sm:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16">
              {contactInfo.map((info, index) => (
                <Card 
                  key={index} 
                  className="card-hover group cursor-pointer min-h-[180px] flex flex-col justify-center"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="text-center p-4 sm:p-6">
                    <div className="flex justify-center mb-3 sm:mb-4">
                      <info.icon className={`w-10 h-10 sm:w-12 sm:h-12 ${info.color} neon-glow group-hover:scale-110 transition-transform`} />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">{info.title}</h3>
                    <a 
                      href={info.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm sm:text-base ${info.color} hover:opacity-80 transition-opacity break-words`}
                    >
                      {info.value}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
              {/* Contact Form */}
              <Card className="card-hover">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-xl sm:text-2xl hero-text">
                    Envie uma Mensagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm">Nome</Label>
                        <Input 
                          id="name" 
                          placeholder="Seu nome completo" 
                          className="h-12" 
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm">Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="seu@email.com" 
                          className="h-12"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm">Assunto</Label>
                      <Input 
                        id="subject" 
                        placeholder="Sobre o que você quer falar?" 
                        className="h-12"
                        value={formData.subject}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm">Mensagem</Label>
                      <Textarea 
                        id="message" 
                        placeholder="Conte-nos mais detalhes..."
                        rows={6}
                        className="min-h-[150px]"
                        value={formData.message}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full btn-neon min-h-[48px]"
                      disabled={isSubmitting}
                    >
                      <span>{isSubmitting ? "Enviando..." : "Enviar Mensagem"}</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Additional Info */}
              <div className="space-y-8">
                {/* Location */}
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl">
                      <MapPin className="w-5 h-5 mr-2 text-primary" />
                      Localização
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Estamos localizados no coração da cena eletrônica de São Paulo, 
                      sempre próximos dos principais eventos e clubs da cidade.
                    </p>
                    <p className="font-medium">
                      São Paulo, SP - Brasil
                    </p>
                  </CardContent>
                </Card>

                {/* Working Hours */}
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl">
                      <Clock className="w-5 h-5 mr-2 text-secondary" />
                      Horário de Atendimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {workingHours.map((schedule, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-muted-foreground">{schedule.day}</span>
                          <span className="font-medium">{schedule.hours}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-primary">
                        💡 Para eventos urgentes ou de última hora, entre em contato via WhatsApp!
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Contact */}
                <Card className="card-hover bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                  <CardContent className="p-6 text-center">
                    <h3 className="text-xl font-bold mb-4 hero-text">
                      Contato Rápido
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Para informações rápidas sobre eventos ou parcerias
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button asChild className="flex-1">
                        <a 
                          href={settings.whatsapp_link || "https://wa.me/5511999999999"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          WhatsApp
                        </a>
                      </Button>
                      <Button variant="outline" asChild className="flex-1">
                        <a 
                          href={settings.instagram_link || "https://instagram.com/mdaccula"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Instagram className="w-4 h-4 mr-2" />
                          Instagram
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-darker-surface">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 hero-text">
                Perguntas Frequentes
              </h2>
              <p className="text-xl text-muted-foreground">
                Tire suas dúvidas sobre nossos serviços
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="card-hover">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">
                    Como posso comprar ingressos?
                  </h3>
                  <p className="text-muted-foreground">
                    Entre em contato conosco via WhatsApp ou Instagram. Somos promoters 
                    oficiais e garantimos a autenticidade dos ingressos.
                  </p>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">
                    Vocês fazem parcerias com DJs?
                  </h3>
                  <p className="text-muted-foreground">
                    Sim! Trabalhamos com artistas nacionais e internacionais. 
                    Entre em contato para conhecer nossas oportunidades de parceria.
                  </p>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">
                    Como funciona a divulgação de eventos?
                  </h3>
                  <p className="text-muted-foreground">
                    Utilizamos nossas redes sociais, parcerias com influencers e 
                    nossa base de seguidores fiéis para promover eventos.
                  </p>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">
                    Posso confiar nos ingressos?
                  </h3>
                  <p className="text-muted-foreground">
                    Absolutamente! Somos promoters oficiais dos eventos que divulgamos. 
                    Sua segurança e satisfação são nossas prioridades.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Contato;