/**
 * Garante que uma URL externa tenha protocolo antes de ser usada em `<a href>`.
 *
 * Sem isso, valores como `www.sympla.com.br/x` são interpretados como caminho
 * relativo pelo navegador e quebram ao serem clicados (ex: `/eventos/<slug>/www.sympla...`).
 *
 * Regras:
 * - Vazio / nulo / undefined → `#` (link inerte, não navega).
 * - Já começa com `http://` ou `https://` → retorna como está.
 * - Começa com `mailto:`, `tel:`, `sms:`, `/`, `#` → retorna como está (navegação intencional).
 * - Esquema `javascript:` ou outro perigoso → `#` (bloqueio de XSS).
 * - Caso contrário (ex: `www.sympla.com.br/x`, `bit.ly/x`) → adiciona `https://`.
 */
export const safeExternalUrl = (url: string | null | undefined): string => {
  if (!url) return '#';
  const trimmed = String(url).trim();
  if (!trimmed) return '#';

  const lower = trimmed.toLowerCase();

  // Bloqueia esquemas perigosos
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '#';
  }

  // Já tem protocolo válido ou é navegação intencional
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('sms:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }

  // Domínio cru sem protocolo (sympla.com.br/..., bit.ly/..., etc.)
  return `https://${trimmed}`;
};
