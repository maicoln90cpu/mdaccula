import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  required_fields: string[];
  category: string;
}

interface GenerateFormProps {
  templates: PromptTemplate[];
  selectedTemplate: PromptTemplate | null;
  formData: Record<string, string>;
  generateWithImage: boolean;
  isGenerating: boolean;
  onTemplateChange: (templateId: string) => void;
  onFormDataChange: (field: string, value: string) => void;
  onGenerateWithImageChange: (checked: boolean) => void;
  onGenerate: () => void;
  getFieldLabel: (field: string) => string;
}

export function GenerateForm({
  templates,
  selectedTemplate,
  formData,
  generateWithImage,
  isGenerating,
  onTemplateChange,
  onFormDataChange,
  onGenerateWithImageChange,
  onGenerate,
  getFieldLabel,
}: GenerateFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Gerar Novo Artigo
        </CardTitle>
        <CardDescription>
          Selecione um template e preencha os campos para gerar conteúdo com IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Selector */}
        <div className="space-y-2">
          <Label htmlFor="template">Template de Geração</Label>
          <Select
            value={selectedTemplate?.id || ""}
            onValueChange={onTemplateChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col items-start">
                    <span>{template.name}</span>
                    {template.category && (
                      <span className="text-xs text-muted-foreground">
                        {template.category}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate?.description && (
            <p className="text-sm text-muted-foreground">
              {selectedTemplate.description}
            </p>
          )}
        </div>

        {/* Dynamic Fields */}
        {selectedTemplate && selectedTemplate.required_fields.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Campos do Template</h4>
            {selectedTemplate.required_fields.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{getFieldLabel(field)}</Label>
                <Input
                  id={field}
                  value={formData[field] || ""}
                  onChange={(e) => onFormDataChange(field, e.target.value)}
                  placeholder={`Digite ${getFieldLabel(field).toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Image Generation Checkbox */}
        <div className="flex items-center space-x-2 pt-4 border-t">
          <Checkbox
            id="generateWithImage"
            checked={generateWithImage}
            onCheckedChange={(checked) => onGenerateWithImageChange(checked as boolean)}
          />
          <Label htmlFor="generateWithImage" className="cursor-pointer">
            Gerar imagem com IA para o artigo
          </Label>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !selectedTemplate}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando artigo...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Artigo
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
