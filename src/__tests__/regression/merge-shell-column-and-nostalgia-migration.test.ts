/**
 * Regressão — a coluna `is_merge_shell` e a conversão do merge "Nostalgia"
 * pro modelo não-destrutivo precisam continuar existindo nas migrations,
 * senão a Fase 1 do redesenho de mesclagem (ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md)
 * nunca chegou a valer no banco.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function allMigrationsText(): string {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
    .join('\n');
}

describe('Migration — events.is_merge_shell existe e o merge "Nostalgia" foi convertido', () => {
  it('alguma migration adiciona a coluna is_merge_shell em events, com default false', () => {
    const all = allMigrationsText();
    expect(all).toMatch(/ADD COLUMN is_merge_shell BOOLEAN NOT NULL DEFAULT false/i);
  });

  it('alguma migration converte o card do merge "Nostalgia" pro novo modelo', () => {
    const all = allMigrationsText();
    expect(all).toMatch(/is_merge_shell\s*=\s*true/i);
    expect(all).toMatch(/bece84f6-371a-4a32-9444-253fae204037/i);
  });
});
