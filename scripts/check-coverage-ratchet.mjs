#!/usr/bin/env node
/**
 * Coverage ratchet: cobertura só pode subir, nunca cair.
 *
 * Como funciona:
 *  1. Lê `coverage/coverage-summary.json` (gerado por vitest com --coverage).
 *  2. Compara com baseline em `.coverage-ratchet.json` (versionado).
 *  3. Se cobertura caiu em qualquer métrica, sai com código 1 (CI falha).
 *  4. Se cobertura subiu, atualiza a baseline.
 *
 * Margem de tolerância: 0.5 ponto percentual (evita flutuações de ponto flutuante).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SUMMARY_PATH = resolve(process.cwd(), 'coverage/coverage-summary.json');
const RATCHET_PATH = resolve(process.cwd(), '.coverage-ratchet.json');
const TOLERANCE = 0.5;
const METRICS = ['lines', 'statements', 'functions', 'branches'];

if (!existsSync(SUMMARY_PATH)) {
  console.error(`[ratchet] ${SUMMARY_PATH} não encontrado. Rode "vitest run --coverage" antes.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf-8'));
const current = Object.fromEntries(
  METRICS.map((m) => [m, Number(summary.total?.[m]?.pct ?? 0)]),
);

const previous = existsSync(RATCHET_PATH)
  ? JSON.parse(readFileSync(RATCHET_PATH, 'utf-8'))
  : null;

if (!previous) {
  writeFileSync(RATCHET_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log('[ratchet] Baseline inicial gravada em .coverage-ratchet.json:');
  console.log(current);
  process.exit(0);
}

const regressions = [];
const improvements = [];
const next = { ...previous };

for (const metric of METRICS) {
  const prev = Number(previous[metric] ?? 0);
  const cur = current[metric];
  if (cur + TOLERANCE < prev) {
    regressions.push({ metric, prev, cur, delta: (cur - prev).toFixed(2) });
  } else if (cur > prev) {
    improvements.push({ metric, prev, cur });
    next[metric] = cur;
  }
}

if (regressions.length > 0) {
  console.error('[ratchet] ❌ Cobertura caiu — bloqueando build:');
  for (const r of regressions) {
    console.error(`  - ${r.metric}: ${r.prev}% → ${r.cur}% (${r.delta}pp)`);
  }
  console.error('\nAdicione testes para restaurar a cobertura antes de mergear.');
  process.exit(1);
}

if (improvements.length > 0) {
  writeFileSync(RATCHET_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log('[ratchet] ✅ Cobertura subiu — baseline atualizada:');
  for (const i of improvements) {
    console.log(`  - ${i.metric}: ${i.prev}% → ${i.cur}%`);
  }
} else {
  console.log('[ratchet] ✅ Cobertura mantida.');
}
