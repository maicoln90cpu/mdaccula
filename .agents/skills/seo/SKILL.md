---
name: seo
description: SEO tecnico e descoberta organica em projetos Lovable - meta tags unicas por rota, Open Graph completo, sitemap automatico, robots.txt cirurgico, JSON-LD estruturado, canonical por rota, noindex por rota sem bloquear o site, IndexNow para indexacao rapida, llms.txt para buscas de IA, useDocumentMeta sem react-helmet, testes que protegem SEO contra regressao em deploys. Acionar quando projeto tem paginas publicas, nao aparece no Google, preview feio no WhatsApp ou LinkedIn, sem sitemap ou robots.txt, todas as paginas com mesmo titulo, erros no Google Search Console, antes de campanha de trafego, ou projeto novo sendo configurado.
---

# SEO Tecnico e Descoberta Organica

## PASSO 0 - Inspecionar e estimar antes de qualquer implementacao (obrigatorio)

Antes de implementar qualquer coisa, o Lovable inspeciona o projeto e responde:

### 1. Mapeamento de paginas

```bash
# Listar todas as rotas publicas (sem RequireAuth)
grep -rn "RequireAuth\|ProtectedRoute\|isAuthenticated" src/routes src/pages src/App.tsx 2>/dev/null

# Verificar se ja tem meta tags
grep -rn "useDocumentMeta\|react-helmet\|document.title" src --include="*.tsx" | wc -l

# Verificar se tem sitemap
ls public/sitemap.xml 2>/dev/null && echo "TEM sitemap" || echo "SEM sitemap"

# Verificar se tem robots.txt
ls public/robots.txt 2>/dev/null && echo "TEM robots.txt" || echo "SEM robots.txt"

# Verificar canonical no index.html
grep -n "canonical" index.html 2>/dev/null
```

### 2. O que fazer com cada achado

| Achado | Acao |
|---|---|
| Paginas publicas sem meta tags | MODULO 1 - useDocumentMeta |
| Sem Open Graph ou OG generico | MODULO 2 - Open Graph |
| Sem sitemap.xml | MODULO 3 - Sitemap |
| Sem robots.txt ou robots bloqueando tudo | MODULO 4 - robots.txt |
| Sem JSON-LD nas paginas principais | MODULO 5 - Dados estruturados |
| Sem IndexNow configurado | MODULO 6 - IndexNow |
| Sem llms.txt | MODULO 7 - llms.txt |
| Sem testes de SEO | MODULO 8 - Testes |

### 3. Classificar paginas do projeto

Antes de qualquer implementacao, classificar cada rota:

| Tipo | Acao | Exemplo |
|---|---|---|
| Publica indexavel | index, follow + entrar no sitemap | /, /blog, /pricing, /faq |
| Publica nao indexavel | noindex, nofollow | /login, /reset-password, /404 |
| Privada (atras de auth) | noindex, nofollow + Disallow no robots.txt | /dashboard, /settings, /admin |

### 4. Estimativa de impacto

```
DIAGNOSTICO SEO: [nome do projeto]

Paginas publicas indexaveis encontradas: X
Paginas com meta tags: Y / X
Tem sitemap: sim/nao
Tem robots.txt: sim/nao
Tem Open Graph: sim/nao
Tem JSON-LD: sim/nao

IMPACTO ESTIMADO:
- Arquivos que serao tocados: [lista]
- Risco: Baixo (SEO e aditivo, nao quebra nada existente)
- Ganho esperado: visibilidade organica, preview correto em redes sociais

Posso comecar pela Fase 1?
```

Aguardar aprovacao do usuario antes de comecar.

---

## MODULO 1 - Meta tags por rota (cada pagina tem sua propria placa)

### Regra de ouro
**Nunca `react-helmet-async` em projetos Lovable com TanStack Start — conflita com SSR. Usar hook leve via DOM API que restaura valores no unmount.**

### Hook useDocumentMeta (copiar inteiro — e generico)

```ts
// src/hooks/useDocumentMeta.ts
import { useEffect, useRef } from 'react';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  noindex?: boolean; // atalho seguro: emite "noindex, nofollow" (evita typo em string aberta)
  og?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
  };
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  hreflangs?: Array<{ lang: string; url: string }>;
}

function setMeta(name: string, content: string, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

function setLink(rel: string, href: string, hreflang?: string): HTMLElement {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]`;
  let el = document.querySelector(selector) as HTMLElement;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  (el as HTMLLinkElement).href = href;
  return el;
}

export function useDocumentMeta(opts: DocumentMetaOptions) {
  const prevTitle = useRef(document.title);

  useEffect(() => {
    const prev = { title: document.title };

    // Title
    if (opts.title) document.title = opts.title;

    // Description
    if (opts.description) setMeta('description', opts.description);

    // Robots (noindex por rota)
    if (opts.robots) setMeta('robots', opts.robots);
    else setMeta('robots', 'index, follow'); // padrao

    // Canonical
    if (opts.canonical) setLink('canonical', opts.canonical);

    // Open Graph
    if (opts.og?.title)       setMeta('og:title',       opts.og.title,       'property');
    if (opts.og?.description) setMeta('og:description', opts.og.description, 'property');
    if (opts.og?.image)       setMeta('og:image',       opts.og.image,       'property');
    if (opts.og?.url)         setMeta('og:url',         opts.og.url,         'property');
    if (opts.og?.type)        setMeta('og:type',        opts.og.type,        'property');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    if (opts.og?.title)       setMeta('twitter:title',       opts.og.title);
    if (opts.og?.description) setMeta('twitter:description', opts.og.description);
    if (opts.og?.image)       setMeta('twitter:image',       opts.og.image);

    // hreflang (multi-idioma)
    opts.hreflangs?.forEach(({ lang, url }) => setLink('alternate', url, lang));

    // JSON-LD
    let ldScript: HTMLScriptElement | null = null;
    if (opts.jsonLd) {
      ldScript = document.querySelector('script[data-page-ld]');
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.type = 'application/ld+json';
        ldScript.setAttribute('data-page-ld', '1');
        document.head.appendChild(ldScript);
      }
      const nodes = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
      ldScript.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
    }

    // Cleanup: restaurar ao navegar para outra rota
    return () => {
      document.title = prev.title;
      if (ldScript) ldScript.textContent = '';
    };
  }, [opts.title, opts.description, opts.canonical, opts.robots]);
}
```

### Usando em cada pagina publica

```tsx
// Pagina indexavel
export function PaginaPreco() {
  useDocumentMeta({
    title: 'Planos e Precos — [Nome do Produto]',       // < 60 caracteres
    description: 'Escolha o plano ideal. [beneficio principal]. Comece gratis hoje.', // < 160 caracteres
    canonical: 'https://[dominio]/pricing',              // sempre absoluto
    og: {
      title: 'Planos e Precos — [Nome do Produto]',
      description: 'Escolha o plano ideal para o seu negocio.',
      image: 'https://[dominio]/og/pricing.png',         // 1200x630px
      url: 'https://[dominio]/pricing',
      type: 'website',
    },
  });
  // ...
}

// Pagina NAO indexavel (login, reset, 404)
export function PaginaLogin() {
  useDocumentMeta({
    title: 'Entrar — [Nome do Produto]',
    robots: 'noindex, nofollow', // bloquear so esta pagina
  });
  // ...
}
```

### Regras de meta tags

- **Title:** < 60 caracteres, keyword principal no inicio, unico por pagina
- **Description:** < 160 caracteres, persuasiva, unica por pagina
- **Canonical:** sempre absoluto (`https://dominio.com/...`), nunca relativo
- **noindex** por rota — nunca bloquear o site inteiro
- **1 H1 por pagina** — sempre, sem excecao
- **HTML semantico:** `<main>`, `<header>`, `<nav>`, `<article>`, `<footer>` — nunca `<div>` para tudo

---

## MODULO 2 - Open Graph (a caixinha bonita no WhatsApp)

### Base sitewide no index.html

```html
<!-- index.html — valores globais, sobrescritos por rota via hook -->
<meta property="og:site_name" content="[Nome do Produto]" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:type" content="website" />
<meta property="og:title" content="[Titulo padrao do site]" />
<meta property="og:description" content="[Descricao padrao do site]" />
<meta property="og:image" content="https://[dominio]/og/default.png" />
<meta property="og:url" content="https://[dominio]" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@[handle]" />
```

### Imagem OG padrao

- Tamanho: **1200x630px** (obrigatorio para preview correto)
- Formato: JPG ou PNG (WebP tem suporte parcial em previews)
- Salvar em: `public/og/default.png`
- Por pagina importante: `public/og/[nome-da-pagina].png`

### Validar preview antes de publicar

- LinkedIn: `https://www.linkedin.com/post-inspector/`
- Facebook/WhatsApp: `https://developers.facebook.com/tools/debug/`
- Twitter/X: `https://cards-dev.twitter.com/validator`

---

## MODULO 3 - Sitemap (o mapa para o Google)

### Script de geracao automatica

```js
// scripts/generate-sitemap.mjs
// Rodar em prebuild e predev — adicionar ao package.json:
// "predev": "node scripts/generate-sitemap.mjs",
// "prebuild": "node scripts/generate-sitemap.mjs"

import { writeFileSync } from 'node:fs';

const DOMAIN = 'https://[dominio]'; // trocar pelo dominio real
const TODAY = new Date().toISOString().split('T')[0];

// PAGINAS ESTATICAS — adaptar ao projeto real
const staticPages = [
  { url: '/',          priority: '1.0', changefreq: 'weekly'  },
  { url: '/pricing',   priority: '0.9', changefreq: 'monthly' },
  { url: '/blog',      priority: '0.8', changefreq: 'daily'   },
  { url: '/faq',       priority: '0.7', changefreq: 'monthly' },
  { url: '/compare',   priority: '0.8', changefreq: 'monthly' },
  { url: '/about',     priority: '0.5', changefreq: 'monthly' },
  // NUNCA incluir: /login, /dashboard, /settings, /admin, /404
];

const urls = staticPages.map(({ url, priority, changefreq }) => `
  <url>
    <loc>${DOMAIN}${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

writeFileSync('public/sitemap.xml', sitemap.trim());
console.log('Sitemap gerado:', staticPages.length, 'URLs');
```

### Regras de sitemap

- **Nunca incluir** paginas privadas, login, reset-password, 404, admin
- **Sempre rodar** em `prebuild` — nunca sitemap desatualizado no ar
- **Submeter** no Google Search Console apos primeira geracao
- **Sitemap dinamico** via Edge Function quando o projeto tem blog com muitos posts

---

## MODULO 4 - robots.txt (o porteiro do site)

### Modelo defensivo para projetos Lovable

```txt
# public/robots.txt
# Adaptar a lista de Disallow para as rotas privadas reais do projeto

User-agent: Googlebot
Allow: /
Disallow: /dashboard
Disallow: /settings
Disallow: /admin
Disallow: /login
Disallow: /register
Disallow: /reset-password
Disallow: /verify-email
Disallow: /checkout
Disallow: /api/

User-agent: Bingbot
Allow: /
Disallow: /dashboard
Disallow: /settings
Disallow: /admin
Disallow: /login

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /settings
Disallow: /admin
Disallow: /login
Disallow: /api/

Sitemap: https://[dominio]/sitemap.xml
```

### Regras de robots.txt

- **Sempre ter** `Sitemap:` apontando para o sitemap canonico
- **Bloquear cirurgicamente** — nunca `Disallow: /` (bloqueia tudo)
- **Crawlers de redes sociais** (`Twitterbot`, `facebookexternalhit`) precisam de `Allow: /` para gerar previews
- **Nunca bloquear** `/privacy-policy` e `/terms` — Google precisa ler para avaliar confiabilidade

---

## MODULO 5 - Dados estruturados JSON-LD (a ficha completa na vitrine)

### Helper de builders genericos

```ts
// src/lib/structuredData.ts

export function buildOrganizationJsonLd(opts: {
  name: string;
  url: string;
  logo: string;
  sameAs?: string[]; // redes sociais
}): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: opts.name,
    url: opts.url,
    logo: opts.logo,
    sameAs: opts.sameAs ?? [],
  };
}

export function buildWebSiteJsonLd(opts: {
  name: string;
  url: string;
}): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    name: opts.name,
    url: opts.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${opts.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFaqJsonLd(
  items: Array<{ question: string; answer: string }>
): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function buildArticleJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
}): Record<string, unknown> {
  return {
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    image: opts.image,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { '@type': 'Person', name: opts.authorName },
  };
}

export function buildSoftwareAppJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  price?: string;
  currency?: string;
}): Record<string, unknown> {
  return {
    '@type': 'SoftwareApplication',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: opts.price ?? '0',
      priceCurrency: opts.currency ?? 'BRL',
    },
  };
}
```

### Qual JSON-LD usar em cada tipo de pagina

| Pagina | JSON-LD recomendado |
|---|---|
| Home / Landing | Organization + WebSite + SoftwareApplication |
| Blog post | Article + BreadcrumbList |
| FAQ | FAQPage |
| Pricing | SoftwareApplication com Offer |
| Pagina de comparacao | Product |
| Qualquer pagina interna | BreadcrumbList |

### Usando com useDocumentMeta

```tsx
import { buildFaqJsonLd, buildBreadcrumbJsonLd } from '@/lib/structuredData';

export function PaginaFaq() {
  useDocumentMeta({
    title: 'Perguntas Frequentes — [Nome]',
    description: 'Tire suas duvidas sobre [produto].',
    canonical: 'https://[dominio]/faq',
    jsonLd: [
      buildBreadcrumbJsonLd([
        { name: 'Inicio', url: 'https://[dominio]' },
        { name: 'FAQ', url: 'https://[dominio]/faq' },
      ]),
      buildFaqJsonLd([
        { question: 'Como funciona?', answer: 'Resposta clara e direta.' },
      ]),
    ],
  });
}
```

---

## MODULO 6 - IndexNow (avisar o Google na hora)

### Edge Function de envio automatico

```ts
// supabase/functions/submit-indexnow/index.ts
// Configurar cron diario: SELECT cron.schedule('indexnow-daily', '0 8 * * *', ...)

import { corsHeaders } from '../_shared/cors.ts';

const INDEXNOW_KEY = Deno.env.get('INDEXNOW_KEY')!;
const DOMAIN = Deno.env.get('PUBLIC_DOMAIN')!; // ex: meusite.com.br

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Ler sitemap e extrair URLs
    const sitemapRes = await fetch(`https://${DOMAIN}/sitemap.xml`);
    const xml = await sitemapRes.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

    // Enviar para IndexNow (cobre Bing + Yandex + outros motores)
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: DOMAIN,
        key: INDEXNOW_KEY,
        keyLocation: `https://${DOMAIN}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000), // limite IndexNow
      }),
    });

    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, urls: urls.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Setup do IndexNow

1. Gerar chave: string alfanumerica unica, ex: `a1b2c3d4e5f6...`
2. Salvar como secret: `add_secret INDEXNOW_KEY = [chave]`
3. Criar arquivo de verificacao: `public/[chave].txt` com a chave como conteudo
4. Configurar cron: `SELECT cron.schedule('indexnow-daily', '0 8 * * *', 'SELECT net.http_post(...)');`

---

## MODULO 7 - llms.txt (aparecer no ChatGPT e Perplexity)

### Formato padrao

```txt
# public/llms.txt
# Padrao emergente — descobre o site para LLMs (Perplexity, ChatGPT, Gemini)

# [Nome do Produto]

> [Uma frase descrevendo o que o produto faz e para quem]

## Paginas principais

- [Pagina inicial]: https://[dominio]/
- [Funcionalidades]: https://[dominio]/features
- [Precos]: https://[dominio]/pricing
- [Blog]: https://[dominio]/blog
- [FAQ]: https://[dominio]/faq
- [Sobre]: https://[dominio]/about

## Optional

- [Documentacao]: https://[dominio]/docs
- [Status]: https://[dominio]/status
- [Termos]: https://[dominio]/terms
- [Privacidade]: https://[dominio]/privacy
```

### Quando incluir

- Projeto tem paginas publicas com conteudo relevante — incluir sempre
- SaaS fechado sem paginas publicas — nao incluir (nao ha valor)

---

## MODULO 8 - Testes que protegem SEO (nao deixar regredir)

### Teste de canonical por rota

```ts
// src/__tests__/contracts/seo-canonical.test.ts
import { describe, it, expect } from 'vitest';

// Listar TODAS as paginas publicas indexaveis do projeto
const PUBLIC_PAGES = [
  { path: '/',        component: 'Home'    },
  { path: '/pricing', component: 'Pricing' },
  { path: '/faq',     component: 'Faq'     },
  { path: '/blog',    component: 'Blog'    },
  // adicionar todas as paginas publicas aqui
];

describe('SEO - Contrato de canonical', () => {
  it('toda pagina publica deve usar useDocumentMeta', async () => {
    for (const page of PUBLIC_PAGES) {
      const source = await import(`../../pages/${page.component}.tsx`).catch(() => null);
      // verificar que o componente usa useDocumentMeta
      expect(source, `${page.component} deve usar useDocumentMeta`).not.toBeNull();
    }
  });
});
```

### Teste de sitemap vs paginas publicas

```ts
// src/__tests__/contracts/seo-sitemap.test.ts
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('SEO - Sitemap', () => {
  it('sitemap.xml deve existir', () => {
    expect(existsSync('public/sitemap.xml')).toBe(true);
  });

  it('sitemap nao deve conter paginas privadas', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf-8');
    const privateRoutes = ['/login', '/dashboard', '/settings', '/admin', '/reset'];
    for (const route of privateRoutes) {
      expect(sitemap).not.toContain(route);
    }
  });

  it('robots.txt deve existir', () => {
    expect(existsSync('public/robots.txt')).toBe(true);
  });
});
```

---

## Checklist pre-Publish (apresentar ao usuario antes de todo deploy)

```
CHECKLIST SEO — [nome do projeto]

META TAGS
[ ] Toda pagina publica tem title unico < 60 caracteres?
[ ] Toda pagina publica tem description unica < 160 caracteres?
[ ] Toda pagina publica tem canonical absoluto?
[ ] Paginas privadas (login, dashboard) tem noindex?
[ ] Existe exatamente 1 H1 por pagina?

OPEN GRAPH
[ ] og:title, og:description, og:image, og:url em todas as paginas publicas?
[ ] Imagem OG existe e tem 1200x630px?
[ ] Preview validado no LinkedIn e WhatsApp?

SITEMAP E ROBOTS
[ ] sitemap.xml gerado e atualizado (rodar generate-sitemap.mjs)?
[ ] sitemap nao contem paginas privadas?
[ ] robots.txt tem Disallow nas rotas privadas?
[ ] robots.txt tem Sitemap: apontando para o sitemap?

JSON-LD
[ ] Home tem Organization + WebSite?
[ ] Blog posts tem Article?
[ ] FAQ tem FAQPage?
[ ] Paginas internas tem BreadcrumbList?

INFRAESTRUTURA
[ ] Google Search Console configurado?
[ ] Sitemap submetido no GSC?
[ ] IndexNow configurado (INDEXNOW_KEY secret + arquivo de verificacao)?
[ ] llms.txt existe em public/?

TESTES
[ ] seo-canonical.test.ts passando?
[ ] seo-sitemap.test.ts passando?
```

---

## AUTO-EVOLUCAO DA SKILL (etapa obrigatoria - nao pular)

Esta etapa e OBRIGATORIA ao final de toda aplicacao desta skill. Nao e opcional.

### Passo 1 - Varrer o projeto em busca de padroes melhores

Apos implementar, varrer o projeto procurando especificamente:
- Implementacoes de useDocumentMeta mais robustas
- Builders de JSON-LD mais completos ou com mais tipos
- Scripts de sitemap com suporte a rotas dinamicas
- Testes de SEO mais abrangentes
- Qualquer padrao de SEO que esta skill nao cobre

### Passo 2 - Aplicar filtro obrigatorio em cada padrao encontrado

Para CADA padrao candidato, responder as 4 perguntas:

1. **E generico?** Funciona em qualquer projeto Lovable, nao so neste?
2. **Sem nomes especificos?** Sem nomes de pagina, dominio, handle ou arquivo deste projeto?
3. **Sem data nem nome de projeto?** Skills sao atemporais e universais
4. **So adiciona?** Nao remove nem contradiz nenhuma regra existente da skill?

Se QUALQUER resposta for nao: descartar silenciosamente, nao mencionar ao usuario.
Se TODAS forem sim: candidato a atualizacao.

### Passo 3 - Apresentar proposta ao usuario (se houver candidatos)

```
Encontrei um padrao no projeto que pode melhorar a skill seo:

PADRAO: [descrever o que e]
ONDE ENTRA NA SKILL: [qual modulo/secao]
POR QUE E MELHOR: [justificativa clara]
TRECHO GENERICO PROPOSTO:
[codigo ja generalizado, sem nomes do projeto]

Deseja incorporar este padrao na skill?
```

Aguardar confirmacao para cada padrao separadamente.

### Passo 4 - Atualizar com /skill-creator (somente apos aprovacao)

1. Executar o comando /skill-creator
2. Instruir o skill-creator a atualizar esta skill especificamente
3. Incorporar APENAS os padroes aprovados, exatamente como foram aprovados
4. Nunca reduzir, remover ou reescrever o que ja existe - apenas adicionar
5. Confirmar ao usuario que a skill foi atualizada com sucesso

Se o usuario nao aprovar nenhum padrao: informar "Nenhuma atualizacao aplicada a skill." e encerrar.
