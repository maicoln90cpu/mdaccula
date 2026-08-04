# Design System

Guia rápido do sistema visual "dark neon" do MDAccula. Fonte de verdade para os tokens é
`src/index.css` (variáveis CSS/HSL) + `tailwind.config.ts` (mapeamento pro Tailwind) — este
documento é um resumo de leitura rápida, não substitui esses dois arquivos.

## Princípios

- **Todas as cores são HSL** (comentário explícito no topo de `src/index.css`) — nunca hex/rgb direto.
- **Sempre usar tokens semânticos do Tailwind** (`bg-background`, `text-primary`, `border-border`) em
  vez de cor hardcoded — ver `CLAUDE.md`/`docs/CODE_STYLE.md`.
- **Tema único**: dark por padrão (`defaultTheme="dark"` em `src/App.tsx`), com suporte a
  `next-themes` (`enableSystem`). Não há um light theme totalmente separado — os tokens já nascem
  escuros.

## Paleta (tokens em `src/index.css` → `:root`)

| Token | HSL | Uso |
|-------|-----|-----|
| `--background` | `220 25% 5%` | Fundo base da aplicação |
| `--foreground` | `0 0% 95%` | Texto padrão |
| `--card` / `--popover` | `220 25% 8%` | Superfícies elevadas |
| `--primary` | `280 100% 50%` (glow `280 100% 70%`) | Roxo neon — ação principal |
| `--secondary` | `200 100% 38%` (glow `200 100% 60%`) | Azul neon — ação secundária |
| `--accent` | `320 100% 65%` (glow `320 100% 75%`) | Rosa neon — destaque |
| `--destructive` | `0 84.2% 60.2%` | Erros/ações destrutivas |
| `--success` | `142 71% 45%` | Confirmações |
| `--warning` | `38 92% 50%` | Avisos |
| `--muted` | `220 25% 15%` (foreground `0 0% 72%`) | Texto/fundo secundário, WCAG AA (4.5:1) |
| `--border` / `--input` / `--ring` | `220 25% 20%` / `220 25% 15%` / `280 100% 70%` | Bordas e foco |

Aliases temáticos (`--neon-purple`, `--neon-blue`, `--neon-pink`, `--dark-surface`,
`--darker-surface`) espelham `primary`/`secondary`/`accent` para uso em gradientes e sombras com glow
(`--gradient-hero`, `--gradient-card`, `--gradient-accent`, `--shadow-neon`, `--shadow-glow`,
`--shadow-intense`).

## Tipografia (`@fontsource`, self-hospedada — sem chamada externa a Google Fonts)

| Família Tailwind | Fonte | Pesos carregados |
|-------------------|-------|-------------------|
| `font-sans` (padrão) | Inter | 400, 500, 600, 700 |
| `font-display` | Space Grotesk | 500, 700 |
| `font-mono` | JetBrains Mono | 400, 500 |

## Espaçamento e layout

- Escala de espaçamento em `src/index.css`: `--space-xs` (0.25rem) até `--space-section` (5rem),
  mapeados no Tailwind como `section`, `2xl`, `3xl`.
- Larguras de conteúdo: `--content-sm` (640px) até `--content-xl` (1280px).
- Breakpoints customizados em `tailwind.config.ts`: `xs: 375px` (extra, além do padrão do Tailwind),
  `sm/md/lg/xl/2xl` no padrão.
- `--radius: 0.75rem` — base de `rounded-lg`/`rounded-md`/`rounded-sm`.

## Movimento

- Durations: `--transition-fast` (150ms), `--transition-normal` (200ms), `--transition-smooth`
  (300ms, cubic-bezier), `--transition-bounce` (500ms, overshoot).
- Keyframes custom no Tailwind (`tailwind.config.ts`): `pulse-neon`, `logo-pulse`, `float`, `glow`,
  `slide-in-up`, `ticket-glow-pulse`, `ticket-glow-shift`, `ticket-scale-pulse`,
  `featured-glow-pulse`, `wave-drift` (+ variantes `slow`/`fast`).
- Microinterações premium (Framer Motion) documentadas em `docs/CODE_STYLE.md` → seção Animações:
  fundo Aurora animado, parallax no mural de flyers, botão magnético, countdown de evento, spotlight
  cards.

## Componentes

Base: **Shadcn/UI** (Radix primitives + Tailwind) em `src/components/ui/` — todo o catálogo padrão
(accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart,
checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card,
input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group,
resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table,
tabs, textarea, toast, toggle, toggle-group, tooltip) mais componentes próprios do projeto na mesma
pasta: `navigation.tsx`, `footer.tsx`, `page-header.tsx`, `SearchBar.tsx`, `RichTextEditor.tsx`,
`ImageUploadWithCrop.tsx`.

**Convenção**: componentes puramente visuais/reutilizáveis moram em `src/components/ui/`;
componentes de domínio (que sabem de eventos, blog, admin etc.) moram em `src/components/<domínio>/`
— ver `docs/SYSTEM-DESIGN.md` para a árvore completa.

## Como manter este documento atualizado

Ao adicionar um token novo em `src/index.css` (cor, sombra, espaçamento) ou uma keyframe nova em
`tailwind.config.ts`, adicione a linha correspondente aqui no mesmo PR.
