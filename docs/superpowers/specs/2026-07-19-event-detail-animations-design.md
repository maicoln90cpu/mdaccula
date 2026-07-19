# Design: animações mais fortes em /eventos/:slug

Data: 2026-07-19

## Contexto / Problema

Na página de detalhe de evento (`src/pages/EventDetail.tsx`), duas animações decorativas existem hoje mas são percebidas como fracas:

1. **Fundo de ondas** (`SoundWaveBackground`): 2 camadas SVG com opacidade muito baixa (0.08 / 0.10), posicionadas só na base da tela.
2. **Botão de CTA** ("Comprar Ingresso" / "Comprar Ingresso com Desconto"): brilho (`box-shadow`) pulsante + shift de gradiente, via classes `btn-ticket-glow` + `animate-ticket-glow-pulse` + `animate-ticket-glow-shift`.

Causa raiz confirmada no código: em `src/index.css`, a media query `@media (max-width: 768px)` (linhas ~205-217) desliga **totalmente** (`animation: none`) as classes `.animate-wave-drift`, `.animate-wave-drift-slow`, `.animate-ticket-glow-pulse` e `.animate-ticket-glow-shift`. Como a maior parte do tráfego de compra de ingresso é mobile, isso significa que hoje nenhuma das duas animações roda para a maioria dos usuários — só um gradiente e um SVG estáticos.

Confirmado por grep que `SoundWaveBackground` e `btn-ticket-glow` são usados **apenas** em `EventDetail.tsx` — nenhuma outra página é afetada por mudanças nessas classes. `featured-glow-pulse` (usado em `SimpleLinkCard.tsx`) permanece fora de escopo e continua desligado no mobile, sem mudanças.

## Decisões (validadas com o usuário)

- Reativar animações no mobile, em vez de manter mobile estático (trade-off aceito: leve custo de performance por serem apenas `transform`/`box-shadow`, sem blur pesado nem reflow).
- Fundo: reforçar o conceito atual de ondas (não trocar por partículas ou aurora).
- CTA: brilho mais forte + sweep de luz + pulso de escala sutil, todos ativos também no mobile.
- Bônus: barra de CTA fixa no rodapé da tela, mobile-only, aparecendo depois que o card de ingresso inicial sai da viewport.

## A) Fundo animado — `SoundWaveBackground.tsx`

- Subir opacidade das 2 camadas existentes (`hsl(var(--secondary) / 0.08)` → `~0.12`, `hsl(var(--primary) / 0.1)` → `~0.15`).
- Adicionar uma 3ª camada SVG em `hsl(var(--accent) / ...)`, com timing/direção de animação diferente das outras duas (para não sincronizar visualmente e parecer repetitivo), dando sensação de profundidade.
- `src/index.css`: remover `.animate-wave-drift` e `.animate-wave-drift-slow` da lista dentro de `@media (max-width: 768px)` — passam a rodar no mobile.
- Bloco `@media (prefers-reduced-motion: reduce)` **não muda** — continua desligando tudo por acessibilidade.

## B) Botão CTA — `btn-ticket-glow` (`index.css` + `tailwind.config.ts`)

- Aumentar intensidade do keyframe `ticket-glow-pulse` (raio/espalhamento maiores no box-shadow, mantendo as cores primary/accent já usadas).
- Novo efeito "sweep": pseudo-elemento (`::after`) com uma faixa diagonal de brilho que atravessa o botão em loop automático e infinito — mesmo princípio mecânico do `.shine-border::before` já existente no projeto (gradiente + `background-position`/`translateX` animado), só que aplicado ao preenchimento do botão em vez da borda. Não depende de `:hover`, então funciona igual em mobile e desktop.
- Novo keyframe `ticket-scale-pulse` (`scale(1)` → `scale(1.03)` → `scale(1)`), leve (`transform` puro, sem repaint), registrado em `tailwind.config.ts` ao lado dos outros `ticket-glow-*`.
- `src/index.css`: remover `.animate-ticket-glow-pulse` e `.animate-ticket-glow-shift` da lista do `@media (max-width: 768px)`; adicionar a nova classe de scale-pulse também ao bloco `prefers-reduced-motion` (para desligar corretamente por acessibilidade, igual às demais).

## C) Barra de CTA fixa no rodapé (mobile only)

- Novo elemento `position: fixed; bottom: 0` visível só em mobile (`lg:hidden`, espelhando o padrão já usado no "Mobile Ticket Card" existente).
- Aparece via `IntersectionObserver` observando o card de ingresso inline atual (`Mobile Ticket Card`): quando ele sai da viewport (rolando para baixo), a barra fixa aparece; enquanto ele está visível, a barra fica escondida (evita duplicar CTA na tela ao mesmo tempo).
- Contém apenas o botão principal (ticket_link direto ou abre o `TicketDayPickerModal`, conforme `useDayPicker`) — não duplica os botões de Pix/camarote, só o CTA principal de conversão.
- Padding-bottom em `safe-area-inset-bottom` (notch/iPhone) e ajuste de `padding-bottom` no `<main>` para a barra não cobrir o último conteúdo da página (compartilhar / eventos relacionados).
- Refatoração pequena: extrair o JSX do botão de ingresso (ramificação `useDayPicker` vs. link direto, hoje duplicada entre o card mobile e o card desktop) para um componente local reutilizável dentro do próprio arquivo, evitando triplicar a mesma lógica ao adicionar o 3º local (barra fixa). Não é uma abstração nova de arquitetura, só elimina a cópia que passaria a existir 3x.
- Não renderiza se não houver `ticket_link` (mesma condição já usada nos cards existentes).

## Testes

- Ajustar/adicionar testes de componente para `EventDetail.tsx` cobrindo: barra fixa aparece/desaparece conforme scroll (mock de `IntersectionObserver`), botão dentro da barra dispara a mesma ação (link direto ou abre modal) que os outros CTAs.
- Rodar suíte existente relacionada (`src/__tests__/pages`, `src/__tests__/components` que tocam `EventDetail`/`EventModal`) para garantir que nada quebrou.
- `npx tsc --noEmit` e `npm run lint` no final.
- Não é correção de bug de produção, então não se aplica a regra de "Regressões cobertas" do `docs/TESTING.md` — é melhoria de feature.

## Fora de escopo

- Não mexe em `featured-glow-pulse` (usado em `/links`) nem em outras páginas.
- Não altera lógica de negócio de compra (links, Pix, camarote, day picker) — só apresentação/animação e a nova barra fixa.
