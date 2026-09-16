import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('SUPABASE_URL / SUPABASE_ANON_KEY missing — database queries will fail');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');
