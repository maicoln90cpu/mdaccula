import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
const Index = lazy(() => import("./pages/Index"));

// Defer non-critical analytics/popup widgets to reduce initial JS
const GoogleTagManager = lazy(() => import("@/components/GoogleTagManager"));
const NewsletterPopup = lazy(() =>
  import("@/components/NewsletterPopup").then((m) => ({ default: m.NewsletterPopup }))
);
const WebVitals = lazy(() =>
  import("@/components/WebVitals").then((m) => ({ default: m.WebVitals }))
);
const HotjarAnalytics = lazy(() =>
  import("@/components/HotjarAnalytics").then((m) => ({ default: m.HotjarAnalytics }))
);

// Lazy load pages for code splitting
const Eventos = lazy(() => import("./pages/Eventos"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const QuemSomos = lazy(() => import("./pages/QuemSomos"));
const Contato = lazy(() => import("./pages/Contato"));
const Login = lazy(() => import("./pages/Login"));
const Auth = lazy(() => import("./pages/Auth"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Links = lazy(() => import("./pages/Links"));
const MDAcculaRadio = lazy(() => import("./pages/Podcast"));
const Search = lazy(() => import("./pages/Search"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages - lazy loaded
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Admin = lazy(() => import("./pages/Admin"));
const EventsManager = lazy(() => import("./pages/admin/EventsManager"));
const EventsDashboard = lazy(() => import("./pages/admin/EventsDashboard"));
const EventTemplates = lazy(() => import("./pages/admin/EventTemplates"));
const BlogManager = lazy(() => import("./pages/admin/BlogManager"));
const NewsSourcesManager = lazy(() => import("./pages/admin/NewsSourcesManager"));
const EventSourcesManager = lazy(() => import("./pages/admin/EventSourcesManager"));
const EventWatchReview = lazy(() => import("./pages/admin/EventWatchReview"));
const AIContent2 = lazy(() => import("./pages/admin/AIContent2"));
const PromptTemplatesManager = lazy(() => import("./pages/admin/PromptTemplatesManager"));
const TeamManager = lazy(() => import("./pages/admin/TeamManager"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const LinksManager = lazy(() => import("./pages/admin/LinksManager"));
const LinksAnalytics = lazy(() => import("./pages/admin/LinksAnalytics"));
const NewsletterABResults = lazy(() => import("./pages/admin/NewsletterABResults"));
const NewsletterManager = lazy(() => import("./pages/admin/NewsletterManager"));

const SystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const RecurringEventsManager = lazy(() => import("./pages/admin/RecurringEventsManager"));
const AutoGenerationDashboard = lazy(() => import("./pages/admin/AutoGenerationDashboard"));
const PodcastManager = lazy(() => import("./pages/admin/PodcastManager"));
const RedirectsManager = lazy(() => import("./pages/admin/RedirectsManager"));
const DataImport = lazy(() => import("./pages/admin/DataImport"));
const EgressMonitor = lazy(() => import("./pages/admin/EgressMonitor"));
const EmailPreview = lazy(() => import("./pages/admin/EmailPreview"));
const EmailConfig = lazy(() => import("./pages/admin/EmailConfig"));
const Redirect = lazy(() => import("./pages/Redirect"));


// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Page wrapper with ErrorBoundary
const PageWithError = ({ 
  children, 
  name 
}: { 
  children: React.ReactNode; 
  name: string;
}) => (
  <ErrorBoundary pageName={name}>
    {children}
  </ErrorBoundary>
);

const App = () => (
  <ErrorBoundary pageName="Aplicação">
    <QueryClientProvider client={queryClient}>
      <SiteSettingsProvider>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <HelmetProvider>
              <TooltipProvider>
                <Suspense fallback={null}>
                  <GoogleTagManager />
                  <WebVitals />
                  <HotjarAnalytics />
                  <NewsletterPopup />
                </Suspense>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public Pages */}
                      <Route path="/" element={<PageWithError name="Página Inicial"><Index /></PageWithError>} />
                      <Route path="/eventos/:slug" element={<PageWithError name="Detalhes do Evento"><EventDetail /></PageWithError>} />
                      <Route path="/eventos" element={<PageWithError name="Eventos"><Eventos /></PageWithError>} />
                      <Route path="/quem-somos" element={<PageWithError name="Quem Somos"><QuemSomos /></PageWithError>} />
                      <Route path="/contato" element={<PageWithError name="Contato"><Contato /></PageWithError>} />
                      <Route path="/login" element={<PageWithError name="Login"><Login /></PageWithError>} />
                      <Route path="/auth" element={<PageWithError name="Autenticação"><Auth /></PageWithError>} />
                      <Route path="/blog" element={<PageWithError name="Blog"><Blog /></PageWithError>} />
                      <Route path="/blog/:slug" element={<PageWithError name="Post do Blog"><BlogPost /></PageWithError>} />
                      <Route path="/busca" element={<PageWithError name="Busca"><Search /></PageWithError>} />
                      <Route path="/MDAcculaRadio" element={<PageWithError name="MDAccula Radio"><MDAcculaRadio /></PageWithError>} />
                      <Route path="/podcast" element={<Navigate to="/MDAcculaRadio" replace />} />
                      <Route path="/analytics" element={<PageWithError name="Analytics"><Analytics /></PageWithError>} />
                      <Route path="/privacidade" element={<PageWithError name="Privacidade"><Privacidade /></PageWithError>} />
                      <Route path="/links" element={<PageWithError name="Links"><Links /></PageWithError>} />
                      <Route path="/links/:slug" element={<PageWithError name="Links"><Links /></PageWithError>} />
                      
                      {/* Admin Pages — wrapped in AdminLayout (sidebar + protected) */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<PageWithError name="Painel Admin"><Admin /></PageWithError>} />
                        <Route path="events" element={<PageWithError name="Gerenciar Eventos"><EventsManager /></PageWithError>} />
                        <Route path="events-dashboard" element={<PageWithError name="Dashboard de Eventos"><EventsDashboard /></PageWithError>} />
                        <Route path="event-templates" element={<PageWithError name="Templates de Eventos"><EventTemplates /></PageWithError>} />
                        <Route path="blog" element={<PageWithError name="Gerenciar Blog"><BlogManager /></PageWithError>} />
                        <Route path="news-sources" element={<PageWithError name="Fontes de Notícias"><NewsSourcesManager /></PageWithError>} />
                        <Route path="event-sources" element={<PageWithError name="Fontes de Eventos"><EventSourcesManager /></PageWithError>} />
                        <Route path="event-watch-review" element={<PageWithError name="Revisão de Eventos"><EventWatchReview /></PageWithError>} />
                        <Route path="ai-content2" element={<PageWithError name="Gerador de Conteúdo IA"><AIContent2 /></PageWithError>} />
                        <Route path="ai-prompt-templates" element={<PageWithError name="Templates de Prompts"><PromptTemplatesManager /></PageWithError>} />
                        <Route path="team" element={<PageWithError name="Gerenciar Equipe"><TeamManager /></PageWithError>} />
                        <Route path="settings" element={<PageWithError name="Configurações"><Settings /></PageWithError>} />
                        <Route path="links-manager" element={<PageWithError name="Gerenciar Links"><LinksManager /></PageWithError>} />
                        <Route path="links-analytics" element={<PageWithError name="Analytics de Links"><LinksAnalytics /></PageWithError>} />
                        <Route path="newsletter-ab-results" element={<PageWithError name="Resultados A/B Newsletter"><NewsletterABResults /></PageWithError>} />
                        <Route path="newsletter" element={<PageWithError name="Gerenciar Newsletter"><NewsletterManager /></PageWithError>} />
                        <Route path="system-health" element={<PageWithError name="Status do Sistema"><SystemHealth /></PageWithError>} />
                        <Route path="recurring-events" element={<PageWithError name="Eventos Recorrentes"><RecurringEventsManager /></PageWithError>} />
                        <Route path="auto-generation" element={<PageWithError name="Geração Automática"><AutoGenerationDashboard /></PageWithError>} />
                        <Route path="mdaccula-radio" element={<PageWithError name="Inscrições MDAccula Radio"><PodcastManager /></PageWithError>} />
                        <Route path="podcast" element={<Navigate to="/admin/mdaccula-radio" replace />} />
                        <Route path="redirects" element={<PageWithError name="Redirecionador de Links"><RedirectsManager /></PageWithError>} />
                        <Route path="data-import" element={<PageWithError name="Importação de Dados"><DataImport /></PageWithError>} />
                        <Route path="egress-monitor" element={<PageWithError name="Monitor de Egress"><EgressMonitor /></PageWithError>} />
                        <Route path="email-preview" element={<PageWithError name="Preview de E-mail"><EmailPreview /></PageWithError>} />
                        <Route path="email-config" element={<PageWithError name="Gestão de E-mails"><EmailConfig /></PageWithError>} />
                      </Route>
                      
                      {/* Redirect shortener */}
                      <Route path="/r/:slug" element={<Redirect />} />
                      
                      {/* Redirects */}
                      <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
                      
                      {/* 404 */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </TooltipProvider>
            </HelmetProvider>
          </ThemeProvider>
        </AuthProvider>
      </SiteSettingsProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
