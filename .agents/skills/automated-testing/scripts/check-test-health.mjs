#!/usr/bin/env node
// Varre o repo por padrões ruins em arquivos de teste.
// Uso: node scripts/check-test-health.mjs [raiz]
// Saída acionável; exit 1 se encontrar problemas bloqueantes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.argv[2] || ".";
const TEST_RE = /\.(test|spec)\.(t|j)sx?$/;
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".output", ".turbo", "coverage"]);

const RULES = [
  { id: "only", re: /\b(it|describe|test)\.only\b/, level: "block", msg: ".only deixado no commit" },
  { id: "skip-no-issue", re: /\b(it|describe|test)\.skip\b(?![\s\S]{0,120}TODO\(#)/, level: "block", msg: ".skip sem TODO(#issue): owner, due" },
  { id: "tautology", re: /expect\(\s*true\s*\)\.toBe\(\s*true\s*\)/, level: "block", msg: "expect(true).toBe(true)" },
  { id: "wait-timeout", re: /waitForTimeout\s*\(/, level: "warn", msg: "waitForTimeout — substituir por waitFor/expect" },
  { id: "console-log", re: /^\s*console\.log\(/m, level: "warn", msg: "console.log esquecido" },
  { id: "math-random", re: /Math\.random\(\)/, level: "warn", msg: "Math.random sem seed em fixture" },
];

let blocking = 0;
let warnings = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (TEST_RE.test(entry)) check(p);
  }
}

function check(file) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      if (rule.re.test(line)) {
        const tag = rule.level === "block" ? "BLOCK" : "WARN ";
        console.log(`${tag} ${file}:${i + 1}  [${rule.id}] ${rule.msg}`);
        if (rule.level === "block") blocking++;
        else warnings++;
      }
    });
  }
}

walk(ROOT);

console.log(`\nResumo: ${blocking} bloqueantes, ${warnings} avisos.`);
process.exit(blocking > 0 ? 1 : 0);
