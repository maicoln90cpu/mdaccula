import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { format, subDays, subWeeks, subMonths, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// Custo por 1M de tokens (input/output) - Preços atualizados 2025
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Google Gemini
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-2.5-flash-lite": { input: 0.018, output: 0.075 },
  // Nano Banana (Image Generation)
  "google/gemini-2.5-flash-image-preview": { input: 0.04, output: 0.04 },
  // OpenAI GPT-5 series
  "openai/gpt-5": { input: 1.25, output: 10.00 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.00 },
  "openai/gpt-5-nano": { input: 0.05, output: 0.40 },
  // OpenAI GPT-4.1 series
  "openai/gpt-4.1": { input: 2.00, output: 8.00 },
  "openai/gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "openai/gpt-4.1-nano": { input: 0.10, output: 0.40 },
  // OpenAI GPT-4o series
  "openai/gpt-4o": { input: 2.50, output: 10.00 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.60 },
  // OpenAI Reasoning models
  "openai/o3": { input: 2.00, output: 8.00 },
  "openai/o3-mini": { input: 1.10, output: 4.40 },
  "openai/o4-mini": { input: 1.10, output: 4.40 },
};

// Custo estimado por artigo (usado apenas quando não há dados de tokens)
const ESTIMATED_COST_PER_ARTICLE: Record<string, number> = {
  "google/gemini-2.5-flash": 0.0007,
  "google/gemini-2.5-pro": 0.012,
  "google/gemini-2.5-flash-lite": 0.0002,
  "google/gemini-2.5-flash-image-preview": 0.04,
  "openai/gpt-5": 0.022,
  "openai/gpt-5-mini": 0.0044,
  "openai/gpt-5-nano": 0.0009,
  "openai/gpt-4.1": 0.019,
  "openai/gpt-4.1-mini": 0.0038,
  "openai/gpt-4.1-nano": 0.001,
  "openai/gpt-4o": 0.024,
  "openai/gpt-4o-mini": 0.0014,
  "openai/o3": 0.019,
  "openai/o3-mini": 0.0105,
  "openai/o4-mini": 0.0105,
};

// Custo estimado por imagem gerada (Nano Banana)
const ESTIMATED_COST_PER_IMAGE = 0.04;

interface AIPost {
  id: string;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  image_tokens: number | null;
  generated_at: string | null;
}

interface ChartData {
  date: string;
  tokens: number;
  cost: number;
  posts: number;
  imageCost: number;
}

interface ModelComparison {
  model: string;
  posts: number;
  totalTokens: number;
  cost: number;
  hasRealData: boolean;
  isImageModel?: boolean;
}

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export const AIAnalyticsDashboard = () => {
  const [posts, setPosts] = useState<AIPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_generated_posts")
        .select("id, model_used, input_tokens, output_tokens, total_tokens, image_tokens, generated_at")
        .order("generated_at", { ascending: true });

      if (error) throw error;
      setPosts((data as AIPost[]) || []);
    } catch (error) {
      console.error("Error fetching AI posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRealCost = (model: string, inputTokens: number, outputTokens: number): number => {
    const costs = MODEL_COSTS[model] || MODEL_COSTS["google/gemini-2.5-flash"];
    return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
  };

  const getModelComparison = (): ModelComparison[] => {
    const modelData: Record<string, { 
      posts: number; 
      totalTokens: number; 
      inputTokens: number; 
      outputTokens: number;
      postsWithTokens: number;
      imageTokens: number;
      postsWithImages: number;
    }> = {};

    // Initialize Nano Banana model entry
    modelData["google/gemini-2.5-flash-image-preview"] = { 
      posts: 0, 
      totalTokens: 0, 
      inputTokens: 0, 
      outputTokens: 0, 
      postsWithTokens: 0,
      imageTokens: 0,
      postsWithImages: 0
    };

    posts.forEach((post) => {
      const model = post.model_used || "desconhecido";
      if (!modelData[model]) {
        modelData[model] = { posts: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, postsWithTokens: 0, imageTokens: 0, postsWithImages: 0 };
      }
      modelData[model].posts += 1;
      modelData[model].totalTokens += post.total_tokens || 0;
      modelData[model].inputTokens += post.input_tokens || 0;
      modelData[model].outputTokens += post.output_tokens || 0;
      if (post.total_tokens && post.total_tokens > 0) {
        modelData[model].postsWithTokens += 1;
      }

      // Track image tokens separately for Nano Banana
      if (post.image_tokens && post.image_tokens > 0) {
        modelData["google/gemini-2.5-flash-image-preview"].imageTokens += post.image_tokens;
        modelData["google/gemini-2.5-flash-image-preview"].postsWithImages += 1;
      }
    });

    // Count posts with images for Nano Banana
    const postsWithImages = posts.filter(p => p.image_tokens && p.image_tokens > 0).length;
    modelData["google/gemini-2.5-flash-image-preview"].posts = postsWithImages;

    const results: ModelComparison[] = [];

    // Add text models
    Object.entries(modelData).forEach(([model, data]) => {
      if (model === "google/gemini-2.5-flash-image-preview") return; // Handle separately
      
      const hasRealData = data.totalTokens > 0;
      const cost = hasRealData
        ? calculateRealCost(model, data.inputTokens, data.outputTokens)
        : (ESTIMATED_COST_PER_ARTICLE[model] || 0.015) * data.posts;

      if (data.posts > 0) {
        results.push({
          model,
          posts: data.posts,
          totalTokens: data.totalTokens,
          cost,
          hasRealData,
        });
      }
    });

    // Add Nano Banana (image generation) separately - usando APENAS dados reais
    const nanoBananaData = modelData["google/gemini-2.5-flash-image-preview"];
    const realImageCount = posts.filter(p => p.image_tokens && p.image_tokens > 0).length;
    const totalImageTokens = posts.reduce((acc, p) => acc + (p.image_tokens || 0), 0);
    
    if (realImageCount > 0) {
      results.push({
        model: "Nano Banana (Imagens)",
        posts: realImageCount,
        totalTokens: totalImageTokens,
        cost: (totalImageTokens / 1_000_000) * 0.04,
        hasRealData: true,
        isImageModel: true,
      });
    }

    return results;
  };

  const getChartData = (): ChartData[] => {
    const now = new Date();
    let startDate: Date;
    let groupBy: (date: Date) => string;
    let dateFormat: string;

    switch (period) {
      case "daily":
        startDate = subDays(now, 30);
        groupBy = (date) => format(startOfDay(date), "yyyy-MM-dd");
        dateFormat = "dd/MM";
        break;
      case "weekly":
        startDate = subWeeks(now, 12);
        groupBy = (date) => format(startOfWeek(date, { locale: ptBR }), "yyyy-MM-dd");
        dateFormat = "dd/MM";
        break;
      case "monthly":
        startDate = subMonths(now, 12);
        groupBy = (date) => format(startOfMonth(date), "yyyy-MM");
        dateFormat = "MMM/yy";
        break;
    }

    const grouped: Record<string, { tokens: number; cost: number; posts: number; imageCost: number }> = {};

    posts
      .filter((post) => post.generated_at && new Date(post.generated_at) >= startDate)
      .forEach((post) => {
        const key = groupBy(new Date(post.generated_at!));
        if (!grouped[key]) {
          grouped[key] = { tokens: 0, cost: 0, posts: 0, imageCost: 0 };
        }
        grouped[key].tokens += post.total_tokens || 0;
        
        const hasTokens = (post.total_tokens || 0) > 0;
        if (hasTokens) {
          grouped[key].cost += calculateRealCost(
            post.model_used || "google/gemini-2.5-flash",
            post.input_tokens || 0,
            post.output_tokens || 0
          );
        } else {
          grouped[key].cost += ESTIMATED_COST_PER_ARTICLE[post.model_used || "google/gemini-2.5-flash"] || 0.015;
        }

        // Add image cost - APENAS dados reais, sem estimativas
        if (post.image_tokens && post.image_tokens > 0) {
          grouped[key].imageCost += (post.image_tokens / 1_000_000) * 0.04;
        }

        grouped[key].posts += 1;
      });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: format(new Date(date), dateFormat, { locale: ptBR }),
        tokens: data.tokens,
        cost: Number((data.cost + data.imageCost).toFixed(4)),
        posts: data.posts,
        imageCost: Number(data.imageCost.toFixed(4)),
      }));
  };

  const getPieData = () => {
    const comparison = getModelComparison();
    return comparison.map((item) => ({
      name: item.isImageModel ? "Imagens" : (item.model.split("/").pop() || item.model),
      value: item.isImageModel ? item.posts : item.totalTokens,
      cost: item.cost,
    }));
  };

  const modelComparison = getModelComparison();
  const totalCost = modelComparison.reduce((acc, item) => acc + item.cost, 0);
  const hasAnyRealData = modelComparison.some(item => item.hasRealData);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum post gerado com IA ainda. Gere alguns artigos para ver as estatísticas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Posts</CardDescription>
            <CardTitle className="text-2xl">{posts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tokens (Texto)</CardDescription>
            <CardTitle className="text-2xl">
              {posts.reduce((acc, p) => acc + (p.total_tokens || 0), 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Imagens Geradas</CardDescription>
            <CardTitle className="text-2xl">
              {posts.filter(p => p.image_tokens && p.image_tokens > 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Custo Total {!hasAnyRealData && <span className="text-xs">(est.)</span>}
            </CardDescription>
            <CardTitle className="text-2xl text-primary">${totalCost.toFixed(4)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Cost Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custos por Modelo de IA</CardTitle>
          <CardDescription>
            {hasAnyRealData 
              ? "Custo real baseado em tokens utilizados" 
              : "Custo estimado (sem dados de tokens disponíveis)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">Modelo</th>
                  <th className="text-right py-2 px-2">Qtd</th>
                  <th className="text-right py-2 px-2">Tokens/Imgs</th>
                  <th className="text-right py-2 px-2">Custo</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.map((item) => (
                  <tr key={item.model} className={`border-b border-border/50 ${item.isImageModel ? 'bg-primary/5' : ''}`}>
                    <td className="py-2 px-2 font-medium truncate max-w-[150px]">
                      {item.isImageModel ? (
                        <span className="flex items-center gap-1">
                          🖼️ {item.model}
                        </span>
                      ) : (
                        item.model.split("/").pop()
                      )}
                    </td>
                    <td className="text-right py-2 px-2">{item.posts}</td>
                    <td className="text-right py-2 px-2">
                      {item.isImageModel 
                        ? `${item.posts} imgs`
                        : (item.totalTokens > 0 ? item.totalTokens.toLocaleString() : "-")
                      }
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={item.hasRealData ? "text-primary font-medium" : "text-muted-foreground"}>
                        ${item.cost.toFixed(4)}
                      </span>
                      {!item.hasRealData && (
                        <span className="text-xs ml-1 text-muted-foreground">(est.)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 px-2">Total</td>
                  <td className="text-right py-2 px-2">{posts.length}</td>
                  <td className="text-right py-2 px-2">-</td>
                  <td className="text-right py-2 px-2 text-primary">${totalCost.toFixed(4)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gráficos de Uso</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="daily">Diário</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tokens Chart */}
          <div>
            <h4 className="text-sm font-medium mb-3">Tokens por Período</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Chart */}
          <div>
            <h4 className="text-sm font-medium mb-3">Custos por Período (USD) - Inclui Texto + Imagens</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(4)}`, 
                      name === "imageCost" ? "Custo Imagens" : "Custo Total"
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cost" name="Custo Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                  <Line type="monotone" dataKey="imageCost" name="Custo Imagens" stroke="#ec4899" strokeWidth={2} dot={{ fill: "#ec4899" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Distribuição por Modelo</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getPieData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), "Tokens/Imagens"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3">Distribuição de Custos</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="cost"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getPieData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, "Custo"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAnalyticsDashboard;