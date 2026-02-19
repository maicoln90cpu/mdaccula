import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Lightbulb, Sparkles, CheckCircle2, XCircle } from "lucide-react";

interface Suggestion {
  title: string;
  summary: string;
  category: string;
  keywords?: string[];
  mood?: string;
  visualElements?: string[];
}

export interface GenerationProgress {
  current: number;
  total: number;
  currentTitle: string;
  completed: string[];
  failed: string[];
}

interface SuggestionsListProps {
  suggestions: Suggestion[];
  generateWithImage: boolean;
  isLoadingSuggestions: boolean;
  isGenerating: boolean;
  generatingIndex: number | null;
  generationProgress?: GenerationProgress | null;
  onGenerateSuggestions: () => void;
  onGenerateWithImageChange: (checked: boolean) => void;
  onGenerateFromSuggestion: (suggestion: Suggestion, index: number) => void;
  onGenerateSelected: (selected: Suggestion[]) => void;
}

export function SuggestionsList({
  suggestions,
  generateWithImage,
  isLoadingSuggestions,
  isGenerating,
  generatingIndex,
  generationProgress,
  onGenerateSuggestions,
  onGenerateWithImageChange,
  onGenerateFromSuggestion,
  onGenerateSelected,
}: SuggestionsListProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]);

  const toggleSuggestion = (index: number) => {
    setSelectedSuggestions((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const handleGenerateSelected = () => {
    const selected = selectedSuggestions.map((i) => suggestions[i]);
    onGenerateSelected(selected);
    setSelectedSuggestions([]);
  };

  return (
    <div className="space-y-6">
      {/* Progress Card - Shown during batch generation */}
      {generationProgress && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Gerando Artigos em Lote
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{generationProgress.current} de {generationProgress.total}</span>
              </div>
              <Progress 
                value={(generationProgress.current / generationProgress.total) * 100} 
                className="h-2"
              />
            </div>
            
            <p className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Gerando:</span>
              <span className="font-medium truncate">{generationProgress.currentTitle}</span>
            </p>
            
            {generationProgress.completed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Concluídos:</p>
                <div className="flex flex-wrap gap-2">
                  {generationProgress.completed.map((title, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 max-w-[200px]">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      <span className="truncate">{title.length > 30 ? title.slice(0, 30) + '...' : title}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {generationProgress.failed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Falhas:</p>
                <div className="flex flex-wrap gap-2">
                  {generationProgress.failed.map((title, i) => (
                    <Badge key={i} variant="destructive" className="gap-1 max-w-[200px]">
                      <XCircle className="h-3 w-3 shrink-0" />
                      <span className="truncate">{title.length > 30 ? title.slice(0, 30) + '...' : title}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Suggestions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Sugestões de Artigos
          </CardTitle>
          <CardDescription>
            Gere ideias de artigos automaticamente com IA baseado em tendências
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="suggestionsWithImage"
              checked={generateWithImage}
              onCheckedChange={(checked) => onGenerateWithImageChange(checked as boolean)}
              disabled={isGenerating}
            />
            <Label htmlFor="suggestionsWithImage" className="cursor-pointer">
              Gerar imagem com IA para artigos
            </Label>
          </div>

          <Button
            onClick={onGenerateSuggestions}
            disabled={isLoadingSuggestions || isGenerating}
            className="w-full"
            variant="outline"
            size="lg"
          >
            {isLoadingSuggestions ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando sugestões...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Gerar Sugestões de Artigos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {suggestions.length} Sugestões Geradas
              </CardTitle>
              {selectedSuggestions.length > 0 && !generationProgress && (
                <Button
                  onClick={handleGenerateSelected}
                  disabled={isGenerating}
                  size="sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar {selectedSuggestions.length} Selecionados
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => {
                  const isBeingGenerated = generatingIndex === index;
                  const wasCompleted = generationProgress?.completed.includes(suggestion.title);
                  const wasFailed = generationProgress?.failed.includes(suggestion.title);
                  
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-colors ${
                        isBeingGenerated
                          ? "border-primary bg-primary/10"
                          : wasCompleted
                          ? "border-green-500/50 bg-green-500/5"
                          : wasFailed
                          ? "border-destructive/50 bg-destructive/5"
                          : selectedSuggestions.includes(index)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuggestions.includes(index)}
                          onCheckedChange={() => toggleSuggestion(index)}
                          disabled={isGenerating}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isBeingGenerated && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                              {wasCompleted && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {wasFailed && (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <h4 className="font-medium leading-tight">
                                {suggestion.title}
                              </h4>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {suggestion.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.summary}
                          </p>
                          {suggestion.keywords && Array.isArray(suggestion.keywords) && suggestion.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {suggestion.keywords.map((keyword, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {typeof keyword === 'string' ? keyword : String(keyword)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {suggestion.mood && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Mood:</span> {suggestion.mood}
                            </p>
                          )}
                          <Button
                            onClick={() => onGenerateFromSuggestion(suggestion, index)}
                            disabled={isGenerating}
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                          >
                            {isBeingGenerated ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Gerando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-3 w-3" />
                                Gerar Este
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {suggestions.length === 0 && !isLoadingSuggestions && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhuma sugestão gerada ainda
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Clique no botão acima para gerar ideias de artigos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
