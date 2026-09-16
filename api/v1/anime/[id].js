import { supabase, requireDb } from '../../../lib/supabase.js';
import { json } from '../../../lib/utils.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../../../lib/rate-limit.js';

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function parseJsonObject(val) {
  if (!val) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return null;
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
    staff: parseJsonArray(row.staff),
    relations: parseJsonArray(row.relations),
    recommendations: parseJsonArray(row.recommendations),
    streamingEpisodes: parseJsonArray(row.streaming_episodes),
    externalLinks: parseJsonArray(row.external_links),
    rankings: parseJsonArray(row.rankings),
    stats: parseJsonObject(row.stats),
    trailer: parseJsonObject(row.trailer),
    nextAiringEpisode: parseJsonObject(row.next_airing_episode),
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

  const match = req.url.match(/\/v1\/anime\/(\d+)/);
  const id = match ? parseInt(match[1]) : null;
  if (!id) return json(res, { error: 'Invalid anime ID' }, 400);

  const { data, error } = await supabase.from('anetsu_anime').select('*').eq('id', id).single();
  if (error || !data) return json(res, { error: 'Anime not found' }, 404);

  return json(res, { data: rowToAnime(data) }, 200, rateLimitHeaders(rl));
}
