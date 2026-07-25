/**
 * SendOnCronToggle — switch reutilizado pelos 3 cards de automação.
 * Extraído de AutomationsTab (Onda 11) sem alterações de comportamento.
 */
import { Switch } from '@/components/ui/switch';

export const SendOnCronToggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <div className="flex items-center justify-between rounded-lg border border-border p-3">
    <div className="text-sm">
      {label}
      <p className="text-xs text-muted-foreground">
        Quando ON, o cron envia direto. Quando OFF, só cria rascunho.
      </p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
