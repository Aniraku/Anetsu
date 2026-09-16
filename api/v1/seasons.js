import { supabase, requireDb } from '../../lib/supabase.js';
import { json } from '../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../lib/rate-limit.js';

function toMedia(row) {
  return {
    id: row.id,
    idMal: row.id_mal,
    title: {
      romaji: row.title_romaji,
      english: row.title_english,
      native: row.title_native,
      userPreferred: row.title_user_preferred,
    },
    coverImage: {
      large: row.cover_large,
      medium: row.cover_medium,
      color: row.cover_color,
      extraLarge: row.cover_large,
    },
    bannerImage: row.banner_image,
    format: row.format,
    status: row.status,
    episodes: row.episodes,
    duration: row.duration,
    countryOfOrigin: row.country_of_origin,
    source: row.source,
    averageScore: row.average_score,
    meanScore: row.mean_score,
    popularity: row.popularity,
    trending: row.trending,
    favourites: row.favourites,
    isAdult: row.is_adult,
    season: row.season,
    seasonYear: row.season_year,
    startDate: row.start_date,
    endDate: row.end_date,
    nextAiringEpisode: row.next_airing_episode,
    synonyms: row.synonyms || [],
    genres: row.genres || [],
    studios: row.studios || [],
    recommendations: row.recommendations || [],
    relations: row.relations || [],
    characters: row.characters || [],
    staff: row.staff || [],
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
  const season = url.searchParams.get('season');
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')) : null;
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const perPage = Math.min(25, Math.max(1, parseInt(url.searchParams.get('perPage')) || 20));

  let query = supabase.from('anetsu_anime')
    .select('*', { count: 'exact' })
    .order('average_score', { ascending: false, nullsFirst: false });

  if (season) query = query.eq('season', season);
  if (year) query = query.eq('season_year', year);

  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data, error, count } = await query;
  if (error) return json(res, { error: error.message }, 500);

  return json(res, {
    data: (data || []).map(toMedia),
    pageInfo: {
      total: count || 0,
      perPage,
      currentPage: page,
      lastPage: Math.ceil((count || 0) / perPage),
      hasNextPage: page * perPage < (count || 0),
    },
  }, 200, rateLimitHeaders(rl));
}
