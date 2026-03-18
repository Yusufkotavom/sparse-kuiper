import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const realtimeSchema = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_SCHEMA || "public";

function createOptionalSupabaseClient(): SupabaseClient {
  if (isSupabaseConfigured && supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Auth Supabase dinonaktifkan (optional mode)."
  );

  const noSession = { data: { session: null }, error: null };
  const noUser = { data: { user: null }, error: null };

  return {
    auth: {
      getSession: async () => noSession,
      getUser: async () => noUser,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: { message: "Supabase belum dikonfigurasi." },
      }),
      signInWithOAuth: async () => ({
        data: { provider: null, url: null },
        error: { message: "Supabase belum dikonfigurasi." },
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: { message: "Supabase belum dikonfigurasi." },
      }),
      updateUser: async () => ({
        data: { user: null },
        error: { message: "Supabase belum dikonfigurasi." },
      }),
    },
  } as unknown as SupabaseClient;
}

export const supabase = createOptionalSupabaseClient();

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
  if (!isSupabaseConfigured) {
    return { unsubscribe: () => undefined };
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
