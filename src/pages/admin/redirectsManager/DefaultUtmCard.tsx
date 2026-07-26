/**
 * DefaultUtmCard — configuração dos valores padrão de utm_source/medium.
 * Extraído na Onda 11 sem alterações de comportamento.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2 } from 'lucide-react';
import { UTM_SOURCE_OPTIONS, UTM_MEDIUM_OPTIONS } from './types';

interface DefaultUtmCardProps {
  defaultSource: string;
  defaultMedium: string;
  setDefaultSource: (v: string) => void;
  setDefaultMedium: (v: string) => void;
}

export const DefaultUtmCard = ({
  defaultSource,
  defaultMedium,
  setDefaultSource,
  setDefaultMedium,
}: DefaultUtmCardProps) => (
  <Card variant="info" className="mt-6">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Settings2 className="w-4 h-4" />
        Configuração padrão de UTMs
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground mb-3">
        Defina os valores padrão que serão preenchidos ao criar novos links.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">utm_source padrão</Label>
          <Select value={defaultSource} onValueChange={setDefaultSource}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UTM_SOURCE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">utm_medium padrão</Label>
          <Select value={defaultMedium} onValueChange={setDefaultMedium}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UTM_MEDIUM_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent>
  </Card>
);
