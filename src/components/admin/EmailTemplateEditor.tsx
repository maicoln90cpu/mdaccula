/**
 * Editor de blocos para templates de e-mail (orquestrador).
 *
 * Onda 12 (slim-down): 903 → ~350 linhas. Extraído em `./emailTemplateEditor/`:
 *   - blockDefaults.ts   → configurações iniciais por tipo de bloco
 *   - typeFilter.ts      → constantes/labels/helpers do Passo 1
 *   - EditorHeader.tsx   → Passo 1 + Passo 2 + inputs de nome/assunto/preheader
 *   - BlockListPanel.tsx → coluna esquerda (DnD + adicionar + biblioteca globais)
 *   - PreviewPanel.tsx   → coluna direita (iframe preview + banners)
 *   - BlockPropsPanel + GlobalRefPropsPanel + controls (já existentes)
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { arrayMove, type DragEndEvent } from '@dnd-kit/sortable' as never as never; // placeholder replaced below

/* eslint-disable @typescript-eslint/no-unused-vars */
