import { supabase, requireDb } from '../../../lib/supabase.js';
import { json } from '../../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../../lib/rate-limit.js';

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function rowToAnime(row) {
  return {
    id: row.id,
    idMal: row.id_mal,
    title: { romaji: row.title_romaji, english: row.title_english, native: row.title_native, userPreferred: row.title_user_preferred || row.title_romaji },
    coverImage: { large: row.cover_large, medium: row.cover_medium || (row.cover_large ? row.cover_large.replace('/large/', '/medium/') : null), color: row.cover_color, extraLarge: row.cover_large },
    bannerImage: row.banner_image,
    description: row.description,
    format: row.format,
    status: row.status,
    episodes: row.episodes,
    duration: row.duration,
    countryOfOrigin: row.country_of_origin,
    source: row.source,
    hashtag: row.hashtag,
    synonyms: parseJsonArray(row.synonyms),
    averageScore: row.average_score,
    meanScore: row.mean_score,
    popularity: row.popularity,
    trending: row.trending,
    favourites: row.favourites,
    isAdult: !!row.is_adult,
    season: row.season,
    seasonYear: row.season_year,
    startDate: row.start_date,
    endDate: row.end_date,
    genres: parseJsonArray(row.genres),
    tags: parseJsonArray(row.tags),
    studios: parseJsonArray(row.studios),
    characters: parseJsonArray(row.characters),
    relations: parseJsonArray(row.relations),
    recommendations: parseJsonArray(row.recommendations),
    streamingEpisodes: parseJsonArray(row.streaming_episodes),
    externalLinks: parseJsonArray(row.external_links),
    rankings: parseJsonArray(row.rankings),
    nextAiringEpisode: (() => { try { return typeof row.next_airing_episode === 'string' ? JSON.parse(row.next_airing_episode) : row.next_airing_episode; } catch { return null; } })(),
  };
}

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
  if (adult === 'true') { /* include adult */ }
  else query = query.eq('is_adult', false);

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
