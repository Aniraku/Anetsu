import { supabase, requireDb } from '../../../lib/supabase.js';
import { json } from '../../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../../lib/rate-limit.js';
import { rowToAnime, parseJsonArray } from '../../../lib/transform.js';

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
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('per_page') || url.searchParams.get('limit') || '25')));
  const search = url.searchParams.get('search') || url.searchParams.get('q');
  const status = url.searchParams.get('status');
  const format = url.searchParams.get('format');
  const season = url.searchParams.get('season');
  const seasonYear = url.searchParams.get('season_year') ? parseInt(url.searchParams.get('season_year')) : null;
  const genre = url.searchParams.get('genre');
  const sort = url.searchParams.get('sort') || 'POPULARITY_DESC';
  const adult = url.searchParams.get('adult');

  let query = supabase.from('anetsu_anime').select('*', { count: 'exact' });

  if (search) {
    const q = search.replace(/[^\w\s]/g, '').trim();
    if (q) query = query.or(`title_romaji.ilike.%${q}%,title_english.ilike.%${q}%,title_native.ilike.%${q}%`);
  }
  if (status) query = query.eq('status', status);
  if (format) query = query.eq('format', format);
  if (season) query = query.eq('season', season);
  if (seasonYear) query = query.eq('season_year', seasonYear);
  if (adult !== 'true') query = query.eq('is_adult', false);

  if (genre) {
    const { data: genreIds } = await supabase.from('anetsu_anime_genres').select('anime_id').eq('genre', genre);
    if (genreIds?.length) query = query.in('id', genreIds.map((g) => g.anime_id));
    else return json(res, { data: [], pagination: { total: 0, page, perPage, lastPage: 1, hasNextPage: false } }, 200, rateLimitHeaders(rl));
  }

  const sortMap = {
    'POPULARITY_DESC': { column: 'popularity', ascending: false },
    'SCORE_DESC': { column: 'average_score', ascending: false },
    'START_DATE_DESC': { column: 'start_date', ascending: false },
    'TITLE_ROMAJI': { column: 'title_romaji', ascending: true },
    'TRENDING_DESC': { column: 'trending', ascending: false },
  };
  const sortOpts = sortMap[sort] || sortMap['POPULARITY_DESC'];
  query = query.order(sortOpts.column, { ascending: sortOpts.ascending, nullsFirst: false });

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, count, error } = await query;
  if (error) return json(res, { error: error.message }, 500);

  const lastPage = Math.ceil((count || 0) / perPage);
  return json(res, {
    data: (data || []).map(rowToAnime),
    pagination: {
      total: count || 0,
      page,
      perPage,
      lastPage,
      hasNextPage: page < lastPage,
    },
  }, 200, rateLimitHeaders(rl));
}
