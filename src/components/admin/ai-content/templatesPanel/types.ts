import type { Json } from '@/integrations/supabase/types';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  user_prompt_template: string;
  required_fields: Json;
  is_default: boolean | null;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateFormData {
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  required_fields: Record<string, boolean>;
  enabled: boolean;
}

export const EMPTY_FORM: TemplateFormData = {
  name: '',
  description: '',
  category: 'Eventos',
  system_prompt: '',
  user_prompt_template: '',
  required_fields: {},
  enabled: true,
};

// Normaliza required_fields aceitando tanto formato antigo (array) quanto novo (objeto).
export const normalizeRequiredFields = (fields: unknown): Record<string, boolean> => {
  if (!fields) return {};
  if (typeof fields === 'object' && !Array.isArray(fields)) {
    return fields as Record<string, boolean>;
  }
  if (Array.isArray(fields)) {
    return fields.reduce(
      (acc, field) => {
        if (typeof field === 'string') acc[field] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }
  return {};
};
