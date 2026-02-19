import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Image, Thermometer, History, Clock, Sparkles, Eye, RotateCcw } from "lucide-react";

interface AIModel {
  id: string;
  name: string;
  description: string;
  characteristics: string;
  cost: string;
  supportsTemperature: boolean;
  apiSource: "lovable" | "openai";
}

const AI_MODELS: AIModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Equilibrado, artigos de qualidade média, bom para eventos e notícias",
    characteristics: "Velocidade: 2-4s | Tamanho: ~800-1200 palavras | Estilo: Informativo e direto",
    cost: "~$0.15",
    supportsTemperature: true,
    apiSource: "lovable",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Artigos longos e detalhados, melhor raciocínio, ideal para análises profundas",
    characteristics: "Velocidade: 4-8s | Tamanho: ~1500-2500 palavras | Estilo: Analítico e aprofundado",
    cost: "~$0.75",
    supportsTemperature: true,
    apiSource: "lovable",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    description: "Artigos mais curtos e diretos, econômico, ideal para volume",
    characteristics: "Velocidade: 1-2s | Tamanho: ~400-700 palavras | Estilo: Conciso e objetivo",
    cost: "~$0.05",
    supportsTemperature: true,
    apiSource: "lovable",
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    description: "Preview do modelo next-gen do Google, equilibrado entre velocidade e qualidade",
    characteristics: "Velocidade: 2-4s | Tamanho: ~1000-1500 palavras | Estilo: Versátil",
    cost: "~$0.20",
    supportsTemperature: true,
    apiSource: "lovable",
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5 (OpenAI)",
    description: "Modelo completo e poderoso, excelente raciocínio e contexto longo",
    characteristics: "Velocidade: 5-10s | Tamanho: ~2000-3000 palavras | Estilo: Preciso e detalhado",
    cost: "~$0.50",
    supportsTemperature: false,
    apiSource: "openai",
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini (OpenAI)",
    description: "Estilo jornalístico, criativo, bom para entrevistas e histórias",
    characteristics: "Velocidade: 3-5s | Tamanho: ~1000-1500 palavras | Estilo: Narrativo e envolvente",
    cost: "~$0.30",
    supportsTemperature: false,
    apiSource: "openai",
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano (OpenAI)",
    description: "Mais rápido e econômico, bom para alto volume de conteúdo",
    characteristics: "Velocidade: 1-2s | Tamanho: ~500-800 palavras | Estilo: Direto e simples",
    cost: "~$0.10",
    supportsTemperature: false,
    apiSource: "openai",
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2 (OpenAI)",
    description: "Modelo mais recente, raciocínio aprimorado para tarefas complexas",
    characteristics: "Velocidade: 6-12s | Tamanho: ~2500-4000 palavras | Estilo: Analítico e profundo",
    cost: "~$0.80",
    supportsTemperature: false,
    apiSource: "openai",
  },
];

const DEFAULT_IMAGE_PROMPT = `Crie uma imagem artística e profissional para um artigo sobre música eletrônica.

CONTEXTO DO ARTIGO:
- Título: "{{title}}"
- Resumo: {{summary}}
- Categoria: {{category}}
- Palavras-chave: {{keywords}}
- Atmosfera desejada: {{mood}}
- Elementos visuais sugeridos: {{visualElements}}

INSTRUÇÕES DE GERAÇÃO:
1. PRIORIZE os elementos visuais sugeridos se fornecidos
2. CAPTURE a atmosfera/mood indicada (energético = cores vibrantes; introspectivo = tons suaves; underground = escuro, industrial)
3. Use as palavras-chave como referência visual
4. A categoria deve influenciar o estilo

ESTILO VISUAL:
- Fotorrealista com elementos artísticos
- Alta qualidade, cinematográfico
- Dramático e contrastante

EVITE SEMPRE:
- Imagens genéricas de boates com luzes neon roxas
- DJs de costas com fones de ouvido
- Padrões abstratos desconectados do tema

NÃO inclua texto, palavras ou números na imagem.`;

// Dados de exemplo para preview do prompt
const SAMPLE_DATA = {
  title: "Vintage Culture Anuncia Turnê Mundial 2026",
  summary: "O produtor brasileiro Vintage Culture revela as datas de sua maior turnê mundial, passando por 40 cidades em 5 continentes.",
  category: "Eventos",
  keywords: "Vintage Culture, turnê mundial, house music, DJ brasileiro, 2026",
  mood: "energético e celebratório",
  visualElements: "palco gigante com LED, multidão vibrante, luzes douradas, atmosfera de festival",
};

// Componente de Preview do Prompt
const ImagePromptSection = ({
  aiImagePrompt,
  setAiImagePrompt,
}: {
  aiImagePrompt: string;
  setAiImagePrompt: (value: string) => void;
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const getPreviewPrompt = () => {
    let prompt = aiImagePrompt || DEFAULT_IMAGE_PROMPT;
    prompt = prompt.replace(/\{\{title\}\}/g, SAMPLE_DATA.title);
    prompt = prompt.replace(/\{\{summary\}\}/g, SAMPLE_DATA.summary);
    prompt = prompt.replace(/\{\{category\}\}/g, SAMPLE_DATA.category);
    prompt = prompt.replace(/\{\{keywords\}\}/g, SAMPLE_DATA.keywords);
    prompt = prompt.replace(/\{\{mood\}\}/g, SAMPLE_DATA.mood);
    prompt = prompt.replace(/\{\{visualElements\}\}/g, SAMPLE_DATA.visualElements);
    return prompt;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Prompt de Geração de Imagens (Nano Banana)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiImagePrompt(DEFAULT_IMAGE_PROMPT)}
            className="h-8 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restaurar Padrão
          </Button>
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview do Prompt com Dados de Exemplo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Dados de exemplo utilizados:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><strong>Título:</strong> {SAMPLE_DATA.title}</div>
                    <div><strong>Categoria:</strong> {SAMPLE_DATA.category}</div>
                    <div className="col-span-2"><strong>Resumo:</strong> {SAMPLE_DATA.summary}</div>
                    <div className="col-span-2"><strong>Keywords:</strong> {SAMPLE_DATA.keywords}</div>
                    <div><strong>Mood:</strong> {SAMPLE_DATA.mood}</div>
                    <div className="col-span-2"><strong>Elementos Visuais:</strong> {SAMPLE_DATA.visualElements}</div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Prompt final gerado:</p>
                  <ScrollArea className="h-[300px]">
                    <pre className="p-4 rounded-lg bg-background border text-xs font-mono whitespace-pre-wrap">
                      {getPreviewPrompt()}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Textarea
        value={aiImagePrompt}
        onChange={(e) => setAiImagePrompt(e.target.value)}
        placeholder="Prompt para geração de imagens..."
        className="min-h-[200px] font-mono text-xs"
      />
      <div className="text-xs text-muted-foreground space-y-2">
        <p><strong>Variáveis disponíveis:</strong></p>
        <div className="flex flex-wrap gap-1">
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{title}}"}</code>
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{summary}}"}</code>
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{category}}"}</code>
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{keywords}}"}</code>
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{mood}}"}</code>
          <code className="bg-muted px-1.5 py-0.5 rounded">{"{{visualElements}}"}</code>
        </div>
        <p className="text-muted-foreground/80">
          As variáveis são preenchidas automaticamente com dados do artigo. 
          Evite pedir texto nas imagens para melhores resultados.
        </p>
      </div>
    </div>
  );
};

interface AISettingsProps {
  aiModel: string;
  setAiModel: (value: string) => void;
  aiTemperature: number;
  setAiTemperature: (value: number) => void;
  aiImagePrompt: string;
  setAiImagePrompt: (value: string) => void;
  aiHistoryLimit: number;
  setAiHistoryLimit: (value: number) => void;
  aiAutoGenerateEnabled: boolean;
  setAiAutoGenerateEnabled: (value: boolean) => void;
  aiAutoGenerateInterval: string;
  setAiAutoGenerateInterval: (value: string) => void;
  aiMaxArticleLength: number;
  setAiMaxArticleLength: (value: number) => void;
  aiMaxScrapeSources: number;
  setAiMaxScrapeSources: (value: number) => void;
}

const AISettings = ({
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  aiImagePrompt,
  setAiImagePrompt,
  aiHistoryLimit,
  setAiHistoryLimit,
  aiAutoGenerateEnabled,
  setAiAutoGenerateEnabled,
  aiAutoGenerateInterval,
  setAiAutoGenerateInterval,
  aiMaxArticleLength,
  setAiMaxArticleLength,
  aiMaxScrapeSources,
  setAiMaxScrapeSources,
}: AISettingsProps) => {
  const selectedModelConfig = AI_MODELS.find(m => m.id === aiModel);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg sm:text-xl">Inteligência Artificial Avançada</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Configure todos os parâmetros de geração de conteúdo com IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Modelo de IA (Agente)</Label>
            </div>
            <RadioGroup value={aiModel} onValueChange={setAiModel}>
              {AI_MODELS.map((model) => (
                <div 
                  key={model.id}
                  className={`flex items-start justify-between space-x-3 py-3 px-4 rounded-lg border transition-colors ${
                    aiModel === model.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1">
                    <RadioGroupItem value={model.id} id={model.id} className="mt-1" />
                    <Label htmlFor={model.id} className="font-normal cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          model.apiSource === 'openai' 
                            ? 'bg-green-500/20 text-green-600' 
                            : 'bg-blue-500/20 text-blue-600'
                        }`}>
                          {model.apiSource === 'openai' ? '🔑 Sua chave OpenAI' : '☁️ Lovable AI'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
                      <div className="text-xs text-primary/80 mt-1 font-mono">{model.characteristics}</div>
                    </Label>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-primary">{model.cost}</div>
                    <div className="text-xs text-muted-foreground">10 artigos</div>
                  </div>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-2 p-3 rounded-lg bg-muted/30 border">
              <strong>Sobre as APIs:</strong> Modelos Gemini usam créditos da Lovable AI. 
              Modelos OpenAI usam sua própria chave (OPENAI_API_KEY) e custos são cobrados diretamente pela OpenAI em{' '}
              <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                platform.openai.com/usage
              </a>
            </p>
          </div>

          {selectedModelConfig?.supportsTemperature && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Temperatura (Criatividade)</Label>
                </div>
                <span className="text-sm font-mono bg-background px-2 py-1 rounded">{aiTemperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[aiTemperature]}
                onValueChange={(v) => setAiTemperature(v[0])}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.0 - Previsível</span>
                <span>1.0 - Equilibrado</span>
                <span>2.0 - Muito criativo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Valores mais altos geram textos mais criativos e variados. Disponível apenas para modelos Gemini.
              </p>
            </div>
          )}

          <ImagePromptSection
            aiImagePrompt={aiImagePrompt}
            setAiImagePrompt={setAiImagePrompt}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Limite de Histórico para Evitar Repetição</Label>
            </div>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={5}
                max={50}
                value={aiHistoryLimit}
                onChange={(e) => setAiHistoryLimit(parseInt(e.target.value) || 15)}
                className="w-24 h-10"
              />
              <span className="text-sm text-muted-foreground">artigos recentes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantos artigos publicados a IA deve considerar para evitar sugerir temas repetidos (5-50).
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Máximo de Fontes para Scraping</Label>
            </div>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={10}
                value={aiMaxScrapeSources}
                onChange={(e) => setAiMaxScrapeSources(parseInt(e.target.value) || 3)}
                className="w-24 h-10"
              />
              <span className="text-sm text-muted-foreground">fontes de notícias</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantas fontes de notícias serão scrapeadas para contexto (1-10). Mais fontes = mais contexto, porém mais lento.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Tamanho Máximo do Artigo</Label>
            </div>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1000}
                max={10000}
                step={500}
                value={aiMaxArticleLength}
                onChange={(e) => setAiMaxArticleLength(parseInt(e.target.value) || 5000)}
                className="w-28 h-10"
              />
              <span className="text-sm text-muted-foreground">caracteres</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Limite aproximado de caracteres para os artigos gerados (1000-10000).
            </p>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Geração Automática de Artigos</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gera artigos automaticamente em intervalos regulares
                  </p>
                </div>
              </div>
              <Switch
                checked={aiAutoGenerateEnabled}
                onCheckedChange={setAiAutoGenerateEnabled}
              />
            </div>
            
            {aiAutoGenerateEnabled && (
              <div className="space-y-3 pt-2">
                <Label className="text-sm">Intervalo de Geração</Label>
                <Select value={aiAutoGenerateInterval} onValueChange={setAiAutoGenerateInterval}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">A cada 6 horas</SelectItem>
                    <SelectItem value="12">A cada 12 horas</SelectItem>
                    <SelectItem value="24">A cada 24 horas (1 por dia)</SelectItem>
                    <SelectItem value="48">A cada 48 horas (1 a cada 2 dias)</SelectItem>
                    <SelectItem value="72">A cada 72 horas (1 a cada 3 dias)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O sistema irá gerar automaticamente um artigo aleatório baseado nas fontes de notícias configuradas.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AISettings;
export { AI_MODELS, DEFAULT_IMAGE_PROMPT };
