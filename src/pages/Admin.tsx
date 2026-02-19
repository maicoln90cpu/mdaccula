import { NavLink } from "react-router-dom";
import { 
  Calendar, 
  FileText, 
  Settings, 
  Globe, 
  Sparkles, 
  Users, 
  Link as LinkIcon, 
  BarChart3, 
  Layers, 
  Cloud, 
  PieChart, 
  Mail, 
  Activity,
  Newspaper,
  Megaphone,
  Wrench,
  UserCircle,
  RefreshCw,
  Mic
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import ProtectedRoute from "@/components/ProtectedRoute";

interface AdminCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

interface AdminSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  cards: AdminCard[];
}

const Admin = () => {
  const sections: AdminSection[] = [
    {
      title: "Conteúdo",
      icon: Newspaper,
      cards: [
        {
          title: "Gerenciar Blog",
          description: "Gerenciar posts do blog",
          icon: FileText,
          href: "/admin/blog",
          color: "text-green-500",
        },
        {
          title: "Gerenciar Eventos",
          description: "Criar, editar e deletar eventos",
          icon: Calendar,
          href: "/admin/events",
          color: "text-blue-500",
        },
        {
          title: "Gerador de Conteúdo IA",
          description: "Sistema inteligente com templates personalizáveis",
          icon: Sparkles,
          href: "/admin/ai-content2",
          color: "text-purple-500",
        },
        {
          title: "Templates de Prompts",
          description: "Gerenciar templates de IA",
          icon: Layers,
          href: "/admin/ai-prompt-templates",
          color: "text-indigo-500",
        },
        {
          title: "Fontes de Notícias",
          description: "Sites para a IA buscar informações",
          icon: Globe,
          href: "/admin/news-sources",
          color: "text-yellow-500",
        },
        {
          title: "Geração Automática",
          description: "Monitorar e controlar auto-geração",
          icon: RefreshCw,
          href: "/admin/auto-generation",
          color: "text-emerald-500",
        },
      ],
    },
    {
      title: "Links & Newsletter",
      icon: Megaphone,
      cards: [
        {
          title: "Gerenciar Links",
          description: "Configure links e grupos Linktree",
          icon: LinkIcon,
          href: "/admin/links-manager",
          color: "text-teal-500",
        },
        {
          title: "Analytics de Links",
          description: "Performance de links e blog posts",
          icon: BarChart3,
          href: "/admin/links-analytics",
          color: "text-indigo-500",
        },
        {
          title: "MDAccula Radio",
          description: "Gerenciar inscrições para sets",
          icon: Mic,
          href: "/admin/mdaccula-radio",
          color: "text-purple-500",
        },
        {
          title: "Gerenciar Newsletter",
          description: "Inscritos, exportar e campanhas",
          icon: Mail,
          href: "/admin/newsletter",
          color: "text-pink-500",
        },
        {
          title: "Newsletter A/B Testing",
          description: "Resultados e conversões por variante",
          icon: BarChart3,
          href: "/admin/newsletter-ab-results",
          color: "text-emerald-500",
        },
      ],
    },
    {
      title: "Sistema",
      icon: Wrench,
      cards: [
        {
          title: "Configurações",
          description: "Analytics, IA, timezone e mais",
          icon: Settings,
          href: "/admin/settings",
          color: "text-pink-500",
        },
        {
          title: "Backup & Sincronização",
          description: "Backup automático para Supabase externo",
          icon: Cloud,
          href: "/admin/backup-sync",
          color: "text-violet-500",
        },
        {
          title: "Status do Sistema",
          description: "Saúde, performance e qualidade técnica",
          icon: Activity,
          href: "/admin/system-health",
          color: "text-orange-500",
        },
        {
          title: "Dashboard de Eventos",
          description: "Estatísticas e análises visuais",
          icon: PieChart,
          href: "/admin/events-dashboard",
          color: "text-violet-500",
        },
        {
          title: "Templates de Eventos",
          description: "Templates para agilizar criação",
          icon: Layers,
          href: "/admin/event-templates",
          color: "text-sky-500",
        },
        {
          title: "Eventos Recorrentes",
          description: "Eventos criados automaticamente",
          icon: RefreshCw,
          href: "/admin/recurring-events",
          color: "text-emerald-500",
        },
      ],
    },
    {
      title: "Equipe & Ferramentas",
      icon: UserCircle,
      cards: [
        {
          title: "Gerenciar Equipe",
          description: "Editar informações dos membros",
          icon: Users,
          href: "/admin/team",
          color: "text-cyan-500",
        },
        {
          title: "Redirecionador de Links",
          description: "Links curtos com UTM tracking",
          icon: LinkIcon,
          href: "/admin/redirects",
          color: "text-orange-500",
        },
      ],
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 hero-text">Painel Administrativo</h1>
              <p className="text-muted-foreground">Gerencie seu site MDAccula</p>
            </div>

            <div className="space-y-10">
              {sections.map((section) => (
                <section key={section.title}>
                  {/* Section Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <section.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {section.title}
                    </h2>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.cards.map((card) => (
                      <NavLink key={card.href} to={card.href}>
                        <Card className="hover:border-primary transition-all cursor-pointer h-full min-h-[100px]">
                          <CardHeader className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-muted ${card.color} flex-shrink-0`}>
                                <card.icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-base">{card.title}</CardTitle>
                                <CardDescription className="text-xs line-clamp-2">
                                  {card.description}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </NavLink>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Admin;
