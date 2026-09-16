import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (url && key)
  ? createClient(url, key)
  : null;

export function requireDb() {
  if (!supabase) throw new Error('Database not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY');
}
