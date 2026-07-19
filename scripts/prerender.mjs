#!/usr/bin/env node
/**
 * Gera HTML pré-renderizado (public/_prerendered/**) para rotas críticas —
 * home, eventos ativos, posts publicados — usando Playwright headless contra
 * o site já publicado (mdaccula.lovable.app por padrão, ou PRERENDER_BASE_URL).
 *
 * Por quê: a hospedagem Lovable é uma SPA estática pura sem SSR/prerender
 * nativo (docs/LOVABLE-PLATFORM-CAPABILITIES.md, pergunta 2) — todo crawler
 * sem JS (redes sociais, alguns bots de IA) recebe o mesmo HTML genérico da
 * home pra qualquer rota. Este script roda fora do pipeline do Lovable (só
 * no GitHub Actions, agendado — nunca em push, ver .github/workflows/
 * prerender.yml) e o HTML resultante é commitado de volta pro repo; o
 * `vite build` do Lovable inclui esses arquivos no output normalmente por já
 * estarem em `public/` antes do build rodar.
 *
 * Aponta pro site já publicado (não um `vite preview` local) de propósito —
 * testado localmente e confirmado que `vite preview` contra um build feito
 * fora do ambiente do Lovable pode falhar a hidratar (erro de módulo React
 * não reproduzido no site real); o subdomínio `mdaccula.lovable.app` é o
 * output real do build do Lovable e evita essa divergência por completo.
 *
 * Tolerante a falhas por rota: uma rota que falhar (timeout, 404, etc.) é
 * pulada com aviso — nunca derruba o script inteiro. Se a etapa de fetch de
 * dados falhar, encerra com código 0 sem gerar nada (não quebra o build/CI).
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const OUT_DIR = resolve("public/_prerendered");
const PAGE_TIMEOUT_MS = 15000;
const HYDRATION_GRACE_MS = 8000;
// Título estático do shell (index.html) antes de qualquer hidratação — se
// ainda for esse depois da espera, a rota não carregou dados reais.
// StructuredData usa react-helmet-async, cujas tags de <script>/JSON-LD têm
// timing de flush inconsistente com page.waitForSelector (confirmado em
// teste manual: o JSON-LD está no HTML final, mas o seletor às vezes não
// pega o momento certo) — comparar o <title> real é um sinal mais confiável.
const STATIC_SHELL_TITLE = "MDAccula - Música Eletrônica em São Paulo";

// --- ler .env (mesmo padrão de generate-sitemap.mjs) ---
function loadEnv() {
  const env = { ...process.env };
  const envPath = resolve(".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  return env;
}
const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://xfvpuzlspvvsmmunznxw.supabase.co";
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
const BASE_URL = (env.PRERENDER_BASE_URL || "https://mdaccula.lovable.app").replace(/\/$/, "");

async function fetchRows(path) {
  if (!SUPABASE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
  return res.json();
}

async function getTargetRoutes() {
  const today = new Date().toISOString().slice(0, 10);
  // Limite opcional pra teste local/debug em CI (ex.: PRERENDER_LIMIT=3) — sem
  // isso, roda todas as rotas ativas/publicadas (comportamento de produção).
  const limit = env.PRERENDER_LIMIT ? parseInt(env.PRERENDER_LIMIT, 10) : null;
  const [events, posts] = await Promise.all([
    fetchRows(`events?select=slug&status=eq.active&date=gte.${today}&slug=not.is.null&limit=5000`),
    fetchRows("blog_posts?select=slug&published=eq.true&slug=not.is.null&limit=5000"),
  ]);

  const eventRoutes = events.filter((e) => e.slug).map((e) => ({ route: `/eventos/${e.slug}`, outPath: `eventos/${e.slug}/index.html` }));
  const postRoutes = posts.filter((p) => p.slug).map((p) => ({ route: `/blog/${p.slug}`, outPath: `blog/${p.slug}/index.html` }));

  return [
    { route: "/", outPath: "index.html" },
    ...(limit ? eventRoutes.slice(0, limit) : eventRoutes),
    ...(limit ? postRoutes.slice(0, limit) : postRoutes),
  ];
}

async function main() {
  let routes;
  try {
    routes = await getTargetRoutes();
  } catch (err) {
    console.warn(`[prerender] aviso: falha ao buscar rotas dinâmicas (${err.message}). Nada gerado.`);
    return;
  }

  console.log(`[prerender] ${routes.length} rota(s)-alvo contra ${BASE_URL} (home + eventos ativos + posts publicados).`);

  const browser = await chromium.launch();
  let ok = 0;
  let failed = 0;

  try {
    for (const { route, outPath } of routes) {
      const page = await browser.newPage();
      try {
        // waitUntil:'domcontentloaded' de propósito, não 'networkidle' — a
        // app tem conexões persistentes (Supabase Realtime) que nunca ficam
        // "idle", o que faria 'networkidle' sempre estourar o timeout.
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
        // Espera fixa pra hidratação (fetch dos dados da rota + flush do
        // react-helmet-async no <head>) — mais confiável aqui do que
        // waitForSelector no JSON-LD, que tem timing de flush inconsistente.
        await page.waitForTimeout(HYDRATION_GRACE_MS);

        const title = await page.title();
        if (!title || title === STATIC_SHELL_TITLE) {
          console.warn(`[prerender] aviso: ${route} ainda no título genérico do shell após ${HYDRATION_GRACE_MS}ms — pulando (não hidratou).`);
          failed++;
          continue;
        }

        const html = await page.content();
        const fullOutPath = resolve(OUT_DIR, outPath);
        mkdirSync(dirname(fullOutPath), { recursive: true });
        writeFileSync(fullOutPath, html);
        ok++;
      } catch (err) {
        console.warn(`[prerender] aviso: falha em ${route} (${err.message}). Pulando.`);
        failed++;
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[prerender] concluído: ${ok} gerada(s), ${failed} falha(s).`);
}

main().catch((err) => {
  console.warn(`[prerender] erro inesperado: ${err.message}. Build continua.`);
});
