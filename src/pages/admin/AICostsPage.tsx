import { NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AIAnalyticsDashboard from "@/components/admin/AIAnalyticsDashboard";

const AICostsPage = () => {
  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="w-full">
          <div className="mb-6 sm:mb-8">
            <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Painel
            </NavLink>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold hero-text">Custos de IA</h1>
          </div>

          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl">Dashboard de Custos IA</CardTitle>
              <CardDescription className="text-sm">
                Análise detalhada de custos, tokens e comparativo por modelo
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <AIAnalyticsDashboard />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AICostsPage;
