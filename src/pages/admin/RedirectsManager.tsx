/**
 * RedirectsManager — página admin de links redirecionadores com UTM.
 *
 * Onda 11 (slim-down): 911 → <400 linhas. UI, queries e mutations
 * preservadas 1:1. Subcomponentes em `./redirectsManager/`.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { Plus, ArrowLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';

import {
  UTM_SOURCE_OPTIONS,
  UTM_MEDIUM_OPTIONS,
  type RedirectLink,
  type FormData,
} from './redirectsManager/types';
import { FiltersBar } from './redirectsManager/FiltersBar';
import { RedirectLinkRow } from './redirectsManager/RedirectLinkRow';
import { DefaultUtmCard } from './redirectsManager/DefaultUtmCard';
import { UtmGuideCard } from './redirectsManager/UtmGuideCard';
import { RedirectFormDialog } from './redirectsManager/RedirectFormDialog';

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

          {links.length > 0 && (
            <FiltersBar
              uniqueSources={uniqueSources}
              uniqueMediums={uniqueMediums}
              uniqueCampaigns={uniqueCampaigns}
              filterSource={filterSource}
              filterMedium={filterMedium}
              filterCampaign={filterCampaign}
              dateRange={dateRange}
              periodLabel={periodLabel}
              sortBy={sortBy}
              hasActiveFilters={hasActiveFilters}
              filteredCount={filteredLinks.length}
              totalCount={links.length}
              setFilterSource={setFilterSource}
              setFilterMedium={setFilterMedium}
              setFilterCampaign={setFilterCampaign}
              setDateRange={setDateRange}
              setPeriodLabel={setPeriodLabel}
              setSortBy={setSortBy}
              handlePeriodShortcut={handlePeriodShortcut}
            />
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
                <RedirectLinkRow
                  key={link.id}
                  link={link}
                  siteUrl={siteUrl}
                  hasPeriodFilter={hasPeriodFilter}
                  periodClickCount={periodClicks[link.id] || 0}
                  onCopy={copyLink}
                  onEdit={handleEdit}
                  onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}

          <DefaultUtmCard
            defaultSource={defaultSource}
            defaultMedium={defaultMedium}
            setDefaultSource={setDefaultSource}
            setDefaultMedium={setDefaultMedium}
          />

          <UtmGuideCard />

          <RedirectFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editingId={editingId}
            form={form}
            setForm={setForm}
            customSource={customSource}
            setCustomSource={setCustomSource}
            customMedium={customMedium}
            setCustomMedium={setCustomMedium}
            defaultSource={defaultSource}
            defaultMedium={defaultMedium}
            siteUrl={siteUrl}
            isSaving={saveMutation.isPending}
            onSubmit={(f) => saveMutation.mutate(f)}
          />
        </div>
      </main>
    </div>
  );
};

export default RedirectsManager;
