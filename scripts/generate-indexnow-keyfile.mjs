#!/usr/bin/env node
/**
 * Gera public/<chave>.txt buscando a chave IndexNow da edge function
 * indexnow-notify (GET). Tolerante a falhas — não quebra o build.
 *
 * Limpa arquivos .txt de chaves antigas em public/ para evitar lixo.
 */
import { writeFileSync, readdirSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
const PROJECT_ID = env.VITE_SUPABASE_PROJECT_ID || "xfvpuzlspvvsmmunznxw";
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const URL = `https://${PROJECT_ID}.supabase.co/functions/v1/indexnow-notify`;

async function main() {
  if (!ANON_KEY) {
    console.warn("[indexnow-key] VITE_SUPABASE_PUBLISHABLE_KEY ausente, pulando.");
    return;
  }

  let key = "";
  try {
    const res = await fetch(URL, {
      method: "GET",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    key = (await res.text()).trim();
  } catch (err) {
    console.warn(`[indexnow-key] aviso: não foi possível obter chave (${err.message}).`);
    return;
  }

  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    console.warn(`[indexnow-key] chave inválida recebida (len=${key.length}). Pulando.`);
    return;
  }

  const targetName = `${key}.txt`;
  const publicDir = resolve("public");

  // Remover arquivos de chave antigos (formato hexadecimal/alfanumérico .txt
  // de 16+ chars, evita apagar robots.txt etc.)
  for (const f of readdirSync(publicDir)) {
    if (f === targetName) continue;
    if (/^[A-Za-z0-9-]{16,128}\.txt$/.test(f)) {
      try {
        unlinkSync(resolve(publicDir, f));
        console.log(`[indexnow-key] removido arquivo antigo: ${f}`);
      } catch {}
    }
  }

  writeFileSync(resolve(publicDir, targetName), key);
  console.log(`[indexnow-key] arquivo de verificação gerado: public/${targetName}`);
}

main().catch((err) => {
  console.warn(`[indexnow-key] erro inesperado: ${err.message}. Build continua.`);
});
