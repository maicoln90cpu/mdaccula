import { linkThemes } from '@/lib/linkThemes';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ThemeSelectorProps {
  selectedTheme: string;
  onThemeSelect: (themeId: string) => void;
}

export const ThemeSelector = ({ selectedTheme, onThemeSelect }: ThemeSelectorProps) => {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-5 gap-3 mt-2">
      {Object.values(linkThemes).map((theme) => (
        <button
          key={theme.id}
          onClick={() => onThemeSelect(theme.id)}
          className={cn(
            'relative aspect-square rounded-xl transition-all hover:scale-105',
            theme.background,
            selectedTheme === theme.id && 'ring-2 ring-primary ring-offset-2'
          )}
          title={theme.name}
        >
          {selectedTheme === theme.id && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Check className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
