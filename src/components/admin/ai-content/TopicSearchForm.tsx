import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";

interface TopicSearchFormProps {
  topicQuery: string;
  generateWithImage: boolean;
  isGenerating: boolean;
  onTopicQueryChange: (value: string) => void;
  onGenerateWithImageChange: (checked: boolean) => void;
  onGenerate: () => void;
}

export function TopicSearchForm({
  topicQuery,
  generateWithImage,
  isGenerating,
  onTopicQueryChange,
  onGenerateWithImageChange,
  onGenerate,
}: TopicSearchFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Gerar por Tema
        </CardTitle>
        <CardDescription>
          Digite um termo (ex: "Solomun São Paulo") — o sistema busca fontes reais na web via
          Firecrawl e escreve um artigo baseado exclusivamente no que encontrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="topicQuery">Termo de busca</Label>
          <Input
            id="topicQuery"
            value={topicQuery}
            onChange={(e) => onTopicQueryChange(e.target.value)}
            placeholder='ex: "Solomun São Paulo"'
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isGenerating && topicQuery.trim()) {
                onGenerate();
              }
            }}
          />
        </div>

        <div className="flex items-center space-x-2 pt-4 border-t">
          <Checkbox
            id="generateWithImageTopic"
            checked={generateWithImage}
            onCheckedChange={(checked) => onGenerateWithImageChange(checked as boolean)}
          />
          <Label htmlFor="generateWithImageTopic" className="cursor-pointer">
            Gerar imagem com IA para o artigo
          </Label>
        </div>

        <Button
          onClick={onGenerate}
          disabled={isGenerating || !topicQuery.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando fontes e gerando artigo...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar e Gerar Artigo
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
