import { describe, it, expect } from 'vitest';
import {
  getOptimizedImageUrl,
  getThumbnailUrl,
  getMediumUrl,
  handleThumbImageFallback,
} from '@/lib/imageUtils';

describe('getOptimizedImageUrl', () => {
  it("retorna '' para null/undefined", () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
  });

  it('preserva URL Bunny CDN', () => {
    const url = 'https://mdaccula.b-cdn.net/events/cover.webp';
    expect(getOptimizedImageUrl(url)).toBe(url);
  });

  it('converte URL Supabase Storage em Bunny CDN', () => {
    const supa =
      'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/abc.webp';
    expect(getOptimizedImageUrl(supa)).toBe('https://mdaccula.b-cdn.net/events/abc.webp');
  });

  it('remove parâmetros width/height/resize ao reescrever', () => {
    const supa =
      'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/abc.webp?width=400&v=1';
    const out = getOptimizedImageUrl(supa);
    expect(out).not.toMatch(/width=400/);
    expect(out).toMatch(/v=1/);
  });

  it('preserva URLs externas que não são Supabase', () => {
    expect(getOptimizedImageUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
});

describe('getThumbnailUrl', () => {
  it("retorna '' para null/undefined", () => {
    expect(getThumbnailUrl(null)).toBe('');
    expect(getThumbnailUrl(undefined)).toBe('');
  });

  it('insere -thumb antes da extensão em URL Bunny', () => {
    expect(getThumbnailUrl('https://mdaccula.b-cdn.net/events/cover.webp')).toBe(
      'https://mdaccula.b-cdn.net/events/cover-thumb.webp'
    );
  });

  it('reescreve URL Supabase para Bunny e insere -thumb', () => {
    const supa =
      'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/abc.webp';
    expect(getThumbnailUrl(supa)).toBe('https://mdaccula.b-cdn.net/events/abc-thumb.webp');
  });

  it('preserva URL sem extensão sem alteração', () => {
    const url = 'https://mdaccula.b-cdn.net/events/no-extension';
    expect(getThumbnailUrl(url)).toBe(url);
  });

  it('preserva URL externa (não Bunny/Supabase) sem alteração', () => {
    expect(getThumbnailUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
  });

  it('é idempotente — não duplica sufixo já presente', () => {
    const already = 'https://mdaccula.b-cdn.net/events/cover-thumb.webp';
    expect(getThumbnailUrl(already)).toBe(already);
  });
});

describe('getMediumUrl', () => {
  it('insere -medium antes da extensão em URL Bunny', () => {
    expect(getMediumUrl('https://mdaccula.b-cdn.net/events/cover.webp')).toBe(
      'https://mdaccula.b-cdn.net/events/cover-medium.webp'
    );
  });

  it('é idempotente — não duplica sufixo já presente', () => {
    const already = 'https://mdaccula.b-cdn.net/events/cover-medium.webp';
    expect(getMediumUrl(already)).toBe(already);
  });
});

describe('handleThumbImageFallback', () => {
  const makeEvent = (src: string) => {
    const currentTarget = { src, dataset: {} as Record<string, string> };
    return {
      currentTarget,
    } as unknown as React.SyntheticEvent<HTMLImageElement>;
  };

  it('na primeira falha, tenta a URL full antes de cair pro Supabase', () => {
    const thumbSrc = 'https://mdaccula.b-cdn.net/events/cover-thumb.webp';
    const fullSrc = 'https://mdaccula.b-cdn.net/events/cover.webp';
    const e = makeEvent(thumbSrc);

    handleThumbImageFallback(e, fullSrc);

    expect(e.currentTarget.src).toBe(fullSrc);
    expect(e.currentTarget.dataset.triedFull).toBe('true');
  });

  it('na segunda falha (já tentou full), segue pro fallback Supabase', () => {
    const fullSrc = 'https://mdaccula.b-cdn.net/events/cover.webp';
    const e = makeEvent(fullSrc);
    e.currentTarget.dataset.triedFull = 'true';

    handleThumbImageFallback(e, fullSrc);

    expect(e.currentTarget.src).toBe(
      'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/cover.webp'
    );
  });
});
