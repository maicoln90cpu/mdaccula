import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Guard estático de arquitetura.
 *
 * Garante que arquivos que consomem a tabela `events` para render PÚBLICO
 * usem a constante EVENT_PUBLIC_FIELDS, e não strings literais soltas.
 *
 * Motivo: strings literais soltas foram a causa do bug "descrição não
 * aparece no modal/slug" — alguém esqueceu uma coluna no SELECT e nada
 * avisou. Com este guard, o CI falha antes de chegar em produção.
 *
 * Custo: <1s, sem rede, sem flake.
 */

interface Guard {
  file: string;
  // Padrões PROIBIDOS dentro do arquivo (string literal em .select)
  forbidden: RegExp;
  // Padrão OBRIGATÓRIO (usa a constante)
  required: RegExp;
}

const GUARDS: Guard[] = [
  {
    file: 'src/hooks/useEvents.ts',
    forbidden: /\.from\(["']events["']\)[\s\S]{0,200}\.select\(\s*["'][^"']+["']\s*\)/,
    required: /EVENT_PUBLIC_FIELDS/,
  },
  {
    file: 'src/pages/EventDetail.tsx',
    // Aqui aceitamos select("*") pois admin/detalhe pode precisar de tudo.
    // Só proibimos string literal de COLUNAS (vírgulas) sem o uso da constante.
    forbidden: /\.from\(["']events["']\)[\s\S]{0,200}\.select\(\s*["'][a-z_]+\s*,[^"']+["']\s*\)/,
    required: /EVENT_PUBLIC_FIELDS/,
  },
];

describe('Architecture guard — SELECTs de events usam EVENT_PUBLIC_FIELDS', () => {
  for (const guard of GUARDS) {
    it(`${guard.file} usa a constante e não string literal`, () => {
      const fullPath = resolve(process.cwd(), guard.file);
      const content = readFileSync(fullPath, 'utf-8');

      expect(
        guard.required.test(content),
        `Arquivo ${guard.file} deve importar/usar EVENT_PUBLIC_FIELDS`
      ).toBe(true);

      expect(
        guard.forbidden.test(content),
        `Arquivo ${guard.file} contém .from("events").select("...colunas...") em vez de EVENT_PUBLIC_FIELDS. ` +
          `Centralize os campos em src/lib/eventSelectFields.ts para evitar regressão do bug do modal/slug vazio.`
      ).toBe(false);
    });
  }
});
