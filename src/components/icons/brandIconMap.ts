import { Instagram, Facebook, Twitter, Linkedin, Youtube } from './brand';

/**
 * Nome normalizado (minúsculo, sem espaços) -> componente do ícone de marca.
 * Fica em arquivo separado de `brand.tsx` para não quebrar o fast refresh do Vite.
 */
export const brandIconMap = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
} as const;
