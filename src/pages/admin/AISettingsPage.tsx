import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { NavLink } from 'react-router-dom';
import AISettings from '@/components/admin/settings/AISettings';
import { DEFAULT_IMAGE_PROMPT } from '@/components/admin/settings/aiSettingsConstants';

const AISettingsPage = () => {
  const [aiModel, setAiModel] = useState('google/gemini-2.5-flash');
  const [aiTemperature, setAiTemperature] = useState(0.9);
  const [aiImagePrompt, setAiImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [aiHistoryLimit, setAiHistoryLimit] = useState(15);
  const [aiMaxArticleLength, setAiMaxArticleLength] = useState(5000);
  const [aiMaxScrapeSources, setAiMaxScrapeSources] = useState(3);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('key, value');

      if (error) throw error;

      data?.forEach((setting) => {
        switch (setting.key) {
          case 'ai_blog_model':
            setAiModel(setting.value || 'google/gemini-2.5-flash');
            break;
          case 'ai_temperature':
            setAiTemperature(parseFloat(setting.value || '0.9'));
            break;
          case 'ai_image_prompt_template':
            setAiImagePrompt(setting.value || DEFAULT_IMAGE_PROMPT);
            break;
          case 'ai_history_limit':
            setAiHistoryLimit(parseInt(setting.value || '15'));
            break;
          case 'ai_max_article_length':
            setAiMaxArticleLength(parseInt(setting.value || '5000'));
            break;
          case 'ai_max_scrape_sources':
            setAiMaxScrapeSources(parseInt(setting.value || '3'));
            break;
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[AISettingsPage] Erro ao carregar configurações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'ai_blog_model', value: aiModel },
        { key: 'ai_temperature', value: aiTemperature.toString() },
        { key: 'ai_image_prompt_template', value: aiImagePrompt },
        { key: 'ai_history_limit', value: aiHistoryLimit.toString() },
        { key: 'ai_max_article_length', value: aiMaxArticleLength.toString() },
        { key: 'ai_max_scrape_sources', value: aiMaxScrapeSources.toString() },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações de IA foram atualizadas com sucesso.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="w-full">
          <div className="mb-6 sm:mb-8">
            <NavLink
              to="/admin"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Painel
            </NavLink>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold hero-text">
              Configuração de IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modelo, temperatura, prompt de imagem e limites de geração de conteúdo por IA.
            </p>
          </div>

          <AISettings
            aiModel={aiModel}
            setAiModel={setAiModel}
            aiTemperature={aiTemperature}
            setAiTemperature={setAiTemperature}
            aiImagePrompt={aiImagePrompt}
            setAiImagePrompt={setAiImagePrompt}
            aiHistoryLimit={aiHistoryLimit}
            setAiHistoryLimit={setAiHistoryLimit}
            aiMaxArticleLength={aiMaxArticleLength}
            setAiMaxArticleLength={setAiMaxArticleLength}
            aiMaxScrapeSources={aiMaxScrapeSources}
            setAiMaxScrapeSources={setAiMaxScrapeSources}
          />

          <div className="mt-6">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações de IA'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AISettingsPage;
