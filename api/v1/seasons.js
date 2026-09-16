import { supabase } from '../../lib/supabase.js';
import { json } from '../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  if (req.method !== 'GET') return json(res, { error: 'Method not allowed' }, 405);

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) return json(res, { error: 'Rate limit exceeded', retryAfter: rl.resetAt - Math.floor(Date.now() / 1000) }, 429, rateLimitHeaders(rl));

  const url = new URL(req.url, `https://${req.headers.host}`);
  const season = url.searchParams.get('season');
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')) : null;

  let query = supabase.from('anetsu_anime').select('id, title_romaji, title_english, cover_large, format, status, average_score, season, season_year').order('average_score', { ascending: false, nullsFirst: false }).limit(50);
  if (season) query = query.eq('season', season);
  if (year) query = query.eq('season_year', year);

  const { data, error } = await query;
  if (error) return json(res, { error: error.message }, 500);

  return json(res, { data: data || [] }, 200, rateLimitHeaders(rl));
}
