import { supabase, requireDb } from '../../../lib/supabase.js';
import { json } from '../../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../../lib/rate-limit.js';
import { rowToAnime } from '../../../lib/transform.js';

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

  const match = req.url.match(/\/v1\/anime\/(\d+)/);
  const id = match ? parseInt(match[1]) : null;
  if (!id) return json(res, { error: 'Invalid anime ID' }, 400);

  const { data, error } = await supabase.from('anetsu_anime').select('*').eq('id', id).single();
  if (error || !data) return json(res, { error: 'Anime not found' }, 404);

  return json(res, { data: rowToAnime(data) }, 200, rateLimitHeaders(rl));
}
