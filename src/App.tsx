import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import Index from "./pages/Index";
import GoogleTagManager from "@/components/GoogleTagManager";
import { NewsletterPopup } from "@/components/NewsletterPopup";
import { WebVitals } from "@/components/WebVitals";
import { HotjarAnalytics } from "@/components/HotjarAnalytics";

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
const Admin = lazy(() => import("./pages/Admin"));
const EventsManager = lazy(() => import("./pages/admin/EventsManager"));
const EventsDashboard = lazy(() => import("./pages/admin/EventsDashboard"));
const EventTemplates = lazy(() => import("./pages/admin/EventTemplates"));
const BlogManager = lazy(() => import("./pages/admin/BlogManager"));
const NewsSourcesManager = lazy(() => import("./pages/admin/NewsSourcesManager"));
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
const Redirect = lazy(() => import("./pages/Redirect"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

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
                <GoogleTagManager />
                <WebVitals />
                <HotjarAnalytics />
                <NewsletterPopup />
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
                      
                      {/* Admin Pages */}
                      <Route path="/admin" element={<PageWithError name="Painel Admin"><Admin /></PageWithError>} />
                      <Route path="/admin/events" element={<PageWithError name="Gerenciar Eventos"><EventsManager /></PageWithError>} />
                      <Route path="/admin/events-dashboard" element={<PageWithError name="Dashboard de Eventos"><EventsDashboard /></PageWithError>} />
                      <Route path="/admin/event-templates" element={<PageWithError name="Templates de Eventos"><EventTemplates /></PageWithError>} />
                      <Route path="/admin/blog" element={<PageWithError name="Gerenciar Blog"><BlogManager /></PageWithError>} />
                      <Route path="/admin/news-sources" element={<PageWithError name="Fontes de Notícias"><NewsSourcesManager /></PageWithError>} />
                      <Route path="/admin/ai-content2" element={<PageWithError name="Gerador de Conteúdo IA"><AIContent2 /></PageWithError>} />
                      <Route path="/admin/ai-prompt-templates" element={<PageWithError name="Templates de Prompts"><PromptTemplatesManager /></PageWithError>} />
                      <Route path="/admin/team" element={<PageWithError name="Gerenciar Equipe"><TeamManager /></PageWithError>} />
                      <Route path="/admin/settings" element={<PageWithError name="Configurações"><Settings /></PageWithError>} />
                      <Route path="/admin/links-manager" element={<PageWithError name="Gerenciar Links"><LinksManager /></PageWithError>} />
                      <Route path="/admin/links-analytics" element={<PageWithError name="Analytics de Links"><LinksAnalytics /></PageWithError>} />
                      <Route path="/admin/newsletter-ab-results" element={<PageWithError name="Resultados A/B Newsletter"><NewsletterABResults /></PageWithError>} />
                      <Route path="/admin/newsletter" element={<PageWithError name="Gerenciar Newsletter"><NewsletterManager /></PageWithError>} />
                      
                      <Route path="/admin/system-health" element={<PageWithError name="Status do Sistema"><SystemHealth /></PageWithError>} />
                      <Route path="/admin/recurring-events" element={<PageWithError name="Eventos Recorrentes"><RecurringEventsManager /></PageWithError>} />
                      <Route path="/admin/auto-generation" element={<PageWithError name="Geração Automática"><AutoGenerationDashboard /></PageWithError>} />
                      <Route path="/admin/mdaccula-radio" element={<PageWithError name="Inscrições MDAccula Radio"><PodcastManager /></PageWithError>} />
                      <Route path="/admin/podcast" element={<Navigate to="/admin/mdaccula-radio" replace />} />
                      <Route path="/admin/redirects" element={<PageWithError name="Redirecionador de Links"><RedirectsManager /></PageWithError>} />
                      <Route path="/admin/data-import" element={<PageWithError name="Importação de Dados"><DataImport /></PageWithError>} />
                      
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
