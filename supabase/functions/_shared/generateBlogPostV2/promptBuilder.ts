// Construção de prompts (user + system) extraída de generate-blog-post-v2/index.ts (Onda 22).
// Preserva 100% o texto gerado — os blocos são idênticos ao inline anterior.
// Se editar, replicar em src/__tests__/regression/ e nos testes de contrato.
import { EDITORIAL_QUALITY_BLOCK } from '../editorialQuality.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fields = Record<string, any>;

export function applyTemplateVariables(templateStr: string, formFields: Fields): string {
  let userPrompt = templateStr;
  for (const [key, value] of Object.entries(formFields)) {
    if (value) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
      userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string);
      userPrompt = userPrompt.replace(
        new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g'),
        '$1',
      );
    } else {
      userPrompt = userPrompt.replace(
        new RegExp(`\\{\\{#if ${key}\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, 'g'),
        '',
      );
    }
  }
  return userPrompt;
}

export function buildOfficialDataBlock(formFields: Fields, isEventMode: boolean): string {
  if (!isEventMode) return '';
  const officialDataLines: string[] = [];
  const pushIf = (label: string, val: unknown) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      officialDataLines.push(`- ${label}: ${val}`);
    }
  };
  pushIf('Nome do evento', formFields.eventName || formFields.title);
  pushIf('Subtítulo/Promoção', formFields.subtitle);
  pushIf('Data', formFields.dateFormatted || formFields.eventDate);
  pushIf('Dia da semana', formFields.weekday);
  pushIf('Horário de início', formFields.eventTime);
  pushIf('Horário de término', formFields.endTime);
  pushIf('Local', formFields.eventLocation);
  const venueEqualsCity = Boolean(
    formFields.venue &&
      formFields.locationCity &&
      String(formFields.venue).trim().toLowerCase() ===
        String(formFields.locationCity).trim().toLowerCase(),
  );
  pushIf('Casa/Venue', formFields.venue);
  pushIf('Endereço', formFields.address);
  if (!venueEqualsCity) {
    pushIf('Cidade', formFields.locationCity);
  }
  pushIf('Estado', formFields.locationState);
  pushIf('Gêneros musicais', formFields.genres);
  pushIf('Lineup confirmado', formFields.lineup);
  pushIf('Link de ingressos', formFields.ticketLink);
  pushIf('Link VIP/camarote', formFields.vipLink);
  pushIf('Descrição oficial', formFields.description);

  if (officialDataLines.length === 0) return '';
  return `\n\n📋 DADOS OFICIAIS DO EVENTO (use literalmente, NUNCA invente, NUNCA contradiga):\n${officialDataLines.join('\n')}\n\n⚠️ Se algum dado acima estiver presente, ele DEVE aparecer no artigo. Não escreva "a confirmar" para informações que constam aqui.\n`;
}

export interface BuildSystemPromptParams {
  templateSystemPrompt: string;
  maxArticleLength: number;
  isEventMode: boolean;
  hasRealTicketLink: boolean;
  isCourtesy: boolean;
  formFields: Fields;
  aiContextBlock: string;
}

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const {
    templateSystemPrompt,
    maxArticleLength,
    isEventMode,
    hasRealTicketLink,
    isCourtesy,
    formFields,
    aiContextBlock,
  } = params;

  const eventAntiHedgingBlock = isEventMode
    ? `

🚨 ANTI-HEDGING (proibido falar "a confirmar" quando o dado existe):
${formFields.lineup ? '- Lineup foi fornecido: NÃO escreva "lineup a confirmar" ou "line-up completo ainda não oficializado". Liste os artistas exatos.' : ''}
${formFields.endTime ? '- Horário de término foi fornecido: mencione-o ("até XX:XX").' : ''}
${formFields.eventTime ? '- Horário de início foi fornecido: mencione-o.' : ''}
${formFields.address ? '- Endereço completo foi fornecido: inclua-o.' : ''}
${formFields.subtitle ? '- Subtítulo/promoção foi fornecido: incorpore essa informação no artigo.' : ''}
${formFields.vipLink ? '- Link VIP foi fornecido: mencione a opção de camarote/VIP em UM ÚNICO ponto do artigo — nunca repita a mesma menção em duas seções diferentes (ex: não repita na conclusão se já mencionou na seção de ingressos). Use um texto de link natural e curto (ex: "reserve sua área VIP", "fale sobre o camarote"). NUNCA copie a frase "área VIP/camarote" literalmente como texto do link.' : ''}
${formFields.weekday ? `- Dia da semana CORRETO é "${formFields.weekday}". NUNCA escreva outro dia da semana.` : ''}

🚨 PRIORIDADE DOS CAMPOS ESTRUTURADOS:
- Em caso de conflito entre "description" e os dados estruturados (venue, eventLocation, eventDate, weekday), PRIORIZE os dados estruturados.
- Não use seu conhecimento de treinamento sobre locais/datas/lineup do evento — use APENAS os DADOS OFICIAIS.`
    : '';

  const editorialModeBlock = !isEventMode
    ? `

📰 MODO EDITORIAL/NOTÍCIA (NÃO é evento/festa):
- Este artigo é uma matéria jornalística, opinativa ou de tendências — NÃO é divulgação de festa.
- PROIBIDO criar seções "Lineup", "Local e horário", "Ingressos", "Como chegar".
- PROIBIDO escrever "a confirmar", "lineup a confirmar", "venue a confirmar" — não há evento concreto.
- Estrutura esperada: introdução cativante + 3-4 seções <h3> com análise/contexto + conclusão com perspectiva.
- Cite artistas, labels, faixas, eventos passados ou tecnologias quando relevante para argumentar.
- Foque no tema do título e do resumo. Nunca force o texto para um formato de divulgação de evento.`
    : '';

  const ticketsBlock = !isEventMode
    ? `\n\n🚨 LINKS E CTA (modo editorial):
- NÃO inclua seção de "Ingressos" nem mencione cupom MDACCULA — não é divulgação de evento.
- NUNCA invente URLs.
- CTA final sugerido: "Acompanhe a MDAccula para mais novidades da cena eletrônica."`
    : isCourtesy
      ? `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- ⚠️ ESTE EVENTO É CORTESIA / SEM VENDA DE INGRESSOS (conforme aiContext acima).
- NÃO mencione cupom de desconto MDACCULA.
- NÃO escreva "garanta seu ingresso", "compre antecipado", "lotes" ou similares.
- Se houver link, descreva-o como "link para confirmar presença / lista" e não como compra.
- Ignore qualquer instrução do template que force menção a cupom de desconto.`
      : hasRealTicketLink
        ? `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- Link de ingressos REAL fornecido: ${formFields.ticketLink}
- Você PODE incluir seção de ingressos com cupom MDACCULA usando este link.`
        : `\n\n🚨 REGRAS CRÍTICAS SOBRE LINKS DE INGRESSOS E CUPOM:
- NÃO há link de ingressos fornecido para este artigo.
- NUNCA INVENTE URLs de ingressos como "ticketlink.com.br", "ingressos.com.br", etc.
- NÃO inclua seção de "Ingressos", "Onde comprar" ou "Garanta seu lugar".
- NÃO mencione cupom de desconto MDACCULA se não houver link real.
- Use CTA alternativo: "Acompanhe a MDAccula para mais novidades da cena eletrônica."`;

  return (
    templateSystemPrompt +
    `\n\n🚨 HIERARQUIA DE PRIORIDADE (ordem absoluta):
1. INSTRUÇÕES ESPECIAIS DO ADMIN (aiContext)
2. ${isEventMode ? 'DADOS OFICIAIS DO EVENTO (bloco no user prompt)' : 'Tema do título/resumo da sugestão'}
3. Template
4. Conhecimento prévio (use APENAS para complementar, nunca para contradizer)

IMPORTANTE: 
- O artigo deve ter no máximo ${maxArticleLength} caracteres.
- NUNCA use placeholders como {{eventName}}, {{eventDate}}, {{lineup}}, etc. no texto gerado.
- ${isEventMode ? 'Use os valores REAIS fornecidos no bloco "DADOS OFICIAIS".' : 'Baseie-se no título e resumo fornecidos.'}
- Se um campo NÃO existe nos dados fornecidos, omita — NUNCA invente.${eventAntiHedgingBlock}${editorialModeBlock}
${EDITORIAL_QUALITY_BLOCK}

🎬 REGRAS OBRIGATÓRIAS PARA O TÍTULO (campo "title" do JSON):
O título precisa ser EDITORIAL, envolvente e chamativo — como manchete de revista de música eletrônica.

PROIBIDO no título:
- Emojis (☀️, 👁️, 🎵, ⭐ etc.)
- Separar campos com " | ", " — " ou " - " no estilo "Nome | DD/MM | Cidade"
- Datas no formato "DD/MM/AAAA" ou "DD/MM" (use linguagem temporal natural)
- Começar com "Confira", "Não perca", "Saiba tudo sobre", "Tudo sobre"
- Inventar adjetivos não embasados nos dados

OBRIGATÓRIO no título:
- 50 a 80 caracteres
- Voz ativa, sugerindo clima/atmosfera${formFields.weekday && isEventMode ? ` (dia correto: "${formFields.weekday}")` : ''}
- Sempre baseado em fatos reais — nunca inventar

${aiContextBlock}${ticketsBlock}`
  );
}
