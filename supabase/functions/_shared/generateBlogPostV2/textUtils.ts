export function replaceVariables(text: string, fields: Record<string, unknown>): string {
  if (!text) return text;
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      const strValue = String(value);
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), strValue);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), strValue);
    }
  }
  // Remover placeholders não substituídos
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
  result = result.replace(/\{[a-zA-Z_]+\}/g, '');
  return result;
}

// Lista de domínios falsos que a IA costuma inventar
export const FAKE_DOMAINS = [
  'ticketlink.com.br',
  'ticketlink.com',
  'ingressos.com',
  'ingressos.com.br',
  'tickets.com.br',
  'tickets.com',
  'example.com',
  'evento.com.br',
  'evento.com',
  'link.com.br',
  'comprar.com.br',
  'bilheteria.com.br',
  'bilheteria.com',
  'eventbrite.fake',
  'sympla.fake',
];

// Restringe um link a UMA única ocorrência no artigo — usado pro link de
// VIP/camarote, que o modelo tende a mencionar em 2-3 seções diferentes
// mesmo com a instrução de prompt pedindo menção única (regra de prompt
// sozinha se mostrou inconsistente; isso garante o resultado).
export function restrictLinkToFirstMention(content: string, url: string): string {
  if (!url) return content;
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(`<a[^>]*href=["']${escapedUrl}["'][^>]*>([^<]*)</a>`, 'gi');
  let firstSeen = false;
  return content.replace(linkRegex, (match, innerText) => {
    if (!firstSeen) {
      firstSeen = true;
      return match;
    }
    return innerText;
  });
}

// Função para remover links com domínios inventados pela IA
export function removeFakeLinks(content: string): string {
  let cleaned = content;
  for (const domain of FAKE_DOMAINS) {
    // Remover links <a> com domínios fake
    const linkRegex = new RegExp(
      `<a[^>]*href=['"](?:https?://)?(?:www\\.)?${domain.replace(/\./g, '\\.')}[^'"]*['"][^>]*>[^<]*</a>`,
      'gi'
    );
    cleaned = cleaned.replace(linkRegex, '');
    
    // Remover URLs em texto plain também (ex: www.ticketlink.com.br)
    const plainUrlRegex = new RegExp(
      `(?:https?://)?(?:www\\.)?${domain.replace(/\./g, '\\.')}[^\\s<]*`,
      'gi'
    );
    cleaned = cleaned.replace(plainUrlRegex, '');
  }
  
  // Limpar parágrafos vazios resultantes
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned.trim();
}
