import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  MousePointerClick,
  Filter,
  Settings2,
  Calendar as CalendarIcon,
  CalendarDays,
  ArrowLeft,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface RedirectLink {
  id: string;
  slug: string;
  destination_url: string;
  description: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  clicks: number;
  enabled: boolean;
  created_at: string;
}

interface FormData {
  slug: string;
  destination_url: string;
  description: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

const UTM_SOURCE_OPTIONS = [
  'mdaccula',
  'instagram',
  'whatsapp',
  'facebook',
  'tiktok',
  'email',
  'google',
];
const UTM_MEDIUM_OPTIONS = ['link-curto', 'bio', 'stories', 'email', 'post', 'ads', 'qrcode'];

const RedirectsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Default UTM config
  const [defaultSource, setDefaultSource] = useState('mdaccula');
  const [defaultMedium, setDefaultMedium] = useState('link-curto');

  const emptyForm: FormData = {
    slug: '',
    destination_url: '',
    description: '',
    utm_source: defaultSource,
    utm_medium: defaultMedium,
    utm_campaign: '',
    utm_content: '',
  };

  const [form, setForm] = useState<FormData>(emptyForm);

  // Custom mode for source/medium in modal
  const [customSource, setCustomSource] = useState(false);
  const [customMedium, setCustomMedium] = useState(false);

  // Filters
  const [filterSource, setFilterSource] = useState('__all__');
  const [filterMedium, setFilterMedium] = useState('__all__');
  const [filterCampaign, setFilterCampaign] = useState('__all__');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'recent' | 'clicks'>('recent');
  const [periodLabel, setPeriodLabel] = useState<string>('Todo período');

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['redirect-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redirect_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RedirectLink[];
    },
  });

  // Realtime: invalida o cache do react-query a cada mudança em redirect_links.
  useRealtimeTable('redirect_links', () =>
    queryClient.invalidateQueries({ queryKey: ['redirect-links'] })
  );

  // Query period clicks from redirect_click_events
  const { data: periodClicks = {} } = useQuery({
    queryKey: [
      'redirect-period-clicks',
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!dateRange?.from) return {};

      let query = supabase
        .from('redirect_click_events')
        .select('redirect_link_id')
        .gte('clicked_at', dateRange.from.toISOString());

      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('clicked_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching period clicks:', error);
        return {};
      }

      // Count clicks per redirect_link_id
      const counts: Record<string, number> = {};
      data?.forEach((row) => {
        const id = row.redirect_link_id;
        counts[id] = (counts[id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!dateRange?.from,
  });

  // Derive unique UTM values for filter selects
  const uniqueSources = useMemo(
    () => [...new Set(links.map((l) => l.utm_source).filter(Boolean) as string[])].sort(),
    [links]
  );
  const uniqueMediums = useMemo(
    () => [...new Set(links.map((l) => l.utm_medium).filter(Boolean) as string[])].sort(),
    [links]
  );
  const uniqueCampaigns = useMemo(
    () => [...new Set(links.map((l) => l.utm_campaign).filter(Boolean) as string[])].sort(),
    [links]
  );

  const filteredLinks = useMemo(() => {
    const filtered = links.filter((link) => {
      if (filterSource !== '__all__' && (link.utm_source || '') !== filterSource) return false;
      if (filterMedium !== '__all__' && (link.utm_medium || '') !== filterMedium) return false;
      if (filterCampaign !== '__all__' && (link.utm_campaign || '') !== filterCampaign)
        return false;
      return true;
    });

    if (sortBy === 'clicks') {
      filtered.sort((a, b) => b.clicks - a.clicks);
    }

    return filtered;
  }, [links, filterSource, filterMedium, filterCampaign, sortBy]);

  const hasActiveFilters =
    filterSource !== '__all__' ||
    filterMedium !== '__all__' ||
    filterCampaign !== '__all__' ||
    !!dateRange?.from ||
    sortBy !== 'recent';

  const hasPeriodFilter = !!dateRange?.from;

  const handlePeriodShortcut = (label: string, from: Date | null, to: Date | null) => {
    setPeriodLabel(label);
    if (!from) {
      setDateRange(undefined);
    } else {
      setDateRange({ from, to: to || new Date() });
    }
  };

  // Normalize URL: ensure protocol prefix
  const normalizeUrl = (raw: string): string => {
    let url = raw.trim().replace(/^→\s*/, '');
    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  };

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        slug: data.slug.replace(/[^a-zA-Z0-9_-]/g, ''),
        destination_url: normalizeUrl(data.destination_url),
        description: data.description || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
      };

      if (editingId) {
        const { error } = await supabase.from('redirect_links').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('redirect_links').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirect-links'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm, utm_source: defaultSource, utm_medium: defaultMedium });
      toast({ title: editingId ? 'Link atualizado!' : 'Link criado!' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('redirect_links').update({ enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['redirect-links'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('redirect_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirect-links'] });
      toast({ title: 'Link deletado!' });
    },
  });

  const handleEdit = (link: RedirectLink) => {
    setEditingId(link.id);
    const sourceVal = link.utm_source || '';
    const mediumVal = link.utm_medium || '';
    setCustomSource(!UTM_SOURCE_OPTIONS.includes(sourceVal) && sourceVal !== '');
    setCustomMedium(!UTM_MEDIUM_OPTIONS.includes(mediumVal) && mediumVal !== '');
    setForm({
      slug: link.slug,
      destination_url: link.destination_url,
      description: link.description || '',
      utm_source: sourceVal,
      utm_medium: mediumVal,
      utm_campaign: link.utm_campaign || '',
      utm_content: link.utm_content || '',
    });
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setCustomSource(false);
    setCustomMedium(false);
    setForm({ ...emptyForm, utm_source: defaultSource, utm_medium: defaultMedium });
    setDialogOpen(true);
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: url });
  };

  const siteUrl = window.location.origin;

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
              <div>
                <NavLink
                  to="/admin"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Painel
                </NavLink>
                <h1 className="text-3xl font-bold hero-text">Redirecionador de Links</h1>
                <p className="text-muted-foreground">Links curtos com UTM tracking</p>
              </div>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" /> Novo Link
              </Button>
            </div>

            {/* UTM Filters */}
            {links.length > 0 && (
              <Card variant="ghost" className="mb-4">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="utm_source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos sources</SelectItem>
                        {uniqueSources.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterMedium} onValueChange={setFilterMedium}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="utm_medium" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos mediums</SelectItem>
                        {uniqueMediums.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterCampaign} onValueChange={setFilterCampaign}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="utm_campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas campaigns</SelectItem>
                        {uniqueCampaigns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Date Range Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'h-8 text-xs justify-start min-w-[160px]',
                            !dateRange?.from && 'text-muted-foreground'
                          )}
                        >
                          <CalendarDays className="w-3 h-3 mr-1" />
                          {dateRange?.from
                            ? dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()
                              ? `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`
                              : format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                            : periodLabel}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="flex flex-wrap gap-1 p-2 border-b">
                          <Button
                            variant={periodLabel === 'Hoje' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              handlePeriodShortcut('Hoje', startOfDay(new Date()), new Date())
                            }
                          >
                            Hoje
                          </Button>
                          <Button
                            variant={periodLabel === '7 dias' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              handlePeriodShortcut(
                                '7 dias',
                                startOfDay(subDays(new Date(), 7)),
                                new Date()
                              )
                            }
                          >
                            7 dias
                          </Button>
                          <Button
                            variant={periodLabel === '30 dias' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              handlePeriodShortcut(
                                '30 dias',
                                startOfDay(subDays(new Date(), 30)),
                                new Date()
                              )
                            }
                          >
                            30 dias
                          </Button>
                          <Button
                            variant={periodLabel === 'Todo período' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handlePeriodShortcut('Todo período', null, null)}
                          >
                            Todo período
                          </Button>
                        </div>
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => {
                            setDateRange(range);
                            setPeriodLabel('Personalizado');
                          }}
                          numberOfMonths={1}
                          locale={ptBR}
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>

                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Mais recentes</SelectItem>
                        <SelectItem value="clicks">Mais clicados</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setFilterSource('__all__');
                          setFilterMedium('__all__');
                          setFilterCampaign('__all__');
                          setDateRange(undefined);
                          setPeriodLabel('Todo período');
                          setSortBy('recent');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                  {hasActiveFilters && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Mostrando {filteredLinks.length} de {links.length} links
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : links.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum link cadastrado ainda.</p>
                  <Button className="mt-4" onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" /> Criar primeiro link
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredLinks.map((link) => (
                  <Card key={link.id} className={!link.enabled ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            <code className="text-sm font-mono text-primary truncate">
                              {siteUrl}/r/{link.slug}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => copyLink(link.slug)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            → {link.destination_url}
                          </p>
                          {link.description && (
                            <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                          )}
                          <div className="flex gap-1 mt-2 flex-wrap items-center">
                            {link.utm_source && (
                              <Badge variant="outline" className="text-[10px]">
                                source: {link.utm_source}
                              </Badge>
                            )}
                            {link.utm_medium && (
                              <Badge variant="outline" className="text-[10px]">
                                medium: {link.utm_medium}
                              </Badge>
                            )}
                            {link.utm_campaign && (
                              <Badge variant="outline" className="text-[10px]">
                                campaign: {link.utm_campaign}
                              </Badge>
                            )}
                            {link.utm_content && (
                              <Badge variant="outline" className="text-[10px]">
                                content: {link.utm_content}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                              <CalendarIcon className="w-3 h-3" />
                              {new Date(link.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MousePointerClick className="w-4 h-4" />
                            <span className="text-sm font-medium">{link.clicks}</span>
                            {hasPeriodFilter && (
                              <span className="text-xs text-primary ml-1">
                                | {periodClicks[link.id] || 0} no período
                              </span>
                            )}
                          </div>
                          <Switch
                            checked={link.enabled}
                            onCheckedChange={(enabled) =>
                              toggleMutation.mutate({ id: link.id, enabled })
                            }
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(link)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar link?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O link <strong>/r/{link.slug}</strong> será removido
                                  permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(link.id)}>
                                  Deletar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Default UTM Config Card */}
            <Card variant="info" className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Configuração padrão de UTMs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Defina os valores padrão que serão preenchidos ao criar novos links.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">utm_source padrão</Label>
                    <Select value={defaultSource} onValueChange={setDefaultSource}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UTM_SOURCE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">utm_medium padrão</Label>
                    <Select value={defaultMedium} onValueChange={setDefaultMedium}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UTM_MEDIUM_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* UTM Guide */}
            <Card variant="note" className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  📊 Guia de UTMs — Como configurar corretamente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">utm_source</p>
                    <p>
                      De onde vem o tráfego. Ex: <code className="text-primary">mdaccula</code>,{' '}
                      <code className="text-primary">instagram</code>,{' '}
                      <code className="text-primary">whatsapp</code>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">utm_medium</p>
                    <p>
                      Tipo de canal. Ex: <code className="text-primary">link-curto</code>,{' '}
                      <code className="text-primary">bio</code>,{' '}
                      <code className="text-primary">stories</code>,{' '}
                      <code className="text-primary">email</code>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">utm_campaign</p>
                    <p>
                      Nome da campanha ou ação. Ex:{' '}
                      <code className="text-primary">carnaval-2026</code>,{' '}
                      <code className="text-primary">lancamento-ep</code>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">utm_content</p>
                    <p>
                      Diferencia variações do mesmo link. Ex:{' '}
                      <code className="text-primary">botao-cta</code>,{' '}
                      <code className="text-primary">banner-topo</code>
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <p className="font-semibold text-foreground mb-1">💡 Configuração recomendada</p>
                  <p>
                    Use sempre <code className="text-primary">utm_source=mdaccula</code> e{' '}
                    <code className="text-primary">utm_medium=link-curto</code> como padrão.
                    Personalize <code className="text-primary">utm_campaign</code> por ação e{' '}
                    <code className="text-primary">utm_content</code> quando tiver mais de um link
                    para a mesma campanha.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Dialog for create/edit */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Editar Link' : 'Novo Link'}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.slug || !form.destination_url) {
                      toast({ title: 'Preencha slug e URL de destino', variant: 'destructive' });
                      return;
                    }
                    saveMutation.mutate(form);
                  }}
                >
                  <div>
                    <Label>Slug (identificador curto)</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="min-w-0 max-w-[45%] truncate text-xs text-muted-foreground">
                        {siteUrl}/r/
                      </span>
                      <Input
                        value={form.slug}
                        onChange={(e) =>
                          setForm({ ...form, slug: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })
                        }
                        placeholder="whatsapp-carnaval"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>URL de destino</Label>
                    <Input
                      value={form.destination_url}
                      onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                      placeholder="https://chat.whatsapp.com/..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Descrição (interna)</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Grupo WhatsApp do Carnaval"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">UTM Source</Label>
                      {customSource ? (
                        <div className="flex gap-1 mt-1">
                          <Input
                            value={form.utm_source}
                            onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                            placeholder="fonte personalizada"
                            className="flex-1 h-9 text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs px-2"
                            onClick={() => {
                              setCustomSource(false);
                              setForm({ ...form, utm_source: defaultSource });
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.utm_source || '__empty__'}
                          onValueChange={(v) => {
                            if (v === '__custom__') {
                              setCustomSource(true);
                              setForm({ ...form, utm_source: '' });
                            } else if (v === '__empty__') {
                              setForm({ ...form, utm_source: '' });
                            } else {
                              setForm({ ...form, utm_source: v });
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1 h-9 text-xs">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UTM_SOURCE_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">Personalizado...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">UTM Medium</Label>
                      {customMedium ? (
                        <div className="flex gap-1 mt-1">
                          <Input
                            value={form.utm_medium}
                            onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                            placeholder="medium personalizado"
                            className="flex-1 h-9 text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs px-2"
                            onClick={() => {
                              setCustomMedium(false);
                              setForm({ ...form, utm_medium: defaultMedium });
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.utm_medium || '__empty__'}
                          onValueChange={(v) => {
                            if (v === '__custom__') {
                              setCustomMedium(true);
                              setForm({ ...form, utm_medium: '' });
                            } else if (v === '__empty__') {
                              setForm({ ...form, utm_medium: '' });
                            } else {
                              setForm({ ...form, utm_medium: v });
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1 h-9 text-xs">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UTM_MEDIUM_OPTIONS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">Personalizado...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">UTM Campaign</Label>
                      <Input
                        value={form.utm_campaign}
                        onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                        placeholder="carnaval-2026"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">UTM Content</Label>
                      <Input
                        value={form.utm_content}
                        onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                        placeholder="whatsapp-grupo"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                    {saveMutation.isPending
                      ? 'Salvando...'
                      : editingId
                        ? 'Salvar alterações'
                        : 'Criar link'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </>
  );
};

export default RedirectsManager;
