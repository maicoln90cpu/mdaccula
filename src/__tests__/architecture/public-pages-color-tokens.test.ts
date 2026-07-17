import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic imports keep Node builtins out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;
let readdirSync: typeof import('fs').readdirSync;
let statSync: typeof import('fs').statSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
  readdirSync = fs.readdirSync;
  statSync = fs.statSync;
});

/**
 * Guard estático de arquitetura.
 *
 * Garante que páginas e componentes PÚBLICOS usem os tokens de cor
 * semânticos de src/index.css (bg-primary, text-success, border-warning...)
 * em vez de classes Tailwind de cor crua (bg-purple-500, text-red-400...)
 * ou hex/rgba soltos no JSX.
 *
 * Motivo: em 17/07/2026 encontramos drift acumulado (ex.: .logo-gradient e
 * os keyframes logo-pulse/featured-glow-pulse usando rgba() fixo em vez de
 * hsl(var(--neon-purple)), avisos/sucessos em Privacidade.tsx e Links.tsx
 * usando amber-500/green-500/yellow-500 direto). Se o tema mudar de cor no
 * futuro (src/index.css), essas páginas não acompanhariam a mudança. Este
 * guard impede que uma página nova reintroduza o mesmo problema.
 *
 * Áreas administrativas (/admin/*, painéis internos) ficam de fora — o
 * pedido que originou este guard foi só sobre páginas públicas.
 *
 * Custo: <1s, sem rede, sem flake.
 */

const SCAN_ROOTS = ['src/pages', 'src/components'];

// Pastas inteiras fora do escopo: telas administrativas, e a biblioteca de
// componentes primitivos (src/components/ui) — que tem suas próprias
// variantes (success/warning/info/priority-*) já auditadas e usadas hoje
// apenas dentro de páginas /admin/*, revisadas separadamente.
const EXCLUDED_DIR_SEGMENTS = ['admin', 'ui'];

// Arquivos específicos, fora de pastas admin/, mas que são ferramentas ou
// telas administrativas na prática (formulários de cadastro, dashboard
// interno) — ou que usam cor crua de propósito, não por drift.
const ALLOWLIST = new Set([
  // Ferramentas administrativas que não moram em uma pasta admin/:
  'src/pages/Admin.tsx', // hub do painel admin, protegido por isAdmin
  'src/pages/Analytics.tsx', // paleta categórica de gráfico (pizza/barras), não é cor de marca
  'src/components/events/EventForm.tsx', // formulário de criação/edição de evento (admin)
  'src/components/links/CustomLinkForm.tsx', // editor de link customizado (admin) — gradiente é escolha do admin por link
  'src/components/links/SortableLinkCard.tsx', // reordenação de links por drag-and-drop (admin)

  // Cor de marca de terceiros (WhatsApp, Instagram, SoundCloud) — igual a
  // src/lib/brandColors.ts, deliberadamente independente do tema do site.
  'src/pages/Podcast.tsx',
  'src/pages/EventDetail.tsx',

  // Paleta categórica intencional (uma cor por categoria de post/força de
  // senha), não é "cor de marca" que devesse seguir --primary/--accent.
  'src/pages/Blog.tsx',
  'src/pages/BlogPost.tsx',
  'src/pages/Auth.tsx',
]);

const RAW_COLOR_PATTERN =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:red|blue|green|yellow|purple|pink|orange|indigo|teal|cyan|lime|amber|emerald|violet|fuchsia|rose|sky)-[0-9]{2,3}\b|#[0-9a-fA-F]{6}\b|rgba?\([0-9]/;

function isExcludedPath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/);
  return segments.some((segment) => EXCLUDED_DIR_SEGMENTS.includes(segment));
}

function collectTsxFiles(dir: string, root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = `${dir}/${entry}`;
    const relativePath = fullPath.slice(root.length + 1).replace(/\\/g, '/');
    if (isExcludedPath(relativePath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectTsxFiles(fullPath, root));
    } else if (entry.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture guard — páginas públicas usam tokens de cor, não cor crua', () => {
  it('nenhum arquivo público novo usa bg/text/border-<cor>-<tom> ou hex/rgba solto', () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const scanRoot of SCAN_ROOTS) {
      const files = collectTsxFiles(`${root}/${scanRoot}`, root);
      for (const file of files) {
        const relativePath = file.slice(root.length + 1).replace(/\\/g, '/');
        if (ALLOWLIST.has(relativePath)) continue;

        const content = readFileSync(file, 'utf-8');
        if (RAW_COLOR_PATTERN.test(content)) {
          violations.push(relativePath);
        }
      }
    }

    expect(
      violations,
      `As páginas/componentes públicos abaixo usam cor Tailwind crua (ex.: bg-purple-500) ` +
        `ou hex/rgba solto em vez dos tokens semânticos de src/index.css (bg-primary, ` +
        `text-success, border-warning, etc.). Troque pela classe semântica, ou — se for ` +
        `um caso legítimo de cor de marca de terceiro/paleta categórica — adicione o ` +
        `caminho no ALLOWLIST deste teste explicando o motivo:\n` +
        violations.map((v) => `  - ${v}`).join('\n')
    ).toEqual([]);
  });
});
