export const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(340, 65%, 50%)',
  'hsl(45, 80%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(15, 75%, 50%)',
];

export const SERVICE_COLORS: Record<string, string> = {
  auth: 'hsl(210, 70%, 55%)',
  rest: 'hsl(var(--primary))',
  storage: 'hsl(150, 60%, 45%)',
  realtime: 'hsl(280, 60%, 55%)',
};

export const BILLING_URL =
  'https://supabase.com/dashboard/project/xfvpuzlspvvsmmunznxw/settings/billing/usage';
export const BUNNY_DASHBOARD = 'https://dash.bunny.net/cdn';

export const CHART_CONFIG = {
  bytes: { label: 'Bytes', color: 'hsl(var(--primary))' },
  v: { label: 'Valor', color: 'hsl(var(--primary))' },
  rate: { label: 'Cache %', color: 'hsl(150, 60%, 45%)' },
};
