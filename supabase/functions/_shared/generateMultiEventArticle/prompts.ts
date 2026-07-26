// Helpers específicos do generate-multi-event-article.
// Extraídos na Onda 20 sem alterar comportamento.
import { EDITORIAL_QUALITY_BLOCK } from "../editorialQuality.ts";

export function formatDatePt(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${date.getDate()} de ${months[date.getMonth()]} (${days[date.getDay()]})`;
}

export function extractKeywords(content: string): string {
  if (!content) return '';
  const stopwords = new Set(['de','da','do','das','dos','em','na','no','nas','nos','para','com','por','que','uma','um','os','as','se','ou','mais']);
  const words = content.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g,' ').split(/\s+/).filter(w => w.length > 4 && !stopwords.has(w));
  const freq: Record<string,number> = {};
  words.forEach(w => freq[w] = (freq[w]||0)+1);
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,5).map(([w]) => w).join(', ');
}

export function inferMood(content: string, title: string): string {
  const text = (content + ' ' + title).toLowerCase();
  if (text.includes('festival') || text.includes('celebra')) return 'celebratório';
  if (text.includes('underground') || text.includes('techno')) return 'underground';
  if (text.includes('futuro') || text.includes('tecnologia')) return 'futurista';
  if (text.includes('experimental') || text.includes('vanguarda')) return 'experimental';
  return 'energético';
}

export const DEFAULT_SYSTEM_PROMPT = `Você é um jornalista renomado especializado em música eletrônica brasileira e internacional, escrevendo para um público apaixonado pela cena underground e pelos grandes eventos.

ESTILO EDITORIAL:
- Tom entusiasmado, vibrante e profissional
- Linguagem rica e descritiva que transporta o leitor para a experiência
- Conhecimento profundo da cena eletrônica e seus artistas
- Português brasileiro fluido e envolvente

ESTRUTURA OBRIGATÓRIA (JSON):
{
  "title": "Título chamativo e SEO-friendly (máx 70 caracteres)",
  "excerpt": "Resumo que gere curiosidade (máx 160 caracteres)",
  "content": "Artigo HTML completo (1500-2500 palavras)",
  "category": "Eventos"
}

FORMATAÇÃO HTML:
- <h2> para seções principais
- <h3> para cada data/evento individual
- <p> para parágrafos descritivos
- <strong> para destaques importantes
- <a href="URL" target="_blank"> para links de ingressos
- <ul><li> para listas quando apropriado

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou explicações
- Inclua TODOS os links de ingressos fornecidos de forma natural
- Use dados reais fornecidos, nunca invente informações

🚨 REGRA CRÍTICA — DADOS DO PROMPT TÊM PRIORIDADE ABSOLUTA:
- Use EXCLUSIVAMENTE os dados fornecidos no prompt (local, venue, endereço, datas, horários).
- NÃO use conhecimento prévio ou de treinamento sobre locais, datas ou venues de eventos.
- Se o local informado no prompt difere do que você conhece sobre o evento, USE O INFORMADO NO PROMPT.
- O campo "description" do evento pode conter informações desatualizadas — em caso de conflito entre "description" e os campos estruturados (venue, address, date, time), PRIORIZE os campos estruturados.
- Gere um título NOVO baseado nos dados atuais, não reutilize títulos anteriores.`;

export const DEFAULT_USER_PROMPT_TEMPLATE = `Escreva um artigo COMPLETO e EXTENSO sobre a série de eventos "{{seriesName}}":

📍 LOCAL: {{venue}}, {{city}} - {{state}}
📅 PERÍODO: {{startDate}} a {{endDate}}
🎵 GÊNEROS: {{genres}}

---

## PROGRAMAÇÃO DETALHADA:
{{dates}}

---

{{additionalContext}}

---

## INSTRUÇÕES ESPECÍFICAS:

### INTRODUÇÃO (3-4 parágrafos extensos):
1. Apresente a série "{{seriesName}}" como um acontecimento imperdível
2. Fale sobre a HISTÓRIA e REPUTAÇÃO da produtora/label organizadora
3. Descreva o LOCAL em detalhes - atmosfera, estrutura, por que é especial
4. Contextualize o período (Carnaval, verão, etc) e a relevância para a cena

### CADA DATA/EVENTO (mínimo 5-6 linhas por dia):
Para CADA data, crie uma seção <h3> incluindo:
1. Data formatada em destaque
2. Contexto sobre os artistas PRINCIPAIS - quem são, de onde vêm, estilo
3. Por que esse lineup é especial ou imperdível
4. Sets esperados, horários (se disponíveis)
5. Link de ingressos em destaque com call-to-action
6. Menção aos artistas de apoio

### ARTISTAS EM DESTAQUE:
Para artistas mais famosos/headliners, inclua:
- Origem e trajetória resumida
- Releases ou sets marcantes
- Por que a apresentação será especial
- Contexto de apresentações anteriores no Brasil (se relevante)

### CONCLUSÃO:
1. Resumo geral de por que não perder a série
2. Dica para quem quer aproveitar todas as datas
3. Informações práticas (local, como chegar)
4. Call-to-action final com link para ingressos

### TAMANHO: 1500-2500 palavras

Retorne APENAS o JSON válido.`;

export interface EventLike {
  date: string;
  time: string;
  end_time?: string | null;
  venue: string;
  address?: string | null;
  location_city: string;
  location_state: string;
  subtitle?: string | null;
  lineup?: string[] | null;
  genres?: string[] | null;
  ticket_link?: string | null;
  vip_link?: string | null;
  description?: string | null;
  ai_context?: string | null;
}

export function buildDatesInfo(events: EventLike[]): string {
  return events.map(event => {
    const lineupStr = event.lineup && event.lineup.length > 0 ? event.lineup.join(', ') : 'A confirmar';
    return `
📅 ${formatDatePt(event.date)} - início ${event.time}${event.end_time ? ` até ${event.end_time}` : ''}
📍 Local: ${event.venue}${event.address ? `, ${event.address}` : ''} - ${event.location_city}/${event.location_state}
${event.subtitle ? `🏷️ Subtítulo/Promoção: ${event.subtitle}` : ''}
🎧 Line-up: ${lineupStr}
🎵 Gêneros: ${(event.genres || []).join(', ') || 'Música Eletrônica'}
${event.ticket_link ? `🎟️ Ingressos: ${event.ticket_link}` : ''}
${event.vip_link ? `💎 VIP/Camarote: ${event.vip_link}` : ''}
${event.description ? `📝 Descrição: ${event.description}` : ''}
${event.ai_context ? `🎯 Contexto admin: ${event.ai_context}` : ''}`.trim();
  }).join('\n\n');
}

export interface SystemPromptExtrasOpts {
  anyLineup: boolean;
  anyEndTime: boolean;
  anyAddress: boolean;
  isCourtesy: boolean;
}

export function buildSystemPromptExtras(opts: SystemPromptExtrasOpts): string {
  const { anyLineup, anyEndTime, anyAddress, isCourtesy } = opts;
  return `

🚨 HIERARQUIA DE PRIORIDADE (ordem absoluta):
1. Contexto admin de cada evento ("Contexto admin" no bloco oficial)
2. DADOS OFICIAIS DA SÉRIE / PROGRAMAÇÃO POR DATA
3. Template
4. Conhecimento prévio (apenas para complementar, nunca para contradizer)

🚨 ANTI-HEDGING (proibido "a confirmar" quando o dado existe):
${anyLineup ? '- Lineups foram fornecidos por data: liste exatamente os artistas, NUNCA escreva "lineup a confirmar".' : ''}
${anyEndTime ? '- Horários de término foram fornecidos: mencione "até XX:XX" nas datas correspondentes.' : ''}
${anyAddress ? '- Endereços foram fornecidos: inclua-os.' : ''}
- Use SEMPRE o dia da semana exato que aparece no bloco oficial.
- NUNCA invente venues, datas, lineup ou horários.

🚨 LINKS / CUPOM:
${isCourtesy
  ? `- ⚠️ HÁ INDICAÇÃO DE CORTESIA / SEM VENDA em ao menos uma noite (ver "Contexto admin").
- NÃO mencione cupom MDACCULA para essas datas.
- Trate links dessas noites como "confirmação de presença / lista", não compra.
- Para datas SEM indicação de cortesia, comportamento normal de venda se aplica.`
  : `- Inclua os links de ingressos REAIS fornecidos por data quando existirem.
- NUNCA invente URLs de ingressos.`}

🎬 REGRAS OBRIGATÓRIAS PARA O TÍTULO (campo "title" do JSON):
O título precisa ser EDITORIAL, envolvente e chamativo — manchete de revista. NUNCA é apenas concatenação de nomes/datas.

PROIBIDO:
- Emojis, separadores " | " " — " " - " entre nome/data/local
- Datas no formato "DD/MM" ou "DD/MM/AAAA"
- Listar todos os eventos em sequência ("Festa A, Festa B e Festa C")
- Começar com "Confira", "Não perca", "Tudo sobre"

OBRIGATÓRIO:
- 50 a 80 caracteres
- Capturar o fio condutor da seleção (ex: "cinco festas que dominam SP nesta semana", "agenda de techno do fim de semana", "noites quentes de maio")
- Voz ativa, sugerindo atmosfera
- Pode usar expressão temporal natural ("nesta semana", "neste fim de semana", "em maio")
- Apenas fatos reais dos DADOS OFICIAIS

❌ EXEMPLOS RUINS: "Eventos | 15/05, 16/05, 17/05 | SP", "Confira a agenda da semana"
✅ EXEMPLOS BONS: "Cinco noites que tomam São Paulo neste fim de semana", "Agenda eletrônica de maio: do techno ao psytrance em SP"
${EDITORIAL_QUALITY_BLOCK}
`;
}

export function buildOfficialBlock(params: {
  seriesName: string;
  commonVenue: string;
  commonCity: string;
  commonState: string;
  firstDate: string;
  lastDate: string;
  genres: string[];
  datesInfo: string;
}): string {
  return `📋 DADOS OFICIAIS DA SÉRIE (use literalmente, NUNCA invente, NUNCA contradiga):
- Série: ${params.seriesName}
- Local comum: ${params.commonVenue}, ${params.commonCity}/${params.commonState}
- Período: ${formatDatePt(params.firstDate)} a ${formatDatePt(params.lastDate)}
- Gêneros: ${params.genres.join(', ') || 'Música Eletrônica'}

PROGRAMAÇÃO POR DATA:
${params.datesInfo}

⚠️ Se algum dado acima estiver presente, ele DEVE aparecer no artigo. Não escreva "a confirmar" para informações que constam aqui.

`;
}

// Detecta magic bytes para escolher extensão/content-type do upload no Bunny.
export function detectImageFormat(buffer: Uint8Array): { fileExt: string; contentType: string } {
  if (buffer.length > 12) {
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { fileExt: 'webp', contentType: 'image/webp' };
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      return { fileExt: 'jpg', contentType: 'image/jpeg' };
    }
  }
  return { fileExt: 'png', contentType: 'image/png' };
}
