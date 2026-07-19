import { describe, it, expect } from 'vitest';
import { formatCount, formatDateTimeBR, formatDateBR } from '@/lib/formatters';

describe('formatCount', () => {
  it('formata inteiros com separador pt-BR', () => {
    expect(formatCount(1234)).toBe('1.234');
    expect(formatCount(1000000)).toBe('1.000.000');
    expect(formatCount(0)).toBe('0');
  });

  it("retorna '—' para null/undefined", () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(undefined)).toBe('—');
  });
});

describe('formatDateTimeBR', () => {
  it("retorna '—' para valores vazios", () => {
    expect(formatDateTimeBR(null)).toBe('—');
    expect(formatDateTimeBR(undefined)).toBe('—');
    expect(formatDateTimeBR('')).toBe('—');
  });

  it('formata ISO válido em pt-BR (data + hora)', () => {
    const out = formatDateTimeBR('2026-07-13T15:30:00Z');
    // Contém dd/mm/aaaa e hh:mm — não fixamos hora exata (depende do TZ do runner).
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it('aceita Date e number', () => {
    expect(formatDateTimeBR(new Date('2026-07-13T00:00:00Z'))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatDateTimeBR(Date.UTC(2026, 6, 13))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('não quebra em datas inválidas (retorna a string original)', () => {
    expect(formatDateTimeBR('abc')).toBe('abc');
    expect(formatDateTimeBR('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateBR', () => {
  it("retorna '—' para vazios", () => {
    expect(formatDateBR(null)).toBe('—');
    expect(formatDateBR('')).toBe('—');
  });

  it('formata só a data em pt-BR', () => {
    const out = formatDateBR('2026-07-13T15:30:00Z');
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('fallback em inválido', () => {
    expect(formatDateBR('abc')).toBe('abc');
  });
});
