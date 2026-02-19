import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, AlertCircle, Upload } from "lucide-react";

interface ImportStep {
  table: string;
  csvFile: string;
  label: string;
  count: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
}

export default function DataImport() {
  const [steps, setSteps] = useState<ImportStep[]>([
    { table: "blog_posts", csvFile: "/import/blog_posts.csv", label: "Blog Posts (UPSERT)", count: "~113", status: "pending" },
    { table: "events", csvFile: "/import/events.csv", label: "Events", count: "~141", status: "pending" },
    { table: "custom_links", csvFile: "/import/custom_links.csv", label: "Custom Links", count: "~180", status: "pending" },
    { table: "ai_generated_posts", csvFile: "/import/ai_generated_posts.csv", label: "AI Generated Posts", count: "~117", status: "pending" },
    { table: "fix_urls", csvFile: "", label: "Corrigir URLs de imagens", count: "todas tabelas", status: "pending" },
  ]);
  const [running, setRunning] = useState(false);

  const updateStep = (index: number, update: Partial<ImportStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s));
  };

  const importTable = async (index: number) => {
    const step = steps[index];
    updateStep(index, { status: "running" });

    try {
      let csvText = "";
      if (step.csvFile) {
        const resp = await fetch(step.csvFile);
        if (!resp.ok) throw new Error(`Failed to fetch ${step.csvFile}: ${resp.status}`);
        csvText = await resp.text();
      }

      const { data, error } = await supabase.functions.invoke("import-csv-data", {
        body: step.csvFile 
          ? { table: step.table, csv: csvText }
          : { table: step.table, csv: "dummy" },
      });

      if (error) throw error;

      const resultMsg = JSON.stringify(data, null, 2);
      updateStep(index, { 
        status: data?.success === false ? "error" : "done", 
        result: resultMsg 
      });
      
      if (data?.success === false) {
        toast.error(`${step.label}: ${data.error || "Erro"}`);
      } else {
        toast.success(`${step.label}: Importado com sucesso!`);
      }
    } catch (err: any) {
      updateStep(index, { status: "error", result: err.message });
      toast.error(`${step.label}: ${err.message}`);
    }
  };

  const runAll = async () => {
    setRunning(true);
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].status === "done") continue;
      await importTable(i);
    }
    setRunning(false);
    toast.success("Importação completa!");
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Importação de Dados</h1>
      <p className="text-muted-foreground mb-6">
        Importa os CSVs de /public/import/ para o banco de dados via edge function.
        Os ai_prompt_templates já foram importados via migration.
      </p>

      <div className="space-y-4 mb-6">
        {steps.map((step, i) => (
          <Card key={step.table} className={step.status === "done" ? "border-green-500" : step.status === "error" ? "border-red-500" : ""}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {step.status === "done" && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {step.status === "running" && <Loader2 className="h-5 w-5 animate-spin" />}
                  {step.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                  {step.status === "pending" && <Upload className="h-5 w-5 text-muted-foreground" />}
                  {step.label} ({step.count})
                </CardTitle>
                <Button
                  size="sm"
                  variant={step.status === "done" ? "outline" : "default"}
                  onClick={() => importTable(i)}
                  disabled={running}
                >
                  {step.status === "done" ? "Re-importar" : "Importar"}
                </Button>
              </div>
            </CardHeader>
            {step.result && (
              <CardContent className="py-2 px-4">
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{step.result}</pre>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Button onClick={runAll} disabled={running} size="lg" className="w-full">
        {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</> : "🚀 Importar Tudo Sequencialmente"}
      </Button>
    </div>
  );
}
