import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Layers,
  RefreshCw,
  Users,
  Sparkles,
  Link as LinkIcon,
  Mail,
  TestTube2,
  Mic,
  ExternalLink,
  PieChart,
  BarChart3,
  Activity,
  Settings,
  HeartPulse,
  Database,
  Home,
  Radar,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Geral",
    items: [
      { title: "Painel", url: "/admin", icon: LayoutDashboard },
      { title: "Voltar ao Site", url: "/", icon: Home },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { title: "Blog", url: "/admin/blog", icon: FileText },
      { title: "Eventos", url: "/admin/events", icon: Calendar },
      { title: "Templates de Eventos", url: "/admin/event-templates", icon: Layers },
      { title: "Eventos Recorrentes", url: "/admin/recurring-events", icon: RefreshCw },
      { title: "Equipe", url: "/admin/team", icon: Users },
    ],
  },
  {
    label: "Inteligência Artificial",
    items: [
      { title: "Conteúdo por IA", url: "/admin/ai-content2", icon: Sparkles },
      { title: "Fontes", url: "/admin/fontes", icon: Radar },
    ],
  },
  {
    label: "Links & Distribuição",
    items: [
      { title: "Linktree", url: "/admin/links-manager", icon: LinkIcon },
      { title: "Redirecionador", url: "/admin/redirects", icon: ExternalLink },
      { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
      { title: "Gestão de E-mails", url: "/admin/email-config", icon: Mail },
      { title: "A/B Newsletter", url: "/admin/newsletter-ab-results", icon: TestTube2 },
      { title: "MDAccula Radio", url: "/admin/mdaccula-radio", icon: Mic },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Dashboard de Eventos", url: "/admin/events-dashboard", icon: PieChart },
      { title: "Analytics de Links", url: "/admin/links-analytics", icon: BarChart3 },
      { title: "Monitor de Egress", url: "/admin/egress-monitor", icon: Activity },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/admin/settings", icon: Settings },
      { title: "Status do Sistema", url: "/admin/system-health", icon: HeartPulse },
      { title: "Importação de Dados", url: "/admin/data-import", icon: Database },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string) =>
    url === "/admin" ? pathname === "/admin" : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-4 py-3 border-b">
        {!collapsed ? (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">MDAccula</p>
            <p className="text-sm font-semibold">Painel Admin</p>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
