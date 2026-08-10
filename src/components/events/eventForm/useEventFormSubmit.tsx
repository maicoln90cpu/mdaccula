/**
 * Hook que encapsula o submit do EventForm — criado/atualizado do evento,
 * sincronização de custom_links, criação de link em /links, geração de blog
 * post via IA e disparo de rascunho E-goi. Extraído de EventForm.tsx (Onda 16)
 * sem alterar comportamento.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { generateEventGroupName } from '@/lib/eventGroupHelper';
import { parseLocalDateTime } from '@/lib/dateUtils';
import { uploadImageWithThumb } from '@/lib/bunnyUploader';
import { buildArticlePayload } from '@/lib/eventArticlePayload';
import { useAutoPublishSettings } from '@/hooks/useAutoPublishSettings';
import { type EventSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { notifyEventChange } from '@/lib/indexnow';
import { dispatchEventDraftEmail } from '@/lib/emailTemplates/dispatchEventDraft';
import { logger } from '@/lib/logger';
import { DEFAULT_EVENT_CTA_TYPE } from '@shared/eventCta.ts';
import type { Event } from '@/types';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { normalizeUrl, type EventFormData } from './constants';
import type { useToast } from '@/hooks/useToast';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseEventFormSubmitOptions {
  event?: Partial<Event>;
  imageFile: File | null;
  lineup: string[];
  schedule: EventSchedule | null;
  selectedGenres: string[];
  manualSlug: string;
  aiContext: string;
  createLink: boolean;
  linkUrlType: 'ticket' | 'slug';
  generateBlogPost: boolean;
  dispatchEmail: boolean;
  emailAutomationReady: boolean;
  toast: ToastFn;
  onSuccess: () => void;
}

export function useEventFormSubmit(opts: UseEventFormSubmitOptions) {
  const {
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
  } = opts;

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const isEditing = !!event?.id;
  const { settings: publishSettings } = useAutoPublishSettings(['auto_publish_single_event']);

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
        const addressChanged =
          (event.venue ?? '') !== (data.venue ?? '') ||
          (event.location_city ?? '') !== (data.location_city ?? '') ||
          (event.location_state ?? '') !== (data.location_state ?? '');
        const { error } = await supabase.from('events').update(eventData).eq('id', event.id);

        if (error) throw error;

        if (addressChanged) {
          // Endereço mudou: força re-geocode (novas coordenadas mudam a chave
          // de cache do mapa estático, então a próxima renderização já gera a
          // imagem nova). Fire-and-forget — não trava o salvamento do evento.
          logger.debug('[EventForm] 📍 Endereço alterado, disparando re-geocode', {
            eventId: event.id,
          });
          supabase.functions
            .invoke('geocode-event', { body: { event_id: event.id, force: true } })
            .then(({ error: geoError }) => {
              if (geoError) {
                logger.warn('[EventForm] Falha ao re-geocodificar evento após edição de endereço', {
                  eventId: event.id,
                  error: String(geoError?.message ?? geoError),
                });
              } else {
                logger.debug('[EventForm] ✅ Re-geocode concluído', { eventId: event.id });
              }
            })
            .catch((geoErr) => {
              logger.warn('[EventForm] Erro ao chamar geocode-event após edição de endereço', {
                eventId: event.id,
                error: String(geoErr),
              });
            });
        }

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
          {
            generateImage: !imageUrl,
            aiContextOverride: aiContext,
            publishImmediately: publishSettings.auto_publish_single_event === true,
          }
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

  return { onSubmit, submitting, uploading };
}
