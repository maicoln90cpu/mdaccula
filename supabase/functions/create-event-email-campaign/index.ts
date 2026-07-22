// B.6 — Cria rascunho de campanha na E-goi para um evento.
// Guards (defesa em profundidade):
//  1. Auth admin (getUser + has_role).
//  2. Master switch site_settings.egoi_email_enabled = true.
//  3. Agência: egoi_config.is_enabled + list_id + sender_id preenchidos.
//  4. UPDATE atômico em events.email_campaign_dispatched_at (WHERE IS NULL) — previne race.
// Idempotência: se existe campanha 'sent' → cria nova; 'draft/failed/scheduled' → atualiza a existente.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { egoiRequest, sendEgoiCampaign } from '../_shared/egoiClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Mode = 'draft' | 'immediate' | 'scheduled';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Token inválido' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Apenas admins' }, 403);

    const body = await req.json().catch(() => ({}));
    const eventId = body?.event_id as string | undefined;
    const html = body?.html as string | undefined;
    const subject = (body?.subject as string | undefined) || undefined;
    const preheader = (body?.preheader as string | undefined) || undefined;
    const textVersion = (body?.text as string | undefined) || undefined;
    const templateType = (body?.template_type as string | undefined) || 'event_new';
    const forceResend = body?.force_resend === true;
    const sendNow = body?.send_now === true;
    // B.10 — teste A/B de assunto
    const abGroupId = (body?.ab_group_id as string | undefined) || null;
    const abVariant = (body?.ab_variant as string | undefined) || null; // 'A' | 'B'
    const abTestConfig = (body?.ab_test_config as Record<string, unknown> | undefined) || null;
    const isAbTest = !!abGroupId && !!abVariant;
    // Agendamento — cria o rascunho na E-goi agora, mas o envio real fica
    // para o poller send-scheduled-email-campaigns quando scheduled_at vencer.
    const scheduleAtRaw = (body?.schedule_at as string | undefined) || undefined;

    if (!eventId || !html) {
      return json({ error: 'event_id e html são obrigatórios' }, 400);
    }
    if (isAbTest && !['A', 'B'].includes(abVariant!)) {
      return json({ error: 'ab_variant deve ser A ou B' }, 400);
    }
    if (scheduleAtRaw && sendNow) {
      return json({ error: 'schedule_at e send_now são mutuamente exclusivos' }, 400);
    }
    let scheduleAtIso: string | null = null;
    if (scheduleAtRaw) {
      const scheduleAtMs = Date.parse(scheduleAtRaw);
      if (Number.isNaN(scheduleAtMs)) {
        return json({ error: 'schedule_at inválido' }, 400);
      }
      if (scheduleAtMs < Date.now() + 60_000) {
        return json({ error: 'schedule_at precisa ser pelo menos 1 minuto no futuro' }, 400);
      }
      scheduleAtIso = new Date(scheduleAtMs).toISOString();
    }


    // Guard 1: Master switch
    const { data: masterRow } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'egoi_email_enabled')
      .maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: Agência config
    const { data: cfg } = await admin
      .from('egoi_config')
      .select('*')
      .maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
    }

    // Guard 3: UPDATE atômico do dispatched_at (pulado em A/B).
    // Só marca se ainda estiver NULL — anti-race e anti-double-click.
    // force_resend permite botão "Reenviar" limpar antes de chamar novamente.
    // B.10 — A/B: as duas variantes são intencionais, então bypass do claim; usa fetch para pegar title/status.
    let claimedTitle: string | null = null;
    let claimedStatus: string | null = null;
    const now = new Date().toISOString();

    if (isAbTest) {
      const { data: ev } = await admin
        .from('events')
        .select('id,title,status')
        .eq('id', eventId)
        .maybeSingle();
      if (!ev) return json({ error: 'Evento não encontrado' }, 404);
      if (ev.status !== 'active') return json({ skipped: true, reason: 'event_not_active' });
      claimedTitle = ev.title;
      claimedStatus = ev.status;
    } else {
      if (forceResend) {
        await admin
          .from('events')
          .update({ email_campaign_dispatched_at: null })
          .eq('id', eventId);
      }

      const { data: claimed, error: claimErr } = await admin
        .from('events')
        .update({ email_campaign_dispatched_at: now })
        .eq('id', eventId)
        .is('email_campaign_dispatched_at', null)
        .select('id,title,status')
        .maybeSingle();

      if (claimErr) throw claimErr;
      if (!claimed) {
        return json({ skipped: true, reason: 'already_dispatched' });
      }
      if (claimed.status !== 'active') {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
        return json({ skipped: true, reason: 'event_not_active' });
      }
      claimedTitle = claimed.title;
      claimedStatus = claimed.status;
    }

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) {
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      return json({ error: 'EGOI_API_KEY não configurada' }, 500);
    }

    // Idempotência: em A/B, NUNCA reutiliza linha (cada variante é um registro novo).
    let reuseRow: any = null;
    if (!isAbTest) {
      const { data: lastCampaign } = await admin
        .from('event_email_campaigns')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      reuseRow = lastCampaign && lastCampaign.status !== 'sent' ? lastCampaign : null;
    }

    const mode: Mode = sendNow ? 'immediate' : scheduleAtIso ? 'scheduled' : ((cfg.mode as Mode) || 'draft');
    const abSuffix = isAbTest ? ` • A/B ${abVariant}` : '';
    const internalName = `MDAccula • ${claimedTitle || 'Evento'} • ${now.slice(0, 10)}${abSuffix}`;
    const finalSubject = subject?.trim();
    if (!finalSubject) {
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      return json({ error: 'Assunto do template está vazio' }, 400);
    }

    // E-goi v3: POST /campaigns/email
    // Doc: https://developers.e-goi.com/api/v3/#tag/Email/operation/createEmailCampaign
    // content deve ser { type: 'html', body: '<html>...' } (NÃO "html").
    // Tag por tipo de template (courtesy, event_new, etc.) + A/B quando aplicável.
    const typeTagMap: Record<string, string> = {
      event_new: 'evento-novo',
      courtesy: 'cortesia',
      weekly_digest: 'digest-semanal',
      weekly_digest_editorial: 'digest-editorial',
      weekend_agenda: 'agenda-fds',
    };
    const typeTag = typeTagMap[templateType] || 'evento-novo';
    const tags: string[] = ['mdaccula', typeTag];
    if (isAbTest) {
      tags.push('ab-test', `variante-${abVariant}`);
    }

    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject: finalSubject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: 'html',
        body: html,
        ...(preheader ? { preheader } : {}),
        ...(textVersion ? { text: textVersion } : {}),
      },
      tags,
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (cfg.segment_id) createPayload.segment_id = Number(cfg.segment_id);

    const created = await egoiRequest('/campaigns/email', apiKey, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    let campaignHash: string | null = null;
    let campaignStatus: 'draft' | 'failed' | 'sent' | 'scheduled' = 'failed';
    let errorMessage: string | null = null;
    let sentAt: string | null = null;
    let egoiSendStatus: number | null = null;
    let egoiSendBody: unknown = null;

    if (created.ok) {
      campaignHash =
        created.body?.campaign_hash ||
        created.body?.hash ||
        created.body?.data?.campaign_hash ||
        (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
        (created.body?.id != null ? String(created.body.id) : null);
      campaignStatus = 'draft';

      // Agendamento — a campanha já foi criada como rascunho na E-goi acima;
      // o disparo real fica para o poller send-scheduled-email-campaigns
      // quando scheduled_at vencer. Mesma exigência de hash que o envio imediato:
      // sem hash, não há como o poller confirmar o envio depois (R-007).
      if (scheduleAtIso && !campaignHash) {
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra agendar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (scheduleAtIso && campaignHash) {
        campaignStatus = 'scheduled';
      }

      // B.7 — Envio imediato (opcional).
      if (sendNow && !campaignHash) {
        // Campanha foi criada (created.ok) mas nenhum dos campos esperados de hash
        // veio na resposta — sem hash não há como chamar actions/send. Isso NÃO pode
        // ficar silencioso: sem isso, o envio é pulado e a UI mostrava "enviado" mesmo
        // assim (regressão R-007).
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra confirmar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (sendNow && campaignHash) {
        const sendRes = await sendEgoiCampaign(
          campaignHash,
          Number(cfg.list_id),
          apiKey,
          cfg.segment_id ? Number(cfg.segment_id) : null,
        );
        egoiSendStatus = sendRes.status;
        egoiSendBody = sendRes.body;
        // sendEgoiCampaign já confirma sucesso real inspecionando o corpo da
        // resposta (2xx sozinho não é suficiente — R-007) e já inclui o
        // `segments` obrigatório no payload (senão a E-goi responde 422
        // segments.isEmpty mesmo com list_id certo).
        if (sendRes.ok) {
          campaignStatus = 'sent';
          sentAt = new Date().toISOString();
        } else {
          // Criou o rascunho mas falhou o envio — mantém como draft e devolve erro.
          errorMessage = `E-goi send ${sendRes.status}: ${
            typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body)
          }`.slice(0, 1000);
        }
      }
    } else {
      // Falha na criação — libera o dispatched_at para nova tentativa não ficar bloqueada.
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      errorMessage = `E-goi ${created.status}: ${
        typeof created.body === 'string' ? created.body : JSON.stringify(created.body)
      }`.slice(0, 1000);
    }

    // Persistência do histórico
    const rowPayload: Record<string, unknown> = {
      event_id: eventId,
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      mode,
      error_message: errorMessage,
      sent_at: sentAt,
      campaign_type: isAbTest ? 'ab_subject' : 'standard',
      ab_group_id: abGroupId,
      ab_variant: abVariant,
      ab_test_config: abTestConfig,
      // Reseta o estado de agendamento a cada (re)criação — inclusive quando
      // NÃO é um agendamento (scheduleAtIso null), para limpar um agendamento
      // anterior caso esta linha esteja sendo reaproveitada (reuseRow).
      scheduled_at: scheduleAtIso,
      scheduled_send_claimed_at: null,
      scheduled_send_attempts: 0,
    };

    if (reuseRow) {
      await admin
        .from('event_email_campaigns')
        .update(rowPayload)
        .eq('id', (reuseRow as any).id);
    } else {
      await admin.from('event_email_campaigns').insert(rowPayload);
    }

    return json({
      ok: campaignStatus !== 'failed',
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: errorMessage,
      scheduled_at: campaignStatus === 'scheduled' ? scheduleAtIso : null,
      _debug: { egoi_status: created.status, egoi_send_status: egoiSendStatus, egoi_send_body: egoiSendBody },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

