import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LinkCardImage } from '@/components/links/LinkCardImage';

const BUNNY = 'https://mdaccula.b-cdn.net';
const SUPABASE_ORIGIN = 'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public';

describe('LinkCardImage', () => {
  it('mostra o ícone quando não há thumbnailUrl nem fallbackUrl', () => {
    render(<LinkCardImage thumbnailUrl={null} alt="Link" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('pede a variante thumb (não a full) quando otimizado', () => {
    render(<LinkCardImage thumbnailUrl={`${BUNNY}/link-thumbnails/foo.webp`} alt="Link" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe(`${BUNNY}/link-thumbnails/foo-thumb.webp`);
  });

  it('com skipOptimization, usa a URL crua sem rewrite', () => {
    render(<LinkCardImage thumbnailUrl="blob:local-preview" alt="Link" skipOptimization />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('blob:local-preview');
  });

  it('cadeia de fallback: thumb -> full -> Supabase -> fallbackUrl', () => {
    const thumbUrl = `${BUNNY}/link-thumbnails/foo.webp`;
    const fallbackUrl = `${BUNNY}/event-images/evento.webp`;
    render(<LinkCardImage thumbnailUrl={thumbUrl} fallbackUrl={fallbackUrl} alt="Link" />);
    const img = screen.getByRole('img') as HTMLImageElement;

    expect(img.src).toBe(`${BUNNY}/link-thumbnails/foo-thumb.webp`);

    // 1) thumb falha -> tenta full no Bunny
    fireEvent.error(img);
    expect(img.src).toBe(`${BUNNY}/link-thumbnails/foo.webp`);

    // 2) full falha -> tenta Supabase direto
    fireEvent.error(img);
    expect(img.src).toBe(`${SUPABASE_ORIGIN}/link-thumbnails/foo.webp`);

    // 3) Supabase falha -> troca pra fallbackUrl (conteúdo diferente)
    fireEvent.error(img);
    const imgAfterFallback = screen.getByRole('img') as HTMLImageElement;
    expect(imgAfterFallback.src).toBe(`${BUNNY}/event-images/evento-thumb.webp`);
  });

  it('sem fallbackUrl, esgota a cadeia sem quebrar (permanece na URL do Supabase)', () => {
    const thumbUrl = `${BUNNY}/link-thumbnails/foo.webp`;
    render(<LinkCardImage thumbnailUrl={thumbUrl} alt="Link" />);
    const img = screen.getByRole('img') as HTMLImageElement;

    fireEvent.error(img); // -> full
    fireEvent.error(img); // -> supabase
    fireEvent.error(img); // -> nada mais pra tentar, permanece

    expect(img.src).toBe(`${SUPABASE_ORIGIN}/link-thumbnails/foo.webp`);
  });
});
