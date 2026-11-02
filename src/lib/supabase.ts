import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let clientKey = '';

/** Buat (atau pakai ulang) klien Supabase dari URL + anon key di Pengaturan. */
export function initSupabase(url: string, anonKey: string) {
  const key = `${url}|${anonKey}`;
  if (!client || key !== clientKey) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'anima-auth' },
    });
    clientKey = key;
  }
  return client;
}

export function sb() {
  if (!client) throw new Error('Supabase belum diatur.');
  return client;
}
