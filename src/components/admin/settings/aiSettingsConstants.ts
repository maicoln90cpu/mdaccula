export interface AIModel {
  id: string;
  name: string;
  description: string;
  characteristics: string;
  cost: string;
  supportsTemperature: boolean;
  apiSource: 'lovable' | 'openai';
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Equilibrado, artigos de qualidade média, bom para eventos e notícias',
    characteristics:
      'Velocidade: 2-4s | Tamanho: ~800-1200 palavras | Estilo: Informativo e direto',
    cost: '~$0.15',
    supportsTemperature: true,
    apiSource: 'lovable',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Artigos longos e detalhados, melhor raciocínio, ideal para análises profundas',
    characteristics:
      'Velocidade: 4-8s | Tamanho: ~1500-2500 palavras | Estilo: Analítico e aprofundado',
    cost: '~$0.75',
    supportsTemperature: true,
    apiSource: 'lovable',
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Artigos mais curtos e diretos, econômico, ideal para volume',
    characteristics: 'Velocidade: 1-2s | Tamanho: ~400-700 palavras | Estilo: Conciso e objetivo',
    cost: '~$0.05',
    supportsTemperature: true,
    apiSource: 'lovable',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: 'Preview do modelo next-gen do Google, equilibrado entre velocidade e qualidade',
    characteristics: 'Velocidade: 2-4s | Tamanho: ~1000-1500 palavras | Estilo: Versátil',
    cost: '~$0.20',
    supportsTemperature: true,
    apiSource: 'lovable',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5 (OpenAI)',
    description: 'Modelo completo e poderoso, excelente raciocínio e contexto longo',
    characteristics:
      'Velocidade: 5-10s | Tamanho: ~2000-3000 palavras | Estilo: Preciso e detalhado',
    cost: '~$0.50',
    supportsTemperature: false,
    apiSource: 'openai',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini (OpenAI)',
    description: 'Estilo jornalístico, criativo, bom para entrevistas e histórias',
    characteristics:
      'Velocidade: 3-5s | Tamanho: ~1000-1500 palavras | Estilo: Narrativo e envolvente',
    cost: '~$0.30',
    supportsTemperature: false,
    apiSource: 'openai',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano (OpenAI)',
    description: 'Mais rápido e econômico, bom para alto volume de conteúdo',
    characteristics: 'Velocidade: 1-2s | Tamanho: ~500-800 palavras | Estilo: Direto e simples',
    cost: '~$0.10',
    supportsTemperature: false,
    apiSource: 'openai',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2 (OpenAI)',
    description: 'Modelo mais recente, raciocínio aprimorado para tarefas complexas',
    characteristics:
      'Velocidade: 6-12s | Tamanho: ~2500-4000 palavras | Estilo: Analítico e profundo',
    cost: '~$0.80',
    supportsTemperature: false,
    apiSource: 'openai',
  },
];

export const DEFAULT_IMAGE_PROMPT = `Crie uma imagem artística e profissional para um artigo sobre música eletrônica.

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
