import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mic,
  MapPin,
  Video,
  Clock,
  Users,
  Music,
  Share2,
  MessageCircle,
  Instagram,
  Globe,
  Send,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { SEOHead } from '@/components/SEOHead';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// ============= VALIDATION SCHEMA =============
const podcastFormSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome muito longo'),
  city: z.string().min(2, 'Cidade inválida').max(100, 'Cidade muito longa'),
  phone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone inválido'),
  project_name: z.string().min(2, 'Nome do projeto muito curto').max(100, 'Nome muito longo'),
  project_age: z.string().min(1, 'Informe há quanto tempo existe').max(50, 'Texto muito longo'),
  genre: z.string().min(2, 'Informe a vertente/gênero').max(100, 'Texto muito longo'),
  has_original_track: z.boolean().default(false),
  original_track_link: z.string().url('URL inválida').optional().or(z.literal('')),
  instagram: z.string().max(100, 'Instagram muito longo').optional().or(z.literal('')),
  spotify: z.string().url('URL inválida').optional().or(z.literal('')),
  soundcloud: z.string().url('URL inválida').optional().or(z.literal('')),
  tiktok: z.string().max(100, 'TikTok muito longo').optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').max(255, 'E-mail muito longo'),
  project_description: z
    .string()
    .min(20, 'Descreva melhor seu projeto (mínimo 20 caracteres)')
    .max(1000, 'Descrição muito longa'),
});

type PodcastFormData = z.infer<typeof podcastFormSchema>;

// ============= INFO CARDS DATA =============
const howItWorksCards = [
  {
    icon: MapPin,
    title: 'LOCAL',
    description:
      'Nosso canal conta com a parceria da Methodus School, uma escola extremamente preparada com todos os equipamentos disponíveis para você gravar o seu set.',
    gradient: 'from-primary to-accent',
  },
  {
    icon: Video,
    title: 'GRAVAÇÃO',
    description:
      'A gravação será via áudio + takes via mobile pelo creator MDAccula que disponibilizará todo material após 02 dias úteis da gravação para que você possa utilizar.',
    gradient: 'from-secondary to-primary',
  },
  {
    icon: Clock,
    title: 'DURAÇÃO DO SET',
    description: '01 hora de set exclusivo para você mostrar seu talento e estilo musical.',
    gradient: 'from-accent to-secondary',
  },
  {
    icon: Users,
    title: 'CONVIDADOS',
    description:
      'O artista terá uma lista de convidados para que possam fazer parte do dia da gravação e a vibe ficar lá em cima!',
    gradient: 'from-primary to-secondary',
  },
];

const divulgationCards = [
  {
    icon: Music,
    title: 'SOUNDCLOUD',
    description:
      'O set será divulgado no canal do MDAccula Radio no SoundCloud! Ele ficará disponível para total acesso.',
    gradient: 'from-[#ff5500] to-[#ff8800]',
  },
  {
    icon: MessageCircle,
    title: 'GRUPOS DE WHATSAPP',
    description:
      'Realizamos o disparo em +300 grupos ativos do MDAccula, solicitando a todos que dêem o play e compartilhem o set.',
    gradient: 'from-[#25d366] to-[#128c7e]',
  },
  {
    icon: Share2,
    title: 'AÇÃO',
    description:
      'Pedimos aos parceiros MDAccula para compartilhar o set como forma de ação de algum evento que estamos trabalhando.',
    gradient: 'from-primary to-accent',
  },
  {
    icon: Instagram,
    title: 'REDES SOCIAIS',
    description:
      'Todos os vídeos ficarão em destaque no perfil principal do IG do MDAccula, será compartilhado no TikTok o reels final editado e nas demais redes sociais.',
    gradient: 'from-[#e4405f] to-[#833ab4]',
  },
  {
    icon: Globe,
    title: 'SITE & OUTRAS PLATAFORMAS',
    description:
      'Facebook, Threads e site oficial MDAccula também receberão o conteúdo para máxima divulgação.',
    gradient: 'from-secondary to-primary',
  },
];

// ============= MAIN COMPONENT =============
const Podcast = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<PodcastFormData>({
    resolver: zodResolver(podcastFormSchema),
    defaultValues: {
      full_name: '',
      city: '',
      phone: '',
      project_name: '',
      project_age: '',
      genre: '',
      has_original_track: false,
      original_track_link: '',
      instagram: '',
      spotify: '',
      soundcloud: '',
      tiktok: '',
      email: '',
      project_description: '',
    },
  });

  const onSubmit = async (data: PodcastFormData) => {
    setIsSubmitting(true);

    try {
      // 1. Insert into database
      const { data: insertedData, error: insertError } = await supabase
        .from('podcast_submissions')
        .insert({
          full_name: data.full_name,
          city: data.city,
          phone: data.phone,
          project_name: data.project_name,
          project_age: data.project_age,
          genre: data.genre,
          has_original_track: data.has_original_track,
          original_track_link: data.original_track_link || null,
          instagram: data.instagram || null,
          spotify: data.spotify || null,
          soundcloud: data.soundcloud || null,
          tiktok: data.tiktok || null,
          email: data.email,
          project_description: data.project_description,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // 2. Trigger notification emails
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-podcast-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify(insertedData),
          }
        );

        if (!response.ok) {
          console.error('Error sending notification emails');
        }
      } catch (emailError) {
        console.error('Failed to send notification:', emailError);
        // Continue anyway - registration was successful
      }

      setIsSubmitted(true);
      toast({
        title: 'Inscrição enviada! 🎉',
        description: 'Recebemos seus dados. Entraremos em contato em breve!',
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="MDAccula Radio | Envie seu Set para Análise Gratuita"
        description="Participe do MDAccula Radio: envie seu material para uma análise 100% gratuita. Se aprovado, grave seu set exclusivo com divulgação em +300 grupos de WhatsApp, SoundCloud e redes sociais."
        type="website"
      />

      <Navigation />

      <main id="main-content" className="min-h-screen pt-16">
        {/* ============= HERO SECTION ============= */}
        <PageHeader
          variant="radial"
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'MDAccula Radio' }]}
        >
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                <Mic className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">MDAccula Radio</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/30">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium text-secondary">
                  Análise do material é gratuita
                </span>
              </div>
            </div>

            <h1 className="text-display text-gradient mb-6">Participe do MDAccula Radio</h1>

            <p className="text-xl md:text-2xl text-foreground mb-4 font-medium">
              Aqui você tem o seu projeto divulgado como merece!
            </p>

            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Com o formato de "social live" nosso canal tem como objetivo trazer novos talentos
              para a cena eletrônica. Se você quer fazer parte e ter seu projeto divulgado por todos
              os canais e redes do MDAccula, sua chance está aqui!
            </p>

            <p className="mt-6 text-accent font-semibold text-lg">
              Envie seu material — a análise é 100% gratuita. Se aprovado, você grava seu set
              exclusivo! 🚀
            </p>
          </div>
        </PageHeader>

        {/* ============= COMO FUNCIONA ============= */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-headline text-center mb-4">
              <span className="text-gradient">COMO FUNCIONA</span>
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Conheça o processo completo de gravação do seu set exclusivo
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howItWorksCards.map((card) => (
                <Card
                  key={card.title}
                  className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300 group"
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                    >
                      <card.icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============= DIVULGAÇÃO ============= */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-headline text-center mb-4">
              <span className="text-gradient">DIVULGAÇÃO / REDES</span>
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Seu set será divulgado em múltiplas plataformas para máximo alcance
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {divulgationCards.map((card) => (
                <Card
                  key={card.title}
                  className="bg-card/50 backdrop-blur border-border/50 hover:border-secondary/50 transition-all duration-300 group"
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}
                    >
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============= FORMULÁRIO (ETAPA 1 - GRÁTIS) ============= */}
        <section className="py-16" id="inscricao">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-semibold uppercase tracking-wide mb-3">
                  Etapa 1 · Grátis
                </span>
                <h2 className="text-headline">
                  <span className="text-gradient">ENVIE SEU MATERIAL PARA ANÁLISE</span>
                </h2>
              </div>
              <p className="text-muted-foreground text-center mb-8">
                Preencha o formulário abaixo — a análise do seu perfil é 100% gratuita. Aguarde o
                nosso contato!
              </p>

              {isSubmitted ? (
                <Card className="bg-card/50 backdrop-blur border-primary/30">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-4">
                      Inscrição Enviada! 🎉
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Recebemos seus dados com sucesso. Nossa equipe irá analisar seu perfil e
                      entraremos em contato em breve através do e-mail ou WhatsApp informado.
                    </p>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                      Enviar Nova Inscrição
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-6 md:p-8">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Dados Pessoais */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                            Dados Pessoais
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="full_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nome Completo *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Seu nome completo" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>E-mail *</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="seu@email.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Cidade *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="São Paulo - SP" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Telefone com DDD *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="(11) 99999-9999" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Dados do Projeto */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                            Dados do Projeto
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="project_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nome do Projeto *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="DJ Example" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="project_age"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Há quanto tempo existe *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="2 anos" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="genre"
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>Vertente/Gênero *</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Tech House, Melodic Techno, etc."
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="has_original_track"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    Possui track autoral?
                                  </FormLabel>
                                </FormItem>
                              )}
                            />

                            {form.watch('has_original_track') && (
                              <FormField
                                control={form.control}
                                name="original_track_link"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Link da track autoral</FormLabel>
                                    <FormControl>
                                      <Input placeholder="https://soundcloud.com/..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                        </div>

                        {/* Redes Sociais */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                            Redes Sociais
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="instagram"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Instagram</FormLabel>
                                  <FormControl>
                                    <Input placeholder="@seuinstagram" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tiktok"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>TikTok</FormLabel>
                                  <FormControl>
                                    <Input placeholder="@seutiktok" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="spotify"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spotify (URL do perfil)</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="https://open.spotify.com/artist/..."
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="soundcloud"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SoundCloud (URL do perfil)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://soundcloud.com/..." {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Descrição */}
                        <FormField
                          control={form.control}
                          name="project_description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Resuma sobre seu projeto *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Conte um pouco sobre sua trajetória, estilo musical, eventos que já tocou..."
                                  className="min-h-[120px] resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full h-12 text-lg"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              Enviar Inscrição
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>

        {/* ============= ETAPA 2 - GRAVAÇÃO (PAGA, SÓ SE APROVADO) ============= */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <Card className="bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/30 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.2),transparent_70%)]" />
                <CardContent className="p-8 md:p-12 text-center relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-4">
                    Etapa 2 · Após aprovação
                  </span>
                  <h2 className="text-headline mb-2">GRAVAÇÃO PROFISSIONAL</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mt-2">
                    Se o seu projeto for aprovado na análise gratuita, a gravação exclusiva no
                    estúdio parceiro (Methodus School) tem o valor de:
                  </p>
                  <div className="text-5xl md:text-6xl font-bold text-gradient my-6">
                    R$ 1.200<span className="text-2xl">,00</span>
                  </div>
                  <p className="text-muted-foreground">
                    Pago via <span className="font-semibold text-foreground">PIX</span>, somente
                    após a aprovação — cobre estrutura e equipamento do estúdio
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ============= TEXTO FINAL ============= */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                <strong className="text-foreground">União, apoio e conexão.</strong> Estes são
                alguns pilares que fazem parte da essência da MDAccula, um núcleo que vai muito além
                da promoção de eventos e busca promover uma verdadeira rede de networking entre DJs,
                produtores e players da cena.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Aqui você poderá ouvir com exclusividade sets de artistas que possuem uma ligação
                com o time da MDAccula, além disso, curtir os sets dos eventos produzidos pela
                marca. Queremos dar espaço e ajudar a reverberar o talento de tantos, ótimos, DJs
                que temos na cena nacional.
              </p>
              <p className="text-xl font-semibold text-gradient">
                Ouça, apoie e leve essa mensagem para frente!
              </p>
              <p className="text-2xl font-bold text-accent mt-4">
                Venha fazer parte desse time! 💜
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default Podcast;
