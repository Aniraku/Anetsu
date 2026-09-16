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

  try {
    const { count } = await supabase.from('anetsu_anime').select('id', { count: 'exact', head: true });
    const { data: genres } = await supabase.from('anetsu_anime_genres').select('genre');
    const uniqueGenres = [...new Set((genres || []).map((g) => g.genre))];

    return json(res, {
      data: {
        totalAnime: count || 0,
        totalGenres: uniqueGenres.length,
        genres: uniqueGenres.sort(),
        endpoints: {
          anime: '/v1/anime',
          animeById: '/v1/anime/{id}',
          genres: '/v1/genres',
          seasons: '/v1/seasons',
          schedules: '/v1/schedules',
          graphql: '/graphql',
          docs: '/docs',
        },
      },
    }, 200, rateLimitHeaders(rl));
  } catch (e) {
    return json(res, { error: 'Internal error', details: e.message }, 500, rateLimitHeaders(rl));
  }
}
