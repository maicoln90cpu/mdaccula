import { describe, it, expect } from 'vitest';
import { checkEnv, assertEnv } from '@/lib/assertEnv';

describe('assertEnv', () => {
  const fullEnv = {
    VITE_SUPABASE_URL: 'https://x.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'abc',
    VITE_SUPABASE_PROJECT_ID: 'xfvpuzlspvvsmmunznxw',
  };

  it('checkEnv ok quando todas presentes', () => {
    expect(checkEnv(fullEnv)).toEqual({ ok: true, missing: [] });
  });

  it('checkEnv lista ausentes', () => {
    const r = checkEnv({ ...fullEnv, VITE_SUPABASE_URL: '' });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('VITE_SUPABASE_URL');
  });

  it('assertEnv lança quando ausente', () => {
    expect(() => assertEnv({})).toThrow(/Variáveis de ambiente ausentes/);
  });

  it('assertEnv não lança quando completo', () => {
    expect(() => assertEnv(fullEnv)).not.toThrow();
  });
});
