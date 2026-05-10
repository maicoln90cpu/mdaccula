/**
 * Validação de variáveis de ambiente em tempo de inicialização.
 * Falha rápido (fail-fast) se uma env crítica estiver ausente, evitando
 * comportamento errático em runtime.
 */

const REQUIRED_ENVS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
] as const;

type RequiredEnv = (typeof REQUIRED_ENVS)[number];

export interface EnvCheckResult {
  ok: boolean;
  missing: RequiredEnv[];
}

export function checkEnv(env: Record<string, unknown> = import.meta.env): EnvCheckResult {
  const missing = REQUIRED_ENVS.filter((k) => {
    const v = env[k];
    return v === undefined || v === null || v === "";
  });
  return { ok: missing.length === 0, missing };
}

/**
 * Lança erro se alguma env obrigatória estiver ausente.
 * Use no boot da app (main.tsx) para garantir fail-fast.
 */
export function assertEnv(env: Record<string, unknown> = import.meta.env): void {
  const { ok, missing } = checkEnv(env);
  if (!ok) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(", ")}. ` +
        `Configure-as antes de iniciar o app.`
    );
  }
}
