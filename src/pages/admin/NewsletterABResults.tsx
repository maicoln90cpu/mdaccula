import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Eye, CheckCircle, BarChart3, Edit } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface VariantStats {
  id: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
}

const NewsletterABResults = () => {
  const [variants, setVariants] = useState<VariantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [editingVariant, setEditingVariant] = useState<VariantStats | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });

  const fetchVariantStats = useCallback(async () => {
    try {
      // Fetch all variants
      const { data: variantsData, error: variantsError } = await supabase
        .from("newsletter_popup_variants")
        .select("*")
        .order("enabled", { ascending: false });

      if (variantsError) throw variantsError;

      // Fetch analytics for each variant
      const variantStats: VariantStats[] = await Promise.all(
        (variantsData || []).map(async (variant) => {
          const { data: analytics, error: analyticsError } = await supabase
            .from("newsletter_popup_analytics")
            .select("event_type")
            .eq("variant_id", variant.id);

          if (analyticsError) throw analyticsError;

          const impressions = analytics?.filter(a => a.event_type === 'shown').length || 0;
          const conversions = analytics?.filter(a => a.event_type === 'submitted').length || 0;
          const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;

          return {
            id: variant.id,
            name: variant.name,
            title: variant.title,
            description: variant.description,
            enabled: variant.enabled,
            impressions,
            conversions,
            conversionRate,
          };
        })
      );

      setVariants(variantStats);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao carregar estatísticas",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchVariantStats();
  }, [fetchVariantStats]);

  const toggleVariant = async (id: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from("newsletter_popup_variants")
        .update({ enabled: !currentEnabled })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: currentEnabled ? "Variante desativada" : "Variante ativada",
      });

      fetchVariantStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao alterar status",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (variant: VariantStats) => {
    setEditingVariant(variant);
    setEditForm({ title: variant.title, description: variant.description });
  };

  const saveEdit = async () => {
    if (!editingVariant) return;
    
    try {
      const { error } = await supabase
        .from("newsletter_popup_variants")
        .update({ 
          title: editForm.title, 
          description: editForm.description 
        })
        .eq("id", editingVariant.id);
      
      if (error) throw error;
      
      toast({ title: "Variante atualizada com sucesso!" });
      fetchVariantStats();
      setEditingVariant(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ 
        title: "Erro ao atualizar", 
        description: message, 
        variant: "destructive" 
      });
    }
  };

  const bestVariant = variants.reduce((best, current) => 
    current.conversionRate > best.conversionRate ? current : best
  , variants[0]);

  const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
  const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
  const avgConversionRate = totalImpressions > 0 ? (totalConversions / totalImpressions) * 100 : 0;

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="mb-6 sm:mb-8">
            <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Painel
            </NavLink>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Resultados A/B Testing - Newsletter</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Compare o desempenho das variantes do popup de newsletter
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Total de Impressões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-bold">{totalImpressions.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Total de Conversões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-bold">{totalConversions.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Taxa Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-bold">{avgConversionRate.toFixed(2)}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Variantes Ativas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-bold">{variants.filter(v => v.enabled).length}/{variants.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Best Performer */}
          {bestVariant && (
            <Card className="mb-6 sm:mb-8 border-primary/50 bg-primary/5">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <Badge className="mb-2 bg-primary">Melhor Performance</Badge>
                    <CardTitle className="text-xl sm:text-2xl">{bestVariant.name}</CardTitle>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-3xl sm:text-4xl font-bold text-primary">{bestVariant.conversionRate.toFixed(2)}%</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Taxa de Conversão</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Título</p>
                    <p className="font-medium text-sm sm:text-base">{bestVariant.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Impressões</p>
                    <p className="font-medium text-sm sm:text-base">{bestVariant.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversões</p>
                    <p className="font-medium text-sm sm:text-base">{bestVariant.conversions.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Variants Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Comparação de Variantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 sm:space-y-6">
                {variants.map((variant) => (
                  <div key={variant.id} className="border rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{variant.name}</h3>
                          {variant.enabled ? (
                            <Badge className="bg-green-500/20 text-green-500 text-xs">Ativa</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Inativa</Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{variant.title}</p>
                      </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() => toggleVariant(variant.id, variant.enabled)}
                        className="flex-1 sm:flex-none min-h-[44px]"
                      >
                        {variant.enabled ? "Desativar" : "Ativar"}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => handleEdit(variant)}
                        className="flex-1 sm:flex-none min-h-[44px]"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Impressões</p>
                        <p className="text-lg sm:text-xl font-bold">{variant.impressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Conversões</p>
                        <p className="text-lg sm:text-xl font-bold">{variant.conversions.toLocaleString()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Taxa de Conversão</p>
                        <p className="text-lg sm:text-xl font-bold text-primary">{variant.conversionRate.toFixed(2)}%</p>
                      </div>
                    </div>

                    {/* Conversion Rate Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Performance</span>
                        <span>{variant.conversionRate.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                          style={{ width: `${Math.min(variant.conversionRate * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {variants.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma variante encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendation */}
          {bestVariant && variants.length > 1 && (
            <Card className="mt-6 sm:mt-8">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Recomendação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Com base nos dados coletados, a variante <span className="font-semibold text-foreground">"{bestVariant.name}"</span> apresenta 
                  a melhor taxa de conversão ({bestVariant.conversionRate.toFixed(2)}%).
                </p>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {bestVariant.impressions < 100 ? (
                    <>📊 <strong>Atenção:</strong> Dados ainda insuficientes para conclusões definitivas. Recomenda-se coletar pelo menos 100 impressões por variante.</>
                  ) : (
                    <>✅ <strong>Sugestão:</strong> Considere manter apenas esta variante ativa para maximizar as conversões.</>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </main>
        {/* Edit Variant Dialog */}
        <Dialog open={!!editingVariant} onOpenChange={(open) => {
          if (!open) setEditingVariant(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Variante</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingVariant(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveEdit}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default NewsletterABResults;
