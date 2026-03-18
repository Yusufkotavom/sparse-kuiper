import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const realtimeSchema = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_SCHEMA || "public";

let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi.");
  }
  return client;
}

export type RealtimeEventRecord = {
  id: number;
  stream: string;
  event_type: string;
  entity_table: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function subscribeToRealtimeStream(
  stream: string,
  onEvent: (event: RealtimeEventRecord) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`realtime-events:${stream}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: realtimeSchema,
        table: "realtime_events",
        filter: `stream=eq.${stream}`,
      },
      (payload) => {
        const row = payload.new as RealtimeEventRecord;
        onEvent(row);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
