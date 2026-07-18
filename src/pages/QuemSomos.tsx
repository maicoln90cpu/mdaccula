import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Users, Calendar, Award, Instagram } from "lucide-react";
import heroImage from "@/assets/sao-paulo-night.jpg";
import logoImage from "@/assets/logo-mdaccula.jpeg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import { OptimizedImage } from "@/components/OptimizedImage";
import { PageHeader } from "@/components/ui/page-header";

const QuemSomos = () => {
  const { data: teamMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const stats = [
    { icon: Music, label: "Eventos Promovidos/ano", value: "500+" },
    { icon: Users, label: "Alcance Mensal", value: "200K+" },
    { icon: Calendar, label: "Anos de Experiência", value: "7+" },
    { icon: Award, label: "Parceiros", value: "50+" },
  ];

  return (
    <>
      <SEOHead
        title="Quem Somos - História da MDAccula"
        description="Conheça a MDAccula, a maior agência de música eletrônica de São Paulo desde 2017. Nossa história, missão e equipe especializada em eventos techno e house."
        keywords={[
          "sobre mdaccula",
          "história dj são paulo",
          "agência música eletrônica sp",
          "equipe mdaccula",
          "dj techno história",
        ]}
        url="https://mdaccula.com/quem-somos"
      />
      <StructuredData
        type="organization"
        data={{
          instagram_link: "https://instagram.com/mdaccula",
          soundcloud_link: "https://soundcloud.com/mdaccula",
        }}
      />
      <StructuredData
        type="breadcrumb"
        data={{
          items: [
            { name: "Home", url: "https://mdaccula.com" },
            { name: "Quem Somos", url: "https://mdaccula.com/quem-somos" },
          ],
        }}
      />

      <div className="min-h-screen">
        <Navigation />
        <main id="main-content" className="pt-16">
          <PageHeader
            title="Quem Somos"
            subtitle="A paixão pela música eletrônica que move São Paulo"
            breadcrumb={[{ label: "Home", href: "/" }, { label: "Quem Somos" }]}
            variant="photo"
            backgroundImage={heroImage}
            align="center"
          />

          {/* Nossa História */}
          <section className="py-20">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold hero-text">Nossa História</h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Fundada com o propósito de amplificar a cena eletrônica brasileira, a MDAccula surgiu como um
                    projeto independente de divulgação e rapidamente evoluiu para uma das referências mais respeitadas
                    do país. O que começou com apoio a artistas e sets promocionais se transformou em uma agência que
                    movimenta milhares de pessoas diariamente, conectando eventos de alto impacto ao público apaixonado
                    pela música eletrônica.
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Com atuação forte em São Paulo e presença constante em estados como Rio de Janeiro, Minas Gerais,
                    Brasília, Curitiba, Santa Catarina e Rio Grande do Sul, a MDAccula se consolidou pela credibilidade,
                    pela comunicação autêntica e pela capacidade de gerar resultados reais. Através do Instagram, grupos
                    de WhatsApp e mailing ativo, a agência impulsiona vendas oficiais, fortalece a cena e mantém relação
                    próxima com produtores e frequentadores.{" "}
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Hoje, mais do que uma agência de divulgação, a MDAccula é parte viva da cultura eletrônica: um
                    movimento que conecta pessoas, celebra diversidade e dá visibilidade aos eventos que fazem a cena
                    pulsar.
                  </p>
                </div>
                <div className="relative h-[500px] rounded-lg overflow-hidden flex items-center justify-center bg-black">
                  <OptimizedImage
                    src={logoImage}
                    alt="Logo MDAccula"
                    className="w-full h-full"
                    objectFit="contain"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Nossa Equipe */}
          <section className="py-20 bg-darker-surface">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4 hero-text">Nossa Equipe</h2>
                <p className="text-xl text-muted-foreground">Conheça quem faz a magia acontecer</p>
              </div>

              {loadingMembers ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="card-hover text-center">
                      <CardContent className="pt-6 space-y-4">
                        <Skeleton className="w-32 h-32 rounded-full mx-auto" />
                        <Skeleton className="h-6 w-3/4 mx-auto" />
                        <Skeleton className="h-4 w-1/2 mx-auto" />
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : teamMembers && teamMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {teamMembers.map((member) => (
                    <Card key={member.id} className="card-hover text-center">
                      <CardContent className="pt-6 space-y-4">
                        <div className="relative w-32 h-32 mx-auto">
                          <OptimizedImage
                            src={member.image_url || "/placeholder.svg"}
                            alt={member.name}
                            className="rounded-full w-full h-full object-cover border-4 border-primary/20"
                            objectFit="cover"
                            variant="thumb"
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-primary">{member.name}</h3>
                          <p className="text-sm text-muted-foreground">{member.position}</p>
                        </div>
                        {member.bio && <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>}
                        {member.instagram_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={member.instagram_url} target="_blank" rel="noopener noreferrer">
                              <Instagram className="w-4 h-4 mr-2" />
                              Instagram
                            </a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Informações da equipe em breve...</p>
              )}
            </div>
          </section>

          {/* Nossos Números */}
          <section className="py-20">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4 hero-text">Nossos Números</h2>
                <p className="text-xl text-muted-foreground">O impacto que criamos na cena eletrônica</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                  <Card key={index} className="text-center card-hover">
                    <CardContent className="pt-8 pb-8">
                      <stat.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
                      <p className="text-3xl font-bold mb-2 text-primary">{stat.value}</p>
                      <p className="text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="py-20 bg-primary/10">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-4xl font-bold mb-6 hero-text">Faça Parte da Nossa História</h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Entre em contato para parcerias, eventos ou apenas para trocar uma ideia sobre música eletrônica
              </p>
              <Button size="lg" asChild>
                <a href="/contato">Fale Conosco</a>
              </Button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default QuemSomos;
