import { NavLink } from "react-router-dom";
import {
  FileText,
  Calendar,
  Layers,
  RefreshCw,
  Users,
  Sparkles,
  Bot,
  Globe,
  Link as LinkIcon,
  ExternalLink,
  Mail,
  TestTube2,
  Mic,
  PieChart,
  BarChart3,
  Activity,
  Settings,
  HeartPulse,
  Database,
  Newspaper,
  Cpu,
  Megaphone,
  LineChart,
  Wrench,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const sections: AdminSection[] = [
  {
    title: "Conteúdo",
    icon: Newspaper,
    cards: [
      { title: "Blog", description: "Posts e artigos do blog", icon: FileText, href: "/admin/blog", color: "text-green-500" },
      { title: "Eventos", description: "Criar, editar e gerenciar eventos", icon: Calendar, href: "/admin/events", color: "text-blue-500" },
      { title: "Templates de Eventos", description: "Modelos para acelerar criação", icon: Layers, href: "/admin/event-templates", color: "text-sky-500" },
      { title: "Eventos Recorrentes", description: "Eventos gerados automaticamente", icon: RefreshCw, href: "/admin/recurring-events", color: "text-emerald-500" },
      { title: "Equipe", description: "Membros e perfis públicos", icon: Users, href: "/admin/team", color: "text-cyan-500" },
    ],
  },
  {
    title: "Inteligência Artificial",
    icon: Cpu,
    cards: [
      { title: "Conteúdo por IA", description: "Gerar, sugerir e agendar artigos com IA", icon: Sparkles, href: "/admin/ai-content2", color: "text-purple-500" },
      { title: "Fontes", description: "Fontes de notícias e eventos monitoradas pela IA", icon: Globe, href: "/admin/fontes", color: "text-yellow-500" },
      { title: "Configuração de IA", description: "Modelo, prompt de imagem e limites de geração", icon: Bot, href: "/admin/ai-settings", color: "text-indigo-500" },
      { title: "Custos de IA", description: "Análise de custos, tokens e comparativo por modelo", icon: BarChart3, href: "/admin/ai-costs", color: "text-fuchsia-500" },
    ],
  },
  {
    title: "Links & Distribuição",
    icon: Megaphone,
    cards: [
      { title: "Linktree", description: "Links públicos e grupos", icon: LinkIcon, href: "/admin/links-manager", color: "text-teal-500" },
      { title: "Redirecionador", description: "Links curtos com UTM", icon: ExternalLink, href: "/admin/redirects", color: "text-orange-500" },
      { title: "Newsletter", description: "Inscritos e campanhas", icon: Mail, href: "/admin/newsletter", color: "text-pink-500" },
      { title: "Gestão de E-mails", description: "Templates, envio manual, automações e histórico", icon: Mail, href: "/admin/email-config", color: "text-rose-500" },
      { title: "A/B Newsletter", description: "Resultados de variantes", icon: TestTube2, href: "/admin/newsletter-ab-results", color: "text-emerald-500" },
      { title: "MDAccula Radio", description: "Inscrições para sets", icon: Mic, href: "/admin/mdaccula-radio", color: "text-purple-500" },
    ],
  },
  {
    title: "Analytics",
    icon: LineChart,
    cards: [
      { title: "Dashboard de Eventos", description: "Estatísticas visuais", icon: PieChart, href: "/admin/events-dashboard", color: "text-violet-500" },
      { title: "Analytics de Links", description: "Cliques e desempenho", icon: BarChart3, href: "/admin/links-analytics", color: "text-indigo-500" },
      { title: "Monitor de Egress", description: "Consumo de dados e cache", icon: Activity, href: "/admin/egress-monitor", color: "text-red-500" },
    ],
  },
  {
    title: "Sistema",
    icon: Wrench,
    cards: [
      { title: "Configurações", description: "Geral, IA, mídia, timezone", icon: Settings, href: "/admin/settings", color: "text-pink-500" },
      { title: "Status do Sistema", description: "Saúde e performance", icon: HeartPulse, href: "/admin/system-health", color: "text-orange-500" },
      { title: "Importação de Dados", description: "Importar CSVs em massa", icon: Database, href: "/admin/data-import", color: "text-amber-500" },
    ],
  },
];

const Admin = () => {
  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 hero-text">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie todo o site MDAccula a partir daqui</p>
      </div>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          <CardDescription className="text-xs line-clamp-2">{card.description}</CardDescription>
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
  );
};

export default Admin;
