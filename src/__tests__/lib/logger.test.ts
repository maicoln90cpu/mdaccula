import { describe, it, expect, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  it('expõe métodos básicos', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('scope retorna logger filho', () => {
    const scoped = logger.scope({ component: 'Test' });
    expect(typeof scoped.info).toBe('function');
    expect(typeof scoped.error).toBe('function');
  });

  it('não lança ao logar erro com contexto', () => {
    expect(() => logger.error('teste', new Error('x'), { component: 'Test' })).not.toThrow();
  });
});
