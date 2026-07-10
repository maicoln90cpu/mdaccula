// Reconfigura os cron jobs do digest semanal e/ou agenda FDS a partir das
// chaves em site_settings. Se `<job>_enabled` = false, apenas remove o job
// (sem afetar o outro). Fuso fixo BRT (-3) → converte para UTC.
//
// Body: { job?: 'weekly_digest' | 'weekend_agenda' | 'both' }
//   default = 'both'
// Apenas admins autenticados podem chamar.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JobKey = 'weekly_digest' | 'weekend_agenda';

const JOB_META: Record<JobKey, { jobName: string; slug: string; secretName: string }> = {
  weekly_digest: {
    jobName: 'weekly-digest-cron',
    slug: 'weekly-digest-draft',
    secretName: 'weekly_digest_cron',
  },
  weekend_agenda: {
    jobName: 'weekend-agenda-cron',
    slug: 'weekend-agenda-draft',
    secretName: 'weekend_agenda_cron',
  },
};

// Converte (dia BRT, hora BRT) → (dia UTC, hora UTC). BRT = UTC-3.
// Domingo = 0 … Sábado = 6. Sun-Sat: cron expects 0-6 (0/7 = domingo).
function toUtc(dayBrt: number, hourBrt: number): { day: number; hour: number } {
  let hour = hourBrt + 3;
  let day = dayBrt;
  if (hour >= 24) {
    hour -= 24;
    day = (day + 1) % 7;
  }
  return { day, hour };
}

function buildCronExpr(dayBrt: number, hourBrt: number): string {
  const { day, hour } = toUtc(dayBrt, hourBrt);
  // "min hour * * dow"
  return `0 ${hour} * * ${day}`;
}

async function getOrCreateCronSecret(admin: any, secretName: string): Promise<string> {
  const { data: row } = await admin
    .from('internal_cron_secrets')
    .select('secret')
    .eq('name', secretName)
    .maybeSingle();
  if (row?.secret) return row.secret as string;

  const newSecret = crypto.randomUUID();
  const { error } = await admin
    .from('internal_cron_secrets')
    .upsert({ name: secretName, secret: newSecret }, { onConflict: 'name' });
  if (error) throw new Error(`cron secret upsert failed: ${error.message}`);
  return newSecret;
}

async function readSettings(admin: any, keys: string[]): Promise<Record<string, string>> {
  const { data } = await admin.from('site_settings').select('key, value').in('key', keys);
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
    out[row.key] = row.value ?? '';
  }
  return out;
}

async function applyJob(admin: any, job: JobKey, supabaseUrl: string): Promise<any> {
  const meta = JOB_META[job];
  const prefix = job; // 'weekly_digest' | 'weekend_agenda'
  const keys = [`${prefix}_enabled`, `${prefix}_cron_day`, `${prefix}_cron_hour`];
  const settings = await readSettings(admin, keys);

  const enabled = settings[`${prefix}_enabled`] === 'true';
  const dayRaw = parseInt(settings[`${prefix}_cron_day`] ?? '4', 10);
  const hourRaw = parseInt(settings[`${prefix}_cron_hour`] ?? '18', 10);
  const dayBrt = Number.isFinite(dayRaw) && dayRaw >= 0 && dayRaw <= 6 ? dayRaw : 4;
  const hourBrt = Number.isFinite(hourRaw) && hourRaw >= 0 && hourRaw <= 23 ? hourRaw : 18;

  const cronExpr = buildCronExpr(dayBrt, hourBrt);
  const functionUrl = `${supabaseUrl}/functions/v1/${meta.slug}`;
  const secret = await getOrCreateCronSecret(admin, meta.secretName);

  const { data, error } = await admin.rpc('manage_digest_schedule', {
    _job_name: meta.jobName,
    _enabled: enabled,
    _cron_expr: cronExpr,
    _function_url: functionUrl,
    _cron_secret: secret,
  });
  if (error) throw new Error(`manage_digest_schedule(${meta.jobName}) failed: ${error.message}`);

  return {
    job,
    enabled,
    cron_expr: cronExpr,
    day_brt: dayBrt,
    hour_brt: hourBrt,
    function_url: functionUrl,
    result: data,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Token inválido' }, 401);
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id, _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Apenas admins' }, 403);

    const body = await req.json().catch(() => ({}));
    const rawJob = typeof body?.job === 'string' ? body.job : 'both';
    const jobs: JobKey[] =
      rawJob === 'weekly_digest' ? ['weekly_digest'] :
      rawJob === 'weekend_agenda' ? ['weekend_agenda'] :
      ['weekly_digest', 'weekend_agenda'];

    const results = [];
    for (const j of jobs) {
      results.push(await applyJob(admin, j, supabaseUrl));
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error('[update-digest-schedule]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
