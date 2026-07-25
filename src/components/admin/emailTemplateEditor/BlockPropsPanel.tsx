/**
 * Painel de propriedades por tipo de bloco.
 * Extraído de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Block } from '@/lib/emailTemplates/blocks';
import { AlignControl, ColorControl } from './controls';

export HEADER
cat /tmp/blockprops.tsx >> src/components/admin/emailTemplateEditor/BlockPropsPanel.tsx
wc -l src/components/admin/emailTemplateEditor/BlockPropsPanel.tsx
