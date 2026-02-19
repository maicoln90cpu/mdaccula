import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  error?: string;
}

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface LogPayload {
  logs?: LogEntry[];
  metrics?: PerformanceMetric[];
  sessionId?: string;
  userAgent?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: LogPayload = await req.json();
    const { logs = [], metrics = [], sessionId, userAgent } = payload;

    // Filter only errors and warnings for persistence (to save space)
    const importantLogs = logs.filter(log => 
      log.level === 'error' || log.level === 'warn'
    );

    // Filter slow operations (> 500ms)
    const slowMetrics = metrics.filter(metric => metric.duration > 500);

    // Prepare batch insert data
    const logInserts = importantLogs.map(log => ({
      level: log.level,
      message: log.message.substring(0, 1000), // Limit message size
      context: log.context || {},
      error_message: log.error?.substring(0, 500) || null,
      session_id: sessionId || null,
      user_agent: userAgent?.substring(0, 255) || null,
      logged_at: log.timestamp,
    }));

    const metricInserts = slowMetrics.map(metric => ({
      name: metric.name.substring(0, 100),
      duration_ms: Math.round(metric.duration),
      context: metric.context || {},
      session_id: sessionId || null,
      measured_at: metric.timestamp,
    }));

    let logsInserted = 0;
    let metricsInserted = 0;

    // Insert logs if any
    if (logInserts.length > 0) {
      const { error: logsError } = await supabase
        .from('application_logs')
        .insert(logInserts);
      
      if (logsError) {
        console.error('Error inserting logs:', logsError);
      } else {
        logsInserted = logInserts.length;
      }
    }

    // Insert metrics if any
    if (metricInserts.length > 0) {
      const { error: metricsError } = await supabase
        .from('performance_metrics')
        .insert(metricInserts);
      
      if (metricsError) {
        console.error('Error inserting metrics:', metricsError);
      } else {
        metricsInserted = metricInserts.length;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        logsInserted, 
        metricsInserted,
        totalReceived: {
          logs: logs.length,
          metrics: metrics.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in persist-logs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
