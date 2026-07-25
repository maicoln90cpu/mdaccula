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
import { generateEventGroupName } from '@/lib/eventGroupHelper';
import { useNavigate } from 'react-router-dom';
import { parseLocalDateTime } from '@/lib/dateUtils';
import { uploadImageWithThumb } from '@/lib/bunnyUploader';
import { buildArticlePayload } from '@/lib/eventArticlePayload';
import { reconcileSchedule, parseSchedule, type EventSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { notifyEventChange } from '@/lib/indexnow';
import { dispatchEventDraftEmail } from '@/lib/emailTemplates/dispatchEventDraft';
import { logger } from '@/lib/logger';
import { DEFAULT_EVENT_CTA_TYPE, type EventCtaType } from '@shared/eventCta.ts';
import type { Event } from '@/types';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { normalizeUrl, type EventFormData } from './eventForm/constants';
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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const navigate = useNavigate();

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

  const isEditing = !!event?.id;

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

  const uploadImage = async () => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      return await uploadImageWithThumb(imageFile, 'event-images', { medium: true });
    } catch (error) {
      logger.error('Error uploading image:', error);
      toast({
        title: 'Erro ao fazer upload da imagem',
        description: 'Tente novamente',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    logger.debug('[EventForm] 📝 Iniciando submit do formulário', {
      isEditing,
      eventId: event?.id,
      generateBlogPost,
      createLink,
      title: data.title,
    });

    setSubmitting(true);
    try {
      let imageUrl = event?.image_url;

      if (imageFile) {
        logger.debug('[EventForm] 📷 Fazendo upload de imagem...');
        imageUrl = await uploadImage();
        if (!imageUrl) {
          logger.debug('[EventForm] ❌ Falha no upload de imagem, abortando submit');
          setSubmitting(false);
          return;
        }
        logger.debug('[EventForm] ✅ Upload de imagem concluído:', { imageUrl });
      }

      const baseSlug = data.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const timestamp = Date.now().toString().slice(-6);
      const eventSlug = manualSlug || event?.slug || `${baseSlug}-${timestamp}`;

      const blogPostId = data.blog_post_id === 'none' ? null : data.blog_post_id || null;

      const normalizedTicketLink = normalizeUrl(data.ticket_link);
      const normalizedVipLink = normalizeUrl(data.vip_link);

      if (data.end_date && data.end_date < data.date) {
        toast({
          title: 'Data final inválida',
          description: 'A data final do festival precisa ser igual ou posterior à data inicial.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const normalizedLineup = normalizeLineup(lineup);

      const finalSchedule =
        data.end_date && data.end_date > data.date && schedule && schedule.length > 0
          ? schedule.map((e) => ({ ...e, lineup: normalizeLineup(e.lineup) }))
          : null;

      const eventData = {
        ...data,
        ticket_link: normalizedTicketLink,
        vip_link: normalizedVipLink,
        lineup: normalizedLineup,
        venue_lat:
          data.venue_lat === undefined || data.venue_lat === null || Number.isNaN(data.venue_lat)
            ? null
            : Number(data.venue_lat),
        venue_lng:
          data.venue_lng === undefined || data.venue_lng === null || Number.isNaN(data.venue_lng)
            ? null
            : Number(data.venue_lng),
        genres: selectedGenres,
        image_url: imageUrl,
        slug: eventSlug,
        blog_post_id: blogPostId,
        end_date: data.end_date || null,
        time: data.time && data.time.trim() ? data.time : null,
        end_time: data.end_time || null,
        subtitle: data.subtitle || null,
        ai_context: aiContext.trim() || null,
        schedule: finalSchedule,
        pix_button_enabled: data.pix_button_enabled === true,
        tickets_per_day:
          data.tickets_per_day === true && !!data.end_date && data.end_date > data.date,
        cta_type: data.cta_type ?? DEFAULT_EVENT_CTA_TYPE,
      };

      logger.debug('[EventForm] 📦 Dados do evento preparados:', {
        slug: eventSlug,
        genres: selectedGenres.length,
        hasImage: !!imageUrl,
        hasTicketLink: !!normalizedTicketLink,
      });

      let createdEventId = event?.id;

      if (event?.id) {
        logger.debug('[EventForm] 🔄 Atualizando evento existente:', { eventId: event.id });
        const previousSlug = event?.slug;
        const { error } = await supabase.from('events').update(eventData).eq('id', event.id);

        if (error) throw error;

        if (previousSlug && previousSlug !== eventSlug) {
          const { error: redirErr } = await supabase
            .from('event_slug_redirects')
            .upsert(
              { old_slug: previousSlug, event_id: event.id, reason: 'slug renamed via admin' },
              { onConflict: 'old_slug' }
            );
          if (redirErr) {
            logger.warn('[EventForm] Falha ao gravar redirect de slug antigo', {
              error: String(redirErr?.message ?? redirErr),
            });
          } else {
            logger.debug('[EventForm] Redirect criado', { previousSlug, eventSlug });
          }
        }

        logger.debug('[EventForm] 🔗 Sincronizando campos com links vinculados...');
        const linkUpdateData: TablesUpdate<'custom_links'> = {
          title: data.title,
          subtitle: data.subtitle || `${data.venue} - ${data.location_city}/${data.location_state}`,
          override_date: data.date,
          override_time: data.time || null,
          updated_at: new Date().toISOString(),
        };

        if (imageFile && imageUrl) {
          linkUpdateData.thumbnail_url = imageUrl;
        }

        if (normalizedTicketLink) {
          linkUpdateData.url = normalizedTicketLink;
        }

        const { error: linkUpdateError } = await supabase
          .from('custom_links')
          .update(linkUpdateData)
          .eq('event_id', event.id);

        if (linkUpdateError) {
          logger.error('[EventForm] ⚠️ Erro ao sincronizar links:', linkUpdateError);
        } else {
          logger.debug('[EventForm] ✅ Campos sincronizados com links vinculados');
        }

        logger.debug('[EventForm] ✅ Evento atualizado com sucesso');

        try {
          localStorage.removeItem('mdaccula-events-cache');
          logger.debug('[EventForm] 🗑️ Cache localStorage de eventos limpo');
        } catch {
          // localStorage indisponível — limpeza de cache é best-effort
        }

        toast({
          title: 'Evento atualizado com sucesso!',
        });

        notifyEventChange(eventSlug);
      } else {
        logger.debug('[EventForm] ➕ Criando novo evento...');
        const { data: insertedEvent, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;
        createdEventId = insertedEvent.id;

        logger.debug('[EventForm] ✅ Evento criado com sucesso:', { createdEventId });
        toast({
          title: 'Evento criado com sucesso!',
        });

        notifyEventChange(eventSlug);
      }

      logger.debug('[EventForm] 🔍 Verificando se deve gerar blog post:', {
        generateBlogPost,
        isEditing,
        createdEventId,
        shouldGenerate: generateBlogPost && !isEditing && createdEventId,
      });

      if (generateBlogPost && !isEditing && createdEventId) {
        logger.debug('[EventForm] 🤖 Iniciando geração de blog post via IA...');

        const blogPayload = buildArticlePayload(
          {
            id: createdEventId,
            title: data.title,
            subtitle: data.subtitle,
            date: data.date,
            time: data.time,
            end_time: data.end_time,
            venue: data.venue,
            address: data.address,
            location_city: data.location_city,
            location_state: data.location_state,
            description: data.description,
            genres: selectedGenres,
            lineup,
            ticket_link: normalizedTicketLink,
            vip_link: normalizedVipLink,
            image_url: imageUrl,
            ai_context: aiContext,
          },
          { generateImage: !imageUrl, aiContextOverride: aiContext }
        );

        logger.debug('[EventForm] Payload para generate-blog-post-v2', { payload: blogPayload });

        try {
          const startTime = Date.now();
          const { data: blogPostData, error: blogError } = await supabase.functions.invoke(
            'generate-blog-post-v2',
            { body: blogPayload }
          );
          const duration = Date.now() - startTime;

          logger.debug('[EventForm] Resposta da edge function', {
            duration,
            hasData: !!blogPostData,
            hasError: !!blogError,
            postId: blogPostData?.post?.id,
            error: blogError ? String(blogError?.message ?? blogError) : null,
          });

          if (blogError) throw blogError;

          if (blogPostData?.post?.id) {
            logger.debug('[EventForm] 🔗 Vinculando blog post ao evento...');
            const { error: updateError } = await supabase
              .from('events')
              .update({ blog_post_id: blogPostData.post.id })
              .eq('id', createdEventId);

            if (updateError) {
              logger.error('[EventForm] ❌ Erro ao vincular blog post:', updateError);
            } else {
              logger.debug('[EventForm] ✅ Blog post vinculado com sucesso:', blogPostData.post.id);
              toast({
                title: 'Post do blog gerado e vinculado!',
                description: 'O post foi automaticamente vinculado ao evento.',
                action: (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/blog?edit=${blogPostData.post.id}`)}
                  >
                    Editar Post
                  </Button>
                ),
              });
            }
          } else {
            logger.warn('[EventForm] ⚠️ Resposta da IA não contém post.id:', blogPostData);
          }
        } catch (blogError) {
          logger.error('[EventForm] ❌ Erro ao gerar blog post:', blogError);
          toast({
            title: 'Erro ao gerar post do blog',
            description: 'O evento foi criado, mas o post não foi gerado.',
            variant: 'destructive',
          });
        }
      } else {
        logger.debug('[EventForm] ⏭️ Geração de blog post ignorada:', {
          reason: !generateBlogPost
            ? 'checkbox desmarcado'
            : isEditing
              ? 'modo edição'
              : 'sem eventId',
        });
      }

      if (createLink && !isEditing && data.date && normalizedTicketLink && createdEventId) {
        try {
          const groupName = generateEventGroupName(data.date);

          const { data: existingGroup, error: _groupError } = await supabase
            .from('link_groups')
            .select('id')
            .eq('name', groupName)
            .single();

          let groupId = existingGroup?.id;

          if (!existingGroup) {
            const eventDate = new Date(data.date + 'T12:00:00');
            const chronologicalOrder = eventDate.getFullYear() * 100 + (eventDate.getMonth() + 1);

            const { data: newGroup, error: createGroupError } = await supabase
              .from('link_groups')
              .insert([{ name: groupName, enabled: true, display_order: chronologicalOrder }])
              .select()
              .single();

            if (createGroupError) throw createGroupError;
            groupId = newGroup.id;
            logger.debug(
              `[EventForm] 📁 Grupo "${groupName}" criado com display_order=${chronologicalOrder}`
            );
          }

          const eventDateTime = parseLocalDateTime(data.date, data.time || '00:00');
          const displayOrder = Math.floor(eventDateTime.getTime() / 1000);

          const linkUrl = linkUrlType === 'ticket' ? normalizedTicketLink : `/eventos/${eventSlug}`;

          const { error: linkError } = await supabase.from('custom_links').insert([
            {
              title: data.title,
              subtitle:
                data.subtitle || `${data.venue} - ${data.location_city}/${data.location_state}`,
              url: linkUrl,
              thumbnail_url: imageUrl,
              group_id: groupId,
              display_order: displayOrder,
              is_internal: linkUrlType === 'slug',
              enabled: true,
              icon: 'Calendar',
              color_gradient: null,
              card_height: 80,
              event_id: createdEventId,
              override_date: data.date,
              override_time: data.time || null,
            },
          ]);

          if (linkError) throw linkError;

          toast({
            title: 'Link criado em /links com sucesso!',
          });
        } catch (linkError) {
          logger.error('Error creating link:', linkError);
          toast({
            title: 'Erro ao criar link',
            description: 'O evento foi criado, mas o link não foi criado.',
            variant: 'destructive',
          });
        }
      }

      if (dispatchEmail && emailAutomationReady && createdEventId) {
        try {
          const result = await dispatchEventDraftEmail(createdEventId);
          if (result.skipped) {
            toast({
              title: 'Rascunho de e-mail não criado',
              description: `Motivo: ${result.reason ?? 'desconhecido'}. Verifique o painel /admin/email-config.`,
              variant: 'destructive',
            });
          } else if (result.ok) {
            toast({
              title: 'Rascunho criado na E-goi',
              description: 'Revise e envie manualmente pela sua conta E-goi.',
            });
          } else {
            toast({
              title: 'Falha ao criar rascunho na E-goi',
              description: result.error || 'Veja o histórico no painel de e-mails.',
              variant: 'destructive',
            });
          }
        } catch (dispatchErr: unknown) {
          const message = dispatchErr instanceof Error ? dispatchErr.message : 'Erro desconhecido';
          logger.error('[EventForm] Falha no disparo de rascunho E-goi:', dispatchErr);
          toast({
            title: 'Falha no disparo de e-mail',
            description: message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }

      onSuccess();
    } catch (error) {
      logger.error('Error saving event:', error);
      toast({
        title: 'Erro ao salvar evento',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

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
