import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getQualityMetrics, TECH_DEBT_ITEMS, type QualityMetric } from '@/lib/qualityMetrics';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bug,
  ShieldCheck,
  Gauge,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// Tipos e dados agora vêm de @/lib/qualityMetrics (dinâmicos)


const SeverityBadge = ({ severity }: { severity: string }) => {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    low: { variant: 'outline', label: 'Baixa' },
    medium: { variant: 'secondary', label: 'Média' },
    high: { variant: 'default', label: 'Alta' },
    critical: { variant: 'destructive', label: 'Crítica' },
  };

  return <Badge variant={config[severity]?.variant || 'outline'}>{config[severity]?.label || severity}</Badge>;
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'good':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'critical':
      return <Bug className="w-4 h-4 text-red-500" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
};

const TrendIcon = ({ trend }: { trend?: string }) => {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return null;
};

export const TechDebtDashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const QUALITY_METRICS = useMemo(() => getQualityMetrics(), []);

  const overallScore = Math.round(
    QUALITY_METRICS.reduce((acc, m) => acc + (m.score / m.maxScore) * 100, 0) / QUALITY_METRICS.length
  );

  const categories = ['all', ...new Set(TECH_DEBT_ITEMS.map((item) => item.category))];

  const filteredDebt =
    selectedCategory === 'all'
      ? TECH_DEBT_ITEMS
      : TECH_DEBT_ITEMS.filter((item) => item.category === selectedCategory);

  const totalEffort = TECH_DEBT_ITEMS.reduce((acc, item) => {
    const hours = parseInt(item.effort.replace('h', ''));
    return acc + hours;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="w-5 h-5" />
          Qualidade Técnica & Tech Debt
        </CardTitle>
        <CardDescription>Métricas de qualidade e dívidas técnicas pendentes</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="metrics">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metrics">Métricas de Qualidade</TabsTrigger>
            <TabsTrigger value="debt">Tech Debt ({TECH_DEBT_ITEMS.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6 mt-6">
            {/* Overall Score */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Score Geral de Qualidade</div>
                <div className="text-3xl font-bold">{overallScore}%</div>
              </div>
              <div
                className={`p-4 rounded-full ${
                  overallScore >= 80
                    ? 'bg-green-500/20'
                    : overallScore >= 60
                      ? 'bg-yellow-500/20'
                      : 'bg-red-500/20'
                }`}
              >
                {overallScore >= 80 ? (
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                ) : overallScore >= 60 ? (
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                ) : (
                  <Bug className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            {/* Individual Metrics */}
            <div className="space-y-4">
              {QUALITY_METRICS.map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={metric.status} />
                      <span className="font-medium">{metric.name}</span>
                      <TrendIcon trend={metric.trend} />
                    </div>
                    <span className="text-sm font-medium">
                      {metric.score}/{metric.maxScore}
                    </span>
                  </div>
                  <Progress
                    value={(metric.score / metric.maxScore) * 100}
                    className={`h-2 ${
                      metric.status === 'good'
                        ? '[&>div]:bg-green-500'
                        : metric.status === 'warning'
                          ? '[&>div]:bg-yellow-500'
                          : '[&>div]:bg-red-500'
                    }`}
                  />
                  <p className="text-xs text-muted-foreground">{metric.description}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="debt" className="space-y-6 mt-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-accent/50 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {TECH_DEBT_ITEMS.filter((i) => i.severity === 'critical' || i.severity === 'high').length}
                </div>
                <div className="text-xs text-muted-foreground">Alta Prioridade</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/50 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {TECH_DEBT_ITEMS.filter((i) => i.severity === 'medium').length}
                </div>
                <div className="text-xs text-muted-foreground">Média Prioridade</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/50 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {TECH_DEBT_ITEMS.filter((i) => i.severity === 'low').length}
                </div>
                <div className="text-xs text-muted-foreground">Baixa Prioridade</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/50 text-center">
                <div className="text-2xl font-bold">{totalEffort}h</div>
                <div className="text-xs text-muted-foreground">Esforço Total</div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </Badge>
              ))}
            </div>

            {/* Debt Items */}
            <div className="space-y-3">
              {filteredDebt.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={item.severity} />
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                    </div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium">{item.effort}</div>
                    <div className="text-xs text-muted-foreground">esforço</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TechDebtDashboard;
