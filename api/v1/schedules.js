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

  const url = new URL(req.url, `https://${req.headers.host}`);
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const perPage = Math.min(25, Math.max(1, parseInt(url.searchParams.get('perPage')) || 20));
  const now = Math.floor(Date.now() / 1000);

  const { data, error, count } = await supabase
    .from('anetsu_airing')
    .select('*, anetsu_anime!inner(id, title_romaji, title_english, cover_large, format, status, average_score)', { count: 'exact' })
    .gte('airing_at', now)
    .order('airing_at', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) return json(res, { error: error.message }, 500);

  const schedule = (data || []).map((entry) => ({
    id: entry.anime_id,
    episode: entry.episode,
    airingAt: entry.airing_at,
    timeUntilAiring: entry.airing_at - now,
    media: {
      id: entry.anetsu_anime?.id || entry.anime_id,
      title: {
        romaji: entry.anetsu_anime?.title_romaji || null,
        english: entry.anetsu_anime?.title_english || null,
      },
      coverImage: {
        large: entry.anetsu_anime?.cover_large || null,
      },
      format: entry.anetsu_anime?.format || null,
      status: entry.anetsu_anime?.status || null,
      averageScore: entry.anetsu_anime?.average_score || null,
    },
  }));

  return json(res, {
    data: schedule,
    pageInfo: {
      total: count || 0,
      perPage,
      currentPage: page,
      lastPage: Math.ceil((count || 0) / perPage),
      hasNextPage: page * perPage < (count || 0),
    },
  }, 200, rateLimitHeaders(rl));
}
