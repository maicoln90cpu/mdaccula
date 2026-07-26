import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { reconcileSchedule, parseSchedule, type EventSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { DEFAULT_EVENT_CTA_TYPE, type EventCtaType } from '@shared/eventCta.ts';
import type { Event } from '@/types';
import type { Tables } from '@/integrations/supabase/types';
import { type EventFormData } from './eventForm/constants';
import { BasicInfoSection } from './eventForm/BasicInfoSection';
import { DateTimeSection } from './eventForm/DateTimeSection';
import { GenresChecklist } from './eventForm/GenresChecklist';
import { LineupSection } from './eventForm/LineupSection';
import { TicketAndCtaSection } from './eventForm/TicketAndCtaSection';
import {
  DescriptionBlogSection,
  type BlogPostOption,
} from './eventForm/DescriptionBlogSection';
import { CreationOptionsSection } from './eventForm/CreationOptionsSection';
import { useEventFormSubmit } from './eventForm/useEventFormSubmit';

interface EventFormProps {
  event?: Partial<Event>;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EventForm = ({ event, onSuccess, onCancel }: EventFormProps) => {
  const [lineup, setLineup] = useState<string[]>(normalizeLineup(event?.lineup));
  const [newLineupItem, setNewLineupItem] = useState('');
  const [schedule, setSchedule] = useState<EventSchedule | null>(() => {
    const parsed = parseSchedule(event?.schedule);
    if (!parsed) return null;
    return parsed.map((e) => ({ ...e, lineup: normalizeLineup(e.lineup) }));
  });
  const [newScheduleArtist, setNewScheduleArtist] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPostOption[]>([]);
  const [blogSearchTerm, setBlogSearchTerm] = useState('');
  const [blogSearchResults, setBlogSearchResults] = useState<BlogPostOption[]>([]);
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPostOption | null>(null);
  const [showBlogDropdown, setShowBlogDropdown] = useState(false);
  const [manualSlug, setManualSlug] = useState(event?.slug || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(event?.genres || []);
  const [createLink, setCreateLink] = useState(true);
  const [linkUrlType, setLinkUrlType] = useState<'ticket' | 'slug'>('ticket');
  const [generateBlogPost, setGenerateBlogPost] = useState(false);
  const [aiContext, setAiContext] = useState<string>(event?.ai_context || '');
  const [, setLinkGroups] = useState<Tables<'link_groups'>[]>([]);
  const [eventTemplates, setEventTemplates] = useState<Tables<'event_templates'>[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  // B.6 — Toggle para criar rascunho automático de e-mail na E-goi ao salvar.
  // Default OFF (nunca dispara sem intent explícito do admin).
  const [dispatchEmail, setDispatchEmail] = useState(false);
  const [emailAutomationReady, setEmailAutomationReady] = useState(false);
  const [emailAutomationReason, setEmailAutomationReason] = useState<string>('');
  const { toast } = useToast();

  const methods = useForm<EventFormData>({
    defaultValues: event
      ? {
          title: event.title,
          venue: event.venue,
          address: event.address,
          location_state: event.location_state,
          location_city: event.location_city,
          venue_lat: event.venue_lat ?? null,
          venue_lng: event.venue_lng ?? null,
          date: event.date,
          end_date: event.end_date || '',
          time: event.time,
          end_time: event.end_time,
          ticket_link: event.ticket_link,
          vip_link: event.vip_link,
          pix_button_enabled: event.pix_button_enabled ?? false,
          tickets_per_day: event.tickets_per_day ?? false,
          cta_type: (event.cta_type as EventCtaType) ?? DEFAULT_EVENT_CTA_TYPE,
          description: event.description,
          subtitle: event.subtitle,
          blog_post_id: event.blog_post_id,
        }
      : {
          location_state: 'SP',
          cta_type: DEFAULT_EVENT_CTA_TYPE,
        },
  });
  const { handleSubmit, setValue, watch } = methods;

  useEffect(() => {
    const fetchData = async () => {
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('id, title, category')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(20);

      if (posts) setBlogPosts(posts);

      if (event?.blog_post_id && event.blog_post_id !== 'none') {
        const { data: selectedPost } = await supabase
          .from('blog_posts')
          .select('id, title, category')
          .eq('id', event.blog_post_id)
          .single();
        if (selectedPost) setSelectedBlogPost(selectedPost);
      }

      const { data: groups } = await supabase
        .from('link_groups')
        .select('*')
        .order('display_order', { ascending: true });

      if (groups) setLinkGroups(groups);

      const { data: templates } = await supabase.from('event_templates').select('*').order('name');

      if (templates) setEventTemplates(templates);

      // B.6 — Descobrir se a automação de e-mail está pronta.
      try {
        const [{ data: master }, { data: cfg }] = await Promise.all([
          supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'egoi_email_enabled')
            .maybeSingle(),
          supabase
            .from('egoi_config')
            .select('is_enabled,list_id,sender_id,default_event_template_id')
            .maybeSingle(),
        ]);
        if (master?.value !== 'true') {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Automação desativada pela Lovable (master switch OFF).');
        } else if (!cfg || !cfg.is_enabled) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Automação desligada no painel /admin/email-config.');
        } else if (!cfg.list_id || !cfg.sender_id) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Lista ou remetente ainda não configurados.');
        } else if (!cfg.default_event_template_id) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Selecione um template padrão em /admin/email-config.');
        } else {
          setEmailAutomationReady(true);
          setEmailAutomationReason('');
        }
      } catch {
        setEmailAutomationReady(false);
        setEmailAutomationReason('Não foi possível verificar a automação de e-mail.');
      }
    };
    fetchData();
  }, [event?.blog_post_id]);

  // Search blog posts by title
  useEffect(() => {
    if (!blogSearchTerm || blogSearchTerm.length < 2) {
      setBlogSearchResults(blogPosts.slice(0, 10));
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, category')
        .eq('published', true)
        .ilike('title', `%${blogSearchTerm}%`)
        .order('published_at', { ascending: false })
        .limit(15);

      if (data) setBlogSearchResults(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [blogSearchTerm, blogPosts]);

  // ===== Programação por dia (festival) =====
  const watchedDate = watch('date');
  const watchedEndDate = watch('end_date');
  const watchedTime = watch('time');
  const watchedEndTime = watch('end_time');

  useEffect(() => {
    if (!watchedDate || !watchedEndDate || watchedEndDate === watchedDate) {
      if (schedule !== null) setSchedule(null);
      return;
    }
    if (!watchedTime) return;
    const next = reconcileSchedule(
      schedule,
      watchedDate,
      watchedEndDate,
      watchedTime,
      watchedEndTime || null
    );
    if (JSON.stringify(next) !== JSON.stringify(schedule)) {
      setSchedule(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedDate, watchedEndDate, watchedTime, watchedEndTime]);

  const updateScheduleEntry = (date: string, patch: Partial<EventSchedule[number]>) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) => (e.date === date ? { ...e, ...patch } : e));
    });
  };

  const addScheduleArtist = (date: string) => {
    const value = (newScheduleArtist[date] || '').trim();
    if (!value) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) =>
        e.date === date ? { ...e, lineup: [...(e.lineup || []), value] } : e
      );
    });
    setNewScheduleArtist((s) => ({ ...s, [date]: '' }));
  };

  const removeScheduleArtist = (date: string, idx: number) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) =>
        e.date === date ? { ...e, lineup: (e.lineup || []).filter((_, i) => i !== idx) } : e
      );
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = eventTemplates.find((t) => t.id === templateId);
    if (!template) return;

    setValue('venue', template.venue);
    setValue('address', template.address || '');
    setValue('location_city', template.location_city);
    setValue('location_state', template.location_state);
    setValue('ticket_link', template.ticket_link || '');
    setValue('vip_link', template.vip_link || '');
    setValue('title', template.title || '');
    setValue('subtitle', template.subtitle || '');
    setValue('time', template.time || '');
    setValue('description', template.description || '');
    setSelectedGenres(template.genres || []);

    toast({
      title: 'Template aplicado',
      description: `Dados do template "${template.name}" foram preenchidos no formulário`,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const { onSubmit, submitting, uploading } = useEventFormSubmit({
    event,
    imageFile,
    lineup,
    schedule,
    selectedGenres,
    manualSlug,
    aiContext,
    createLink,
    linkUrlType,
    generateBlogPost,
    dispatchEmail,
    emailAutomationReady,
    toast,
    onSuccess,
  });

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{event ? 'Editar Evento' : 'Novo Evento'}</CardTitle>

        {!event && eventTemplates.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="template-select">Usar Template (opcional)</Label>
            <Select
              value={selectedTemplate}
              onValueChange={(value) => {
                setSelectedTemplate(value);
                if (value && value !== 'none') applyTemplate(value);
              }}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Selecione um template para preencher automaticamente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (preencher manualmente)</SelectItem>
                {eventTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <BasicInfoSection />

            {/* As coordenadas do venue são preenchidas automaticamente pela geocodificação
                quando o evento é visualizado ou quando o e-mail é disparado. */}

            <DateTimeSection />

            <GenresChecklist
              selectedGenres={selectedGenres}
              setSelectedGenres={setSelectedGenres}
            />

            <LineupSection
              manualSlug={manualSlug}
              setManualSlug={setManualSlug}
              lineup={lineup}
              setLineup={setLineup}
              newLineupItem={newLineupItem}
              setNewLineupItem={setNewLineupItem}
              schedule={schedule}
              watchedDate={watchedDate}
              watchedEndDate={watchedEndDate}
              newScheduleArtist={newScheduleArtist}
              setNewScheduleArtist={setNewScheduleArtist}
              updateScheduleEntry={updateScheduleEntry}
              addScheduleArtist={addScheduleArtist}
              removeScheduleArtist={removeScheduleArtist}
            />

            <div className="space-y-2">
              <Label htmlFor="image">Imagem do Evento</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="flex-1"
                />
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </div>

            <TicketAndCtaSection />

            <DescriptionBlogSection
              aiContext={aiContext}
              setAiContext={setAiContext}
              blogSearchTerm={blogSearchTerm}
              setBlogSearchTerm={setBlogSearchTerm}
              blogSearchResults={blogSearchResults}
              setBlogSearchResults={setBlogSearchResults}
              selectedBlogPost={selectedBlogPost}
              setSelectedBlogPost={setSelectedBlogPost}
              showBlogDropdown={showBlogDropdown}
              setShowBlogDropdown={setShowBlogDropdown}
              blogPosts={blogPosts}
            />

            <CreationOptionsSection
              createLink={createLink}
              setCreateLink={setCreateLink}
              linkUrlType={linkUrlType}
              setLinkUrlType={setLinkUrlType}
              generateBlogPost={generateBlogPost}
              setGenerateBlogPost={setGenerateBlogPost}
              aiContext={aiContext}
              setAiContext={setAiContext}
              dispatchEmail={dispatchEmail}
              setDispatchEmail={setDispatchEmail}
              emailAutomationReady={emailAutomationReady}
              emailAutomationReason={emailAutomationReason}
              showCreationBlocks={!event?.id}
            />

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={submitting || uploading} className="flex-1">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {event ? 'Atualizar' : 'Criar'} Evento
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
};
