#!/usr/bin/env node
/**
 * Opção B — Fallback local de deploy de Edge Functions.
 *
 * O deployer do Lovable tem um bug: não empacota `supabase/functions/_shared/`
 * junto com a função que importa dele. Esse script contorna o problema
 * inlinando todos os imports de `_shared/` diretamente no `index.ts` da
 * função, usando esbuild. Os imports externos do Deno (`npm:*`, `jsr:*`,
 * `https://...`, `node:*`) são preservados intactos.
 *
 * Fluxo de uso:
 *   1. `npm run edge:bundle:apply`   → gera `index.bundled.ts` em cada função e
 *                                      faz swap com o `index.ts` original
 *                                      (o original é preservado em `index.original.ts`).
 *   2. Peça ao agente Lovable para rodar `supabase--deploy_edge_functions`
 *      passando a lista de funções afetadas.
 *   3. `npm run edge:bundle:restore` → restaura os `index.ts` originais.
 *
 * IMPORTANTE: os arquivos gerados (`index.bundled.ts`, `index.original.ts`)
 * estão no `.gitignore`. Nunca commite eles. Nunca deixe o repositório em
 * estado "applied" — sempre rode restore antes de commitar. Se a Opção C
 * (GitHub Actions) estiver funcionando, prefira ela: este script é fallback.
 */

import { build } from "esbuild";
import { readFile, writeFile, rename, access, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");

// Lista das funções que importam de _shared/ e precisam de bundle manual.
// Se adicionar novas, incluir aqui. Um TODO futuro é auto-detectar via grep.
const FUNCTIONS_WITH_SHARED = [
  "blog-digest-draft",
  "create-event-email-campaign",
  "generate-blog-post-from-topic",
  "generate-blog-post-v2",
  "generate-multi-event-article",
  "scan-event-sources",
  "send-mass-newsletter",
  "send-scheduled-email-campaigns",
  "weekend-agenda-draft",
  "weekly-digest-draft",
];

// Padrões que o esbuild NÃO deve tentar resolver — o Deno resolve em runtime.
const EXTERNAL_PATTERNS = [
  "npm:*",
  "jsr:*",
  "node:*",
  "https://*",
  "http://*",
];

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function bundleOne(name) {
  const dir = join(FUNCTIONS_DIR, name);
  const entry = join(dir, "index.ts");
  const bundled = join(dir, "index.bundled.ts");

  if (!(await fileExists(entry))) {
    console.warn(`  ⚠️  ${name}: index.ts não encontrado, pulando.`);
    return false;
  }

  await build({
    entryPoints: [entry],
    outfile: bundled,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "esnext",
    external: EXTERNAL_PATTERNS,
    logLevel: "warning",
    // Preserva sintaxe compatível com Deno; não minifica pra não atrapalhar debug.
    minify: false,
  });

  const size = (await readFile(bundled, "utf8")).length;
  console.log(`  ✅ ${name}: ${(size / 1024).toFixed(1)} KB`);
  return true;
}

async function applyOne(name) {
  const dir = join(FUNCTIONS_DIR, name);
  const original = join(dir, "index.ts");
  const backup = join(dir, "index.original.ts");
  const bundled = join(dir, "index.bundled.ts");

  if (!(await fileExists(bundled))) {
    console.warn(`  ⚠️  ${name}: index.bundled.ts não existe. Rode o bundle primeiro.`);
    return false;
  }
  if (await fileExists(backup)) {
    console.warn(`  ⚠️  ${name}: index.original.ts JÁ existe. O apply parece já ter sido feito. Pulando pra não sobrescrever o original.`);
    return false;
  }
  await rename(original, backup);
  await rename(bundled, original);
  console.log(`  🔀 ${name}: swap aplicado (index.ts agora é a versão bundled).`);
  return true;
}

async function restoreOne(name) {
  const dir = join(FUNCTIONS_DIR, name);
  const original = join(dir, "index.ts");
  const backup = join(dir, "index.original.ts");

  if (!(await fileExists(backup))) {
    console.log(`  ⏭️  ${name}: sem index.original.ts (não estava em modo bundled).`);
    return false;
  }
  // Renomeia o bundled atual pra .bundled.ts (pode ser útil pra debug) e restaura o original.
  const bundledArchive = join(dir, "index.bundled.ts");
  await rename(original, bundledArchive);
  await rename(backup, original);
  console.log(`  ↩️  ${name}: restaurado.`);
  return true;
}

async function main() {
  const mode = process.argv[2] || "bundle";
  const validModes = ["bundle", "apply", "restore", "status"];
  if (!validModes.includes(mode)) {
    console.error(`Modo inválido: ${mode}. Use um de: ${validModes.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🛠️  Opção B — modo: ${mode}\n`);
  console.log(`Funções alvo (${FUNCTIONS_WITH_SHARED.length}):`);
  FUNCTIONS_WITH_SHARED.forEach((n) => console.log(`  - ${n}`));
  console.log("");

  let ok = 0, fail = 0;
  for (const name of FUNCTIONS_WITH_SHARED) {
    try {
      if (mode === "bundle") {
        if (await bundleOne(name)) ok++; else fail++;
      } else if (mode === "apply") {
        if (await applyOne(name)) ok++; else fail++;
      } else if (mode === "restore") {
        if (await restoreOne(name)) ok++; else fail++;
      } else if (mode === "status") {
        const dir = join(FUNCTIONS_DIR, name);
        const hasBackup = await fileExists(join(dir, "index.original.ts"));
        const hasBundled = await fileExists(join(dir, "index.bundled.ts"));
        console.log(`  ${name}: ${hasBackup ? "🔀 APPLIED" : "✅ normal"}${hasBundled ? " (bundle em cache)" : ""}`);
        ok++;
      }
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      fail++;
    }
  }

  console.log(`\nResultado: ${ok} ok, ${fail} falhas.\n`);
  if (mode === "apply") {
    console.log("👉 Próximo passo: peça ao agente para rodar `supabase--deploy_edge_functions` com a lista acima.");
    console.log("👉 Depois do deploy: rode `npm run edge:bundle:restore` pra deixar o repo limpo.\n");
  }
  if (mode === "bundle") {
    console.log("👉 Próximo passo: `npm run edge:bundle:apply` pra fazer o swap e habilitar o deploy.\n");
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
