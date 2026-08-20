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
 * Tolerante a falha PONTUAL de rota (timeout numa página específica, 404 etc.)
 * — só pula aquela rota com aviso, não derruba o script inteiro. Mas falha alta
 * (exit code != 0) quando o resultado é 0 páginas geradas — seja porque a busca
 * das rotas dinâmicas falhou, seja porque toda rota tentada não hidratou — pra
 * aparecer como run vermelha na aba Actions em vez de "sucesso" silencioso sem
 * gerar nada (foi assim que o pipeline ficou ~1 mês sem gerar HTML nenhum sem
 * ninguém perceber, até a auditoria de 16/08/2026 achar o buraco).
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

const OUT_DIR = resolve("public/_prerendered");
const MANIFEST_PATH = resolve(OUT_DIR, ".manifest.json");
const PAGE_TIMEOUT_MS = 15000;
const HYDRATION_GRACE_MS = 8000;

// --- arquivos que afetam o CONTEÚDO das páginas pré-renderizadas (título,
// meta tags, JSON-LD) — mudar qualquer um deles força uma varredura completa
// no próximo run, mesmo que nenhum evento/post tenha mudado no banco.
//
// ⚠️ LEMBRETE: se você criar ou mexer num componente que também gera/afeta
// title/meta/JSON-LD renderizado nessas páginas (og:*, twitter:*, canonical,
// structured data), adicione o caminho dele aqui — senão o cache incremental
// vai continuar servindo HTML desatualizado achando que nada mudou. Isso é
// checado por hash de conteúdo, não por data de arquivo — funciona com
// qualquer editor/IDE/CI.
const SEO_TEMPLATE_FILES = ["index.html", "src/components/SEOHead.tsx", "src/components/StructuredData.tsx"];
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
    fetchRows(`events?select=slug,updated_at&status=eq.active&date=gte.${today}&slug=not.is.null&limit=5000`),
    fetchRows("blog_posts?select=slug,updated_at&published=eq.true&slug=not.is.null&limit=5000"),
  ]);

  const eventRoutes = events
    .filter((e) => e.slug)
    .map((e) => ({ route: `/eventos/${e.slug}`, outPath: `eventos/${e.slug}/index.html`, updatedAt: e.updated_at }));
  const postRoutes = posts
    .filter((p) => p.slug)
    .map((p) => ({ route: `/blog/${p.slug}`, outPath: `blog/${p.slug}/index.html`, updatedAt: p.updated_at }));

  return [
    // A home não tem um "updated_at" próprio (mostra os eventos mais recentes
    // em geral) — sempre reprocessada, é só 1 rota, custo desprezível.
    { route: "/", outPath: "index.html", updatedAt: null },
    ...(limit ? eventRoutes.slice(0, limit) : eventRoutes),
    ...(limit ? postRoutes.slice(0, limit) : postRoutes),
  ];
}

// --- registro incremental (public/_prerendered/.manifest.json) ---

function computeSeoTemplateHash() {
  const hash = createHash("sha256");
  for (const file of SEO_TEMPLATE_FILES) {
    hash.update(file);
    hash.update("\0");
    hash.update(existsSync(file) ? readFileSync(file, "utf8") : "");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.routes !== "object" || parsed.routes === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveManifest(manifest) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

// Decisão pura (sem I/O) — dá pra pular esta rota nesta execução? Só pula se
// não for a home, não for uma varredura forçada (código mudou) e já existir
// um registro anterior com a MESMA data de atualização do conteúdo — ou seja,
// nada mudou desde a última vez que essa rota foi gerada com sucesso.
export function shouldSkipRoute({ route, updatedAt }, previousManifestRoutes, forceFullRun) {
  if (route === "/" || forceFullRun) return false;
  const previous = previousManifestRoutes[route];
  return Boolean(previous) && previous.updatedAt === updatedAt;
}

async function main() {
  let routes;
  try {
    routes = await getTargetRoutes();
  } catch (err) {
    console.error(`[prerender] ERRO: falha ao buscar rotas dinâmicas (${err.message}) — nada gerado.`);
    process.exitCode = 1;
    return;
  }

  const codeHash = computeSeoTemplateHash();
  const previousManifest = loadManifest();
  const previousRoutes = previousManifest?.routes ?? {};
  const forceFullRun = !previousManifest || previousManifest.codeHash !== codeHash;

  if (forceFullRun) {
    console.log(
      previousManifest
        ? "[prerender] arquivo(s) que afetam o SEO das páginas mudaram desde a última execução — varredura completa (ignorando o cache incremental)."
        : "[prerender] sem registro de execução anterior (primeira vez, ou registro perdido/corrompido) — varredura completa.",
    );
  }

  const targetRouteSet = new Set(routes.map((r) => r.route));
  const toProcess = routes.filter((r) => !shouldSkipRoute(r, previousRoutes, forceFullRun));
  const skipped = routes.length - toProcess.length;

  console.log(
    `[prerender] ${routes.length} rota(s)-alvo contra ${BASE_URL} (home + eventos ativos + posts publicados) — ${toProcess.length} pra processar, ${skipped} já atualizada(s) (pulando).`,
  );

  // Registro novo parte do antigo, mas só carrega adiante as rotas que estão
  // sendo PULADAS (confirmadamente em dia) — as que vão ser (re)processadas
  // abaixo só entram no registro novo se realmente tiverem sucesso. Isso
  // evita que uma rota que falhe numa varredura forçada fique marcada como
  // "em dia" só porque o conteúdo dela no banco não mudou (ela não foi de
  // fato regenerada com o código novo, então precisa ser tentada de novo).
  const toProcessRouteSet = new Set(toProcess.map((r) => r.route));
  const newManifestRoutes = {};
  let orphansRemoved = 0;
  for (const [oldRoute, entry] of Object.entries(previousRoutes)) {
    if (!targetRouteSet.has(oldRoute)) {
      const fullOutPath = resolve(OUT_DIR, entry.outPath);
      if (existsSync(fullOutPath)) {
        rmSync(fullOutPath);
        orphansRemoved++;
      }
      continue;
    }
    if (!toProcessRouteSet.has(oldRoute)) {
      newManifestRoutes[oldRoute] = entry;
    }
  }
  if (orphansRemoved > 0) {
    console.log(`[prerender] ${orphansRemoved} página(s) órfã(s) removida(s) (evento/post não é mais alvo válido).`);
  }

  const browser = await chromium.launch();
  let ok = 0;
  let failed = 0;

  try {
    for (const { route, outPath, updatedAt } of toProcess) {
      const page = await browser.newPage();
      try {
        // waitUntil:'domcontentloaded' de propósito, não 'networkidle' — a
        // app tem conexões persistentes (Supabase Realtime) que nunca ficam
        // "idle", o que faria 'networkidle' sempre estourar o timeout.
        const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
        // Espera fixa pra hidratação (fetch dos dados da rota + flush do
        // react-helmet-async no <head>) — mais confiável aqui do que
        // waitForSelector no JSON-LD, que tem timing de flush inconsistente.
        await page.waitForTimeout(HYDRATION_GRACE_MS);

        const title = await page.title();
        if (!title || title === STATIC_SHELL_TITLE) {
          // O site roda atrás do Cloudflare (cookie __cf_bm confirmado em
          // 16/08/2026) — Bot Management costuma desafiar navegador headless
          // vindo de IP de datacenter (ex.: runner do GitHub Actions), mesmo
          // quando um fetch simples do mesmo IP passa sem problema. Detectar
          // isso aqui poupa uma investigação manual no próximo run que falhar.
          const bodyText = await page.content().catch(() => "");
          const looksLikeCloudflareChallenge =
            /Just a moment|cf-browser-verification|challenges\.cloudflare\.com|Attention Required! \| Cloudflare|cf_chl_/i.test(
              bodyText,
            );
          const statusNote = response ? ` HTTP ${response.status()}.` : "";
          const causeNote = looksLikeCloudflareChallenge
            ? " Conteúdo bate com um desafio do Cloudflare Bot Management, não com hidratação lenta — provável bloqueio do navegador headless pelo IP do runner."
            : "";
          console.warn(
            `[prerender] aviso: ${route} ainda no título genérico do shell após ${HYDRATION_GRACE_MS}ms.${statusNote}${causeNote} Pulando (não hidratou).`,
          );
          failed++;
          continue;
        }

        const html = await page.content();
        const fullOutPath = resolve(OUT_DIR, outPath);
        mkdirSync(dirname(fullOutPath), { recursive: true });
        writeFileSync(fullOutPath, html);
        newManifestRoutes[route] = { outPath, updatedAt };
        ok++;
      } catch (err) {
        console.warn(`[prerender] aviso: falha em ${route} (${err.message}). Pulando.`);
        failed++;
        // Não atualiza o registro dessa rota — se ela já tinha uma versão
        // válida de antes, o HTML antigo continua no disco (não é apagado
        // por uma falha pontual) e será tentada de novo na próxima execução.
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[prerender] concluído: ${ok} gerada(s), ${skipped} pulada(s) (sem mudança), ${failed} falha(s).`);

  saveManifest({ codeHash, generatedAt: new Date().toISOString(), routes: newManifestRoutes });

  if (toProcess.length > 0 && ok === 0) {
    console.error(
      `[prerender] ERRO: nenhuma das ${toProcess.length} rota(s) tentada(s) gerou HTML válido — falha total, não uma falha pontual. Veja os avisos acima (procure por menção a Cloudflare/timeout/HTTP status).`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[prerender] ERRO inesperado: ${err.message}`);
  process.exitCode = 1;
});
