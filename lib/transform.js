export function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export function parseJsonObject(val) {
  if (!val) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return null;
}

export function transformRelations(raw) {
  if (!raw || !raw.length) return { edges: [], nodes: [] };
  const edges = raw.map((r) => ({
    node: {
      id: r.id,
      title: { romaji: r.title || null, english: r.title_english || null, native: r.title_native || null, userPreferred: r.title || null },
      type: r.type || 'ANIME',
      format: r.format || null,
      status: r.status || null,
      coverImage: { large: r.cover_large || null, medium: r.cover_medium || null, color: r.cover_color || null },
      bannerImage: r.banner_image || null,
      episodes: r.episodes || null,
      averageScore: r.average_score || null,
    },
    relationType: r.relationType || r.relation_type || 'OTHER',
  }));
  return { edges, nodes: edges.map((e) => e.node) };
}

export function transformRecommendations(raw) {
  if (!raw || !raw.length) return { edges: [], nodes: [] };
  const edges = raw.map((r) => ({
    node: {
      id: r.id,
      title: { romaji: r.title || null, english: r.title_english || null, native: r.title_native || null, userPreferred: r.title || null },
      type: r.type || 'ANIME',
      format: r.format || null,
      status: r.status || null,
      coverImage: { large: r.cover_large || null, medium: r.cover_medium || null, color: r.cover_color || null },
      bannerImage: r.banner_image || null,
      episodes: r.episodes || null,
      averageScore: r.average_score || null,
    },
    rating: r.rating || 0,
  }));
  return { edges, nodes: edges.map((e) => e.node) };
}

export function transformStudios(raw) {
  if (!raw || !raw.length) return { edges: [], nodes: [] };
  const edges = raw.map((s) => ({
    node: { id: s.id || null, name: s.name || s, isMain: s.isMain || s.is_main || false },
    isMain: s.isMain || s.is_main || false,
  }));
  return { edges, nodes: edges.map((e) => e.node) };
}

export function transformCharacters(raw) {
  if (!raw || !raw.length) return { edges: [] };
  return {
    edges: raw.map((c) => ({
      node: {
        id: c.id,
        name: { full: c.name || null, native: c.nameNative || c.name_native || null, alternative: c.nameAlt || c.name_alt || [] },
        image: { large: c.image || c.large || null, medium: c.image || c.medium || null },
      },
      role: c.role || 'SUPPORTING',
    })),
  };
}

export function rowToAnime(row) {
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
    studios: transformStudios(parseJsonArray(row.studios)),
    characters: transformCharacters(parseJsonArray(row.characters)),
    staff: parseJsonArray(row.staff),
    relations: transformRelations(parseJsonArray(row.relations)),
    recommendations: transformRecommendations(parseJsonArray(row.recommendations)),
    nextAiringEpisode: parseJsonObject(row.next_airing_episode),
    airingSchedule: parseJsonArray(row.airing_schedule).map((ep) => ({
      episode: ep.episode, airingAt: ep.airingAt, timeUntilAiring: ep.airingAt - Math.floor(Date.now() / 1000),
    })),
    streamingEpisodes: parseJsonArray(row.streaming_episodes),
    externalLinks: parseJsonArray(row.external_links),
    rankings: parseJsonArray(row.rankings),
    stats: parseJsonObject(row.stats),
    trailer: parseJsonObject(row.trailer),
  };
}
