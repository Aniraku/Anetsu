import { supabase, requireDb } from '../../lib/supabase.js';
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

  try { requireDb(); } catch (e) { return json(res, { error: e.message }, 503, rateLimitHeaders(rl)); }

  const now = Math.floor(Date.now() / 1000);
  const { data, error } = await supabase.from('anetsu_airing').select('episode, airing_at, anetsu_anime(id, title_romaji, title_english, cover_large, format)').gt('airing_at', now).order('airing_at', { ascending: true }).limit(200);
  if (error) return json(res, { error: error.message }, 500);

  const schedules = (data || []).map((r) => ({
    episode: r.episode,
    airingAt: r.airing_at,
    media: r.anetsu_anime,
  }));

  return json(res, { data: schedules }, 200, rateLimitHeaders(rl));
}
