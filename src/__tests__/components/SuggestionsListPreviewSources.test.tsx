import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionsList } from '@/components/admin/ai-content/SuggestionsList';

/**
 * Regressão: o admin não tinha como saber, antes de gerar o artigo, quais
 * páginas a busca aberta na web (Firecrawl) retornaria para o termo de uma
 * sugestão — isso só aparecia depois, misturado ao artigo já publicado,
 * o que levou a casos como "DJ Chus" citando a Wikipédia e "Anna de Lucc"
 * citando uma página de filme sem que o admin pudesse checar antes.
 */

const baseSuggestion = {
  title: 'DJ Chus retorna ao Brasil em 2026',
  summary: 'Resumo qualquer',
  category: 'Cena',
  searchQuery: 'DJ Chus turnê Brasil 2026',
};

function renderList(onPreviewSources = vi.fn()) {
  render(
    <SuggestionsList
      suggestions={[baseSuggestion]}
      generateWithImage={false}
      isLoadingSuggestions={false}
      isGenerating={false}
      generatingIndex={null}
      generationProgress={null}
      onGenerateSuggestions={vi.fn()}
      onGenerateWithImageChange={vi.fn()}
      onGenerateFromSuggestion={vi.fn()}
      onGenerateSelected={vi.fn()}
      onPreviewSources={onPreviewSources}
    />
  );
  return onPreviewSources;
}

describe('SuggestionsList — botão "Ver fontes"', () => {
  it('mostra o botão quando a sugestão tem searchQuery e onPreviewSources é passado', () => {
    renderList();
    expect(screen.getByText('Ver fontes')).toBeInTheDocument();
  });

  it('chama onPreviewSources com a sugestão ao clicar', () => {
    const onPreviewSources = renderList();
    fireEvent.click(screen.getByText('Ver fontes'));
    expect(onPreviewSources).toHaveBeenCalledWith(baseSuggestion);
  });

  it('não mostra o botão quando a sugestão não tem searchQuery', () => {
    const onPreviewSources = vi.fn();
    render(
      <SuggestionsList
        suggestions={[{ ...baseSuggestion, searchQuery: undefined }]}
        generateWithImage={false}
        isLoadingSuggestions={false}
        isGenerating={false}
        generatingIndex={null}
        generationProgress={null}
        onGenerateSuggestions={vi.fn()}
        onGenerateWithImageChange={vi.fn()}
        onGenerateFromSuggestion={vi.fn()}
        onGenerateSelected={vi.fn()}
        onPreviewSources={onPreviewSources}
      />
    );
    expect(screen.queryByText('Ver fontes')).not.toBeInTheDocument();
  });

  it('não mostra o botão quando onPreviewSources não é passado (retrocompatível)', () => {
    render(
      <SuggestionsList
        suggestions={[baseSuggestion]}
        generateWithImage={false}
        isLoadingSuggestions={false}
        isGenerating={false}
        generatingIndex={null}
        generationProgress={null}
        onGenerateSuggestions={vi.fn()}
        onGenerateWithImageChange={vi.fn()}
        onGenerateFromSuggestion={vi.fn()}
        onGenerateSelected={vi.fn()}
      />
    );
    expect(screen.queryByText('Ver fontes')).not.toBeInTheDocument();
  });
});
