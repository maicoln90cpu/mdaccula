export function extractKeywords(content: string): string {
  if (!content) return '';
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'por',
    'que', 'uma', 'um', 'os', 'as', 'se', 'ou', 'mais', 'isso', 'esse', 'essa', 'este',
    'esta', 'como', 'sua', 'seu', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas', 'foi',
    'são', 'tem', 'ter', 'será', 'sobre', 'entre', 'quando', 'muito', 'também', 'onde',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'are', 'was'
  ]);
  const words = content.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
    .join(', ');
}

export function inferMood(content: string, title: string): string {
  const text = (content + ' ' + title).toLowerCase();
  if (text.includes('festival') || text.includes('celebra') || text.includes('festa')) return 'celebratório';
  if (text.includes('underground') || text.includes('techno') || text.includes('warehouse')) return 'underground';
  if (text.includes('futuro') || text.includes('tecnologia') || text.includes('ia') || text.includes('digital')) return 'futurista';
  if (text.includes('experimental') || text.includes('vanguarda') || text.includes('inovador')) return 'experimental';
  if (text.includes('clássico') || text.includes('história') || text.includes('vintage')) return 'nostálgico';
  if (text.includes('meditativo') || text.includes('ambient') || text.includes('chill')) return 'introspectivo';
  return 'energético';
}
