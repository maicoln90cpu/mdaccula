import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Ícones de marca desenhados no projeto.
 *
 * Por que existem: a partir do `lucide-react` v1 a biblioteca removeu todos os
 * ícones de marca (Instagram, Facebook, Twitter/X, LinkedIn, YouTube) por
 * questões de licenciamento. Como esses ícones aparecem nos cards da página
 * /links (onde o nome vem do banco de dados), no rodapé e nos botões de
 * compartilhamento, mantemos cópias locais com o MESMO traço visual do Lucide
 * (24x24, stroke 2, currentColor) e a MESMA API de props.
 *
 * Não remover sem antes conferir `StaticIcon`, `DynamicIcon`, `SocialIcons`,
 * `ShareButtons` e o rodapé.
 */

type BrandIconProps = Omit<LucideProps, 'ref'>;

const createBrandIcon = (displayName: string, children: React.ReactNode) => {
  const Icon = forwardRef<SVGSVGElement, BrandIconProps>(
    ({ color = 'currentColor', size = 24, strokeWidth = 2, absoluteStrokeWidth, ...rest }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={
          absoluteStrokeWidth
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {children}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon;
};

export const Instagram = createBrandIcon(
  'Instagram',
  <>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </>
);

export const Facebook = createBrandIcon(
  'Facebook',
  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
);

export const Twitter = createBrandIcon(
  'Twitter',
  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
);

export const Linkedin = createBrandIcon(
  'Linkedin',
  <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </>
);

export const Youtube = createBrandIcon(
  'Youtube',
  <>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <path d="m10 15 5-3-5-3z" />
  </>
);
