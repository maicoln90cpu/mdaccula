#!/usr/bin/env node
/**
 * Gera public/rss.xml estático com os posts publicados mais recentes.
 * Executado nos hooks predev / prebuild / prebuild:dev (package.json), ao lado
 * do generate-sitemap.mjs.
 *
 * Substitui o RSS dinâmico (edge function blog-rss) no domínio próprio — a
 * hospedagem Lovable não suporta rewrite de /functions/v1/* (ver
 * docs/LOVABLE-PLATFORM-CAPABILITIES.md, pergunta 4), então o feed precisa
 * existir como arquivo estático versionado, igual ao sitemap.
 *
 * Tolerante a falhas: se a API estiver fora, mantém o rss.xml atual e
 * encerra com código 0 para não quebrar o build.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://mdaccula.com";
const OUT_PATH = resolve("public/rss.xml");
const POST_LIMIT = 50;

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
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";

async function fetchPosts() {
  if (!SUPABASE_KEY) return null;
  const fields = "title,slug,excerpt,content,category,image_url,published_at,created_at";
  const url = `${SUPABASE_URL}/rest/v1/blog_posts?select=${fields}&published=eq.true&order=published_at.desc&limit=${POST_LIMIT}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
  return res.json();
}

/**
 * NUNCA usar a URL crua do banco no RSS — leitores de feed (Feedly, Mailchimp,
 * clientes de e-mail que importam RSS) nem sempre renderizam WebP. Força JPEG
 * via Bunny Image Optimizer (mesma lógica de supabase/functions/blog-rss).
 */
function toFeedSafeImage(url) {
  if (!url) return "";
  if (!url.includes("mdaccula.b-cdn.net")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}format=jpeg&width=1200`;
}

function xmlEscapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "");
}

function itemBlock(post) {
  const pubDate = new Date(post.published_at || post.created_at).toUTCString();
  const image = toFeedSafeImage(post.image_url);
  const enclosure = image
    ? `      <enclosure url="${xmlEscapeAttr(image)}" type="image/jpeg" />\n`
    : "";
  const description = post.excerpt || `${stripHtml(post.content).slice(0, 200)}...`;

  return [
    "    <item>",
    `      <title><![CDATA[${post.title}]]></title>`,
    `      <link>${SITE_URL}/blog/${post.slug}</link>`,
    `      <guid>${SITE_URL}/blog/${post.slug}</guid>`,
    `      <description><![CDATA[${description}]]></description>`,
    `      <pubDate>${pubDate}</pubDate>`,
    post.category ? `      <category>${post.category}</category>` : null,
    enclosure ? enclosure.trimEnd() : null,
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  let posts;
  try {
    posts = await fetchPosts();
  } catch (err) {
    console.warn(
      `[rss] aviso: falha ao buscar posts (${err.message}). Mantendo rss.xml atual.`
    );
    return;
  }

  if (!posts) {
    console.warn("[rss] aviso: sem chave Supabase disponível. Mantendo rss.xml atual.");
    return;
  }

  const buildDate = new Date().toUTCString();
  const items = posts.map(itemBlock).join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>MD Accula Blog</title>",
    `    <link>${SITE_URL}/blog</link>`,
    "    <description>Notícias e novidades da cena eletrônica de São Paulo</description>",
    "    <language>pt-BR</language>",
    `    <lastBuildDate>${buildDate}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  writeFileSync(OUT_PATH, xml);
  console.log(`[rss] gerado com ${posts.length} posts.`);
}

main().catch((err) => {
  console.warn(`[rss] erro inesperado: ${err.message}. Build continua.`);
});
