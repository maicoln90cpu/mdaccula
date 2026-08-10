import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLoadGuard } from '@/lib/adminLoadGuard';

describe('createLoadGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deixa passar chamadas dentro do limite', () => {
    const guard = createLoadGuard('test', { maxCalls: 3, windowMs: 1000 });
    expect(() => guard()).not.toThrow();
    expect(() => guard()).not.toThrow();
    expect(() => guard()).not.toThrow();
  });

  it('lança ao ultrapassar maxCalls dentro da janela', () => {
    const guard = createLoadGuard('test', { maxCalls: 3, windowMs: 1000 });
    guard();
    guard();
    guard();
    expect(() => guard()).toThrow(/loop infinito/);
  });

  it('reseta a contagem depois que a janela passa', () => {
    const guard = createLoadGuard('test', { maxCalls: 2, windowMs: 1000 });
    guard();
    guard();
    vi.advanceTimersByTime(1001);
    expect(() => guard()).not.toThrow();
  });

  it('usa os defaults (20 chamadas / 10s) quando opções não são passadas', () => {
    const guard = createLoadGuard('default-test');
    for (let i = 0; i < 20; i++) {
      expect(() => guard()).not.toThrow();
    }
    expect(() => guard()).toThrow();
  });
});
