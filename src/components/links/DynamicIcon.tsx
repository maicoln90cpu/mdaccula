import { lazy, Suspense } from 'react';
import { ExternalLink } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import type { LucideProps } from 'lucide-react';
import { brandIconMap } from '@/components/icons/brand';

interface DynamicIconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

/**
 * Dynamic icon component that loads Lucide icons on demand
 * Falls back to ExternalLink if icon is not found
 */
export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  // Ícones de marca não existem mais no lucide-react v1 — usamos os nossos.
  const brandKey = name?.toLowerCase().replace(/\s+/g, '') as keyof typeof brandIconMap;
  const BrandIcon = brandKey ? brandIconMap[brandKey] : undefined;
  if (BrandIcon) {
    return <BrandIcon {...props} />;
  }

  const iconName = name
    ?.toLowerCase()
    .replace(/([A-Z])/g, (match, p1, offset) =>
      offset > 0 ? `-${p1.toLowerCase()}` : p1.toLowerCase()
    ) as keyof typeof dynamicIconImports;

  if (!iconName || !dynamicIconImports[iconName]) {
    return <ExternalLink {...props} />;
  }

  const LucideIcon = lazy(dynamicIconImports[iconName]);

  return (
    <Suspense fallback={<div className="w-5 h-5" />}>
      <LucideIcon {...props} />
    </Suspense>
  );
};
