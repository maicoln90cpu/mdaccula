#!/usr/bin/env node
/**
 * Gera public/sitemap.xml com rotas estáticas + eventos ativos + posts publicados.
 * Executado nos hooks predev / prebuild / prebuild:dev (package.json).
 *
 * Tolerante a falhas: se a API estiver fora, mantém o sitemap atual e
 * encerra com código 0 para não quebrar o build.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://mdaccula.com";
const OUT_PATH = resolve("public/sitemap.xml");

// --- ler .env (sem dependência externa) ---
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
const SUPABASE_URL =
  env.VITE_SUPABASE_URL || "https://xfvpuzlspvvsmmunznxw.supabase.co";
const SUPABASE_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY ||
  "";

// --- rotas estáticas ---
const STATIC_ENTRIES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/eventos", changefreq: "daily", priority: "0.95" },
  { path: "/blog", changefreq: "daily", priority: "0.95" },
  { path: "/MDAcculaRadio", changefreq: "weekly", priority: "0.85" },
  { path: "/quem-somos", changefreq: "weekly", priority: "0.8" },
  { path: "/contato", changefreq: "monthly", priority: "0.8" },
  { path: "/links", changefreq: "monthly", priority: "0.7" },
  { path: "/busca", changefreq: "weekly", priority: "0.6" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
];

async function fetchRows(path) {
  if (!SUPABASE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
  return res.json();
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

function urlBlock({ path, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${BASE_URL}${escapeXml(path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  let events = [];
  let posts = [];
  const today = new Date().toISOString().slice(0, 10);
  try {
    [events, posts] = await Promise.all([
      fetchRows(
        `events?select=slug,updated_at,date&status=eq.active&date=gte.${today}&slug=not.is.null&limit=5000`
      ),
      fetchRows(
        "blog_posts?select=slug,updated_at,published_at&published=eq.true&slug=not.is.null&limit=5000"
      ),
    ]);
  } catch (err) {
    console.warn(
      `[sitemap] aviso: falha ao buscar dados dinâmicos (${err.message}). Mantendo sitemap atual.`
    );
    return;
  }

  const eventEntries = events
    .filter((e) => e.slug)
    .map((e) => ({
      path: `/eventos/${e.slug}`,
      lastmod: e.updated_at,
      changefreq: "weekly",
      priority: "0.8",
    }));

  const postEntries = posts
    .filter((p) => p.slug)
    .map((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: p.updated_at || p.published_at,
      changefreq: "monthly",
      priority: "0.7",
    }));

  const all = [...STATIC_ENTRIES, ...eventEntries, ...postEntries];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...all.map(urlBlock),
    "</urlset>",
    "",
  ].join("\n");

  writeFileSync(OUT_PATH, xml);
  console.log(
    `[sitemap] gerado com ${all.length} URLs (${eventEntries.length} eventos, ${postEntries.length} posts).`
  );
}

main().catch((err) => {
  console.warn(`[sitemap] erro inesperado: ${err.message}. Build continua.`);
});
