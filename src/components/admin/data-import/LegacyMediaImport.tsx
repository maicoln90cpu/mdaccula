import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

const LegacyMediaImport = () => {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, any> | null>(null);
  const { toast } = useToast();

  const handleImportStorage = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-storage");
      if (error) throw error;
      setImportResult(data);
      toast({
        title: data.complete ? "Importação completa!" : "Lote processado",
        description: data.message,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: error.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border-blue-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-500" />
          <CardTitle className="text-lg sm:text-xl">Mídia Legada — Importar do Projeto Antigo</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Importa imagens do storage do projeto Supabase anterior (complementa a importação de registros CSV acima)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Processa até 30 arquivos por execução. Clique várias vezes até completar.
        </p>
        <Button onClick={handleImportStorage} disabled={importing} className="w-full" variant="outline">
          {importing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
          ) : (
            <><Download className="w-4 h-4 mr-2" />Importar Arquivos</>
          )}
        </Button>

        {importResult && (
          <div className={`p-4 rounded-lg border space-y-2 text-xs ${importResult.complete ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"}`}>
            <p className={`text-sm font-medium ${importResult.complete ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
              {importResult.complete ? "✅ Completo!" : "⏳ Execute novamente"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>Total: <strong>{importResult.totalFiles}</strong></div>
              <div>Importados: <strong>{importResult.imported}</strong></div>
              <div>Existentes: <strong>{importResult.skipped}</strong></div>
              <div>Erros: <strong>{importResult.errors}</strong></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LegacyMediaImport;
