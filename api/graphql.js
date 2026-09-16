import { parse, Kind } from 'graphql';
import { supabase, requireDb } from '../lib/supabase.js';
import { checkRateLimit, rateLimitHeaders, getClientIp } from '../lib/rate-limit.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonRes(res, data, status = 200, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...extra });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Field resolver — picks requested fields from a DB row
function collectSelections(node, fragments) {
  if (!node?.selectionSet) return [];
  const out = [];
  for (const sel of node.selectionSet.selections) {
    if (sel.kind === Kind.FIELD) out.push(sel);
    else if (sel.kind === Kind.FRAGMENT_SPREAD) { const f = fragments[sel.name.value]; if (f) out.push(...collectSelections(f, fragments)); }
    else if (sel.kind === Kind.INLINE_FRAGMENT) out.push(...collectSelections(sel, fragments));
  }
  return out;
}

function pick(obj, sels, fragments) {
  if (!sels?.length) return obj;
  const out = {};
  for (const s of sels) {
    const key = s.alias?.value || s.name.value;
    if (s.name.value === '__typename') { out[key] = obj.__typename || 'Media'; continue; }
    const sub = s.selectionSet ? collectSelections(s, fragments) : null;
    if (!sub?.length) { out[key] = obj[key] ?? null; continue; }
    const val = obj[key];
    if (Array.isArray(val)) out[key] = val.map((item) => item && typeof item === 'object' ? pick(item, sub, fragments) : item);
    else if (val && typeof val === 'object') out[key] = pick(val, sub, fragments);
    else out[key] = val ?? null;
  }
  return out;
}

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

function dbRowToMedia(row) {
  return {
    __typename: 'Media',
    id: row.id,
    idMal: row.id_mal,
    title: { romaji: row.title_romaji, english: row.title_english, native: row.title_native, userPreferred: row.title_user_preferred || row.title_romaji, __typename: 'MediaTitle' },
    coverImage: { large: row.cover_large, medium: row.cover_medium || (row.cover_large ? row.cover_large.replace('/large/', '/medium/') : null), color: row.cover_color, extraLarge: row.cover_large, __typename: 'CoverImage' },
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
    nextAiringEpisode: parseJsonObject(row.next_airing_episode),
    airingSchedule: parseJsonObject(row.airing_schedule),
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
  };
}

async function resolvePage(args, fieldNode, fragments) {
  const page = Math.max(1, parseInt(args.page) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(args.perPage) || 25));

  let query = supabase.from('anetsu_anime').select('*', { count: 'exact' });
  if (args.search) query = query.or(`title_romaji.ilike.%${args.search}%,title_english.ilike.%${args.search}%`);
  if (args.status) query = query.eq('status', args.status);
  if (args.format) query = query.eq('format', args.format);
  if (args.season) query = query.eq('season', args.season);
  if (args.seasonYear) query = query.eq('season_year', args.seasonYear);
  if (args.genre) {
    const { data: gIds } = await supabase.from('anetsu_anime_genres').select('anime_id').eq('genre', args.genre);
    query = gIds?.length ? query.in('id', gIds.map((g) => g.anime_id)) : query.eq('id', -1);
  }
  if (args.id) query = query.eq('id', args.id);
  if (args.idMal) query = query.eq('id_mal', args.idMal);

  const sortCol = { POPULARITY_DESC: 'popularity', SCORE_DESC: 'average_score', TRENDING_DESC: 'trending', START_DATE_DESC: 'start_date' };
  const sortField = args.sort?.[0] || 'POPULARITY_DESC';
  const col = sortCol[sortField] || 'popularity';
  query = query.order(col, { ascending: !sortField.endsWith('_DESC'), nullsFirst: false });

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, count } = await query;
  const mediaNode = fieldNode?.selectionSet?.selections?.find((s) => s.name.value === 'media');
  const mediaSels = mediaNode ? collectSelections(mediaNode, fragments) : null;
  const media = (data || []).map((row) => {
    const mediaObj = dbRowToMedia(row);
    return mediaSels ? pick(mediaObj, mediaSels, fragments) : mediaObj;
  });

  const lastPage = Math.ceil((count || 0) / perPage) || 1;
  const pageInfo = { total: count || 0, perPage, currentPage: page, lastPage, hasNextPage: page < lastPage, __typename: 'PageInfo' };

  const out = {};
  for (const s of (fieldNode?.selectionSet?.selections || [])) {
    const k = s.alias?.value || s.name.value;
    if (s.name.value === 'media') out[k] = media;
    else if (s.name.value === 'pageInfo') out[k] = pick(pageInfo, collectSelections(s, fragments), fragments);
    else out[k] = null;
  }
  return out;
}

async function resolveMedia(args, fieldNode, fragments) {
  let query;
  if (args.id) query = supabase.from('anetsu_anime').select('*').eq('id', args.id).single();
  else if (args.search) query = supabase.from('anetsu_anime').select('*').or(`title_romaji.ilike.%${args.search}%,title_english.ilike.%${args.search}%`).limit(1).single();
  else return null;
  const { data, error } = await query;
  if (error || !data) return null;
  const media = dbRowToMedia(data);
  return pick(media, collectSelections(fieldNode, fragments), fragments);
}

async function execute(query, variables = {}, operationName = null) {
  let doc;
  try { doc = parse(query); } catch (e) { return { errors: [{ message: `Syntax Error: ${e.message}` }] }; }
  const fragments = {};
  for (const def of doc.definitions) { if (def.kind === Kind.FRAGMENT_DEFINITION) fragments[def.name.value] = def; }
  let op = operationName
    ? doc.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION && d.name?.value === operationName)
    : doc.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (!op) return { errors: [{ message: 'No operation found' }] };

  const data = {};
  const errors = [];
  for (const field of op.selectionSet.selections) {
    if (field.kind !== Kind.FIELD) continue;
    try {
      const sels = collectSelections(field, fragments);
      const args = {};
      for (const arg of (field.arguments || [])) {
        if (arg.value.kind === Kind.VARIABLE) args[arg.name.value] = variables?.[arg.value.name.value];
        else if (arg.value.kind === Kind.INT) args[arg.name.value] = parseInt(arg.value.value, 10);
        else if (arg.value.kind === Kind.STRING || arg.value.kind === Kind.ENUM) args[arg.name.value] = arg.value.value;
        else if (arg.value.kind === Kind.LIST) args[arg.name.value] = (arg.value.values || []).map((v) => v.value);
      }
      if (field.name.value === 'Page') data[field.alias?.value || 'Page'] = await resolvePage(args, field, fragments);
      else if (field.name.value === 'Media') data[field.alias?.value || 'Media'] = await resolveMedia(args, field, fragments);
      else data[field.alias?.value || field.name.value] = null;
    } catch (err) { errors.push({ message: err.message, path: [field.name.value] }); }
  }
  return errors.length ? { data, errors } : { data };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) return jsonRes(res, { error: 'Rate limit exceeded' }, 429, rateLimitHeaders(rl));

  try { requireDb(); } catch (e) { return jsonRes(res, { error: e.message }, 503, rateLimitHeaders(rl)); }

  if (req.method === 'GET') {
    const parsed = new URL(req.url, `https://${req.headers.host}`);
    const query = parsed.searchParams.get('query');
    if (!query) return jsonRes(res, { usage: 'POST /graphql with { "query": "...", "variables": {...} }' });
    let variables = {};
    try { variables = JSON.parse(parsed.searchParams.get('variables') || '{}'); } catch { return jsonRes(res, { errors: [{ message: 'Invalid variables JSON' }] }, 400); }
    return jsonRes(res, await execute(query, variables, parsed.searchParams.get('operationName')), 200, rateLimitHeaders(rl));
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return jsonRes(res, { errors: [{ message: 'Invalid JSON body' }] }, 400); }
    if (!body?.query) return jsonRes(res, { errors: [{ message: 'No query provided' }] }, 400);
    try { return jsonRes(res, await execute(body.query, body.variables || {}, body.operationName), 200, rateLimitHeaders(rl)); }
    catch (e) { return jsonRes(res, { errors: [{ message: e.message || 'Internal error' }] }, 500); }
  }
  return jsonRes(res, { error: 'Method not allowed' }, 405);
}
