/**
 * Classifica issues do composer em warnings (não bloqueiam envio) vs blockers.
 *
 * WARNING = campo opcional que só afeta um bloco; o e-mail pode ser enviado
 * mesmo assim (o bloco em questão renderiza vazio/oculto).
 * BLOCKER = falta de dado essencial (título, template, data) — precisa impedir.
 */
import type { EmailCompositionIssue } from './emailComposer';

export const WARNING_ISSUE_CODES = new Set<string>([
  'ARTICLE_MISSING',
  'SUBTITLE_MISSING',
  'DESCRIPTION_MISSING',
  'MAP_COORDINATES_MISSING',
  'LINEUP_MISSING',
]);

export function partitionIssues(issues: EmailCompositionIssue[]): {
  warnings: EmailCompositionIssue[];
  blockers: EmailCompositionIssue[];
} {
  const warnings: EmailCompositionIssue[] = [];
  const blockers: EmailCompositionIssue[] = [];
  for (const issue of issues) {
    if (WARNING_ISSUE_CODES.has(issue.code)) warnings.push(issue);
    else blockers.push(issue);
  }
  return { warnings, blockers };
}
