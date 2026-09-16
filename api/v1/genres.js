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

  // Fetch in batches to avoid Supabase 1000 row default limit
  const allGenres = new Set();
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.from('anetsu_anime_genres')
      .select('genre')
      .range(offset, offset + batchSize - 1);
    if (error) return json(res, { error: error.message }, 500);
    if (!data || data.length === 0) break;
    for (const r of data) allGenres.add(r.genre);
    hasMore = data.length === batchSize;
    offset += batchSize;
  }

  const genres = [...allGenres].sort();
  return json(res, { data: genres }, 200, rateLimitHeaders(rl));
}
