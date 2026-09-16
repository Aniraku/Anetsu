// Migrate JSON shard data from GitHub Pages → Supabase
// Run: SUPABASE_URL=https://sbjdrjaovcgvttfnpfsz.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/push-to-supabase.js

import { createClient } from '@supabase/supabase-js';

const DATA_BASE = 'https://shoislam0311.github.io/anilist-offline-db/api';
const BATCH = 500;
const TOTAL_SHARDS = 73;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = createClient(url, key);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchShard(idx) {
  const padded = String(idx).padStart(4, '0');
  const r = await fetch(`${DATA_BASE}/shards/shard_${padded}.json`);
  if (!r.ok) throw new Error(`Shard ${padded}: ${r.status}`);
  return r.json();
}

function flattenAnime(raw) {
  return {
    id: raw.id,
    id_mal: raw.id_mal || raw.idMal || null,
    title_romaji: raw.title?.romaji || raw.title_romaji || null,
    title_english: raw.title?.english || raw.title_english || null,
    title_native: raw.title?.native || raw.title_native || null,
    title_user_preferred: raw.title?.userPreferred || raw.title_user_preferred || null,
    description: raw.description || null,
    cover_large: raw.coverImage?.large || raw.cover_large || null,
    cover_medium: raw.coverImage?.medium || raw.cover_large?.replace('/large/', '/medium/') || null,
    cover_color: raw.coverImage?.color || raw.cover_color || null,
    banner_image: raw.bannerImage || raw.banner_image || null,
    format: raw.format || null,
    status: raw.status || null,
    episodes: raw.episodes || null,
    duration: raw.duration || null,
    country_of_origin: raw.countryOfOrigin || raw.country_of_origin || null,
    source: raw.source || null,
    hashtag: raw.hashtag || null,
    synonyms: raw.synonyms || [],
    average_score: raw.averageScore || raw.average_score || null,
    mean_score: raw.meanScore || raw.mean_score || null,
    popularity: raw.popularity || null,
    trending: raw.trending || null,
    favourites: raw.favourites || null,
    is_adult: raw.isAdult || raw.is_adult || false,
    season: raw.season || null,
    season_year: raw.seasonYear || raw.season_year || null,
    start_date: raw.startDate || raw.start_date || null,
    end_date: raw.endDate || raw.end_date || null,
    next_airing_episode: raw.nextAiringEpisode || raw.next_airing_episode || null,
    airing_schedule: raw.airingSchedule || raw.airing_schedule || null,
    genres: raw.genres || [],
    tags: raw.tags || [],
    studios: raw.studios || [],
    characters: raw.characters || [],
    staff: raw.staff || [],
    relations: raw.relations || [],
    recommendations: raw.recommendations || [],
    streaming_episodes: raw.streamingEpisodes || raw.streaming_episodes || [],
    external_links: raw.externalLinks || raw.external_links || [],
    rankings: raw.rankings || [],
    stats: raw.stats || null,
    trailer: raw.trailer || null,
    updated_at: new Date().toISOString(),
  };
}

function extractGenres(anime) {
  const genres = [];
  const seen = new Set();
  for (const g of (anime.genres || [])) {
    const name = typeof g === 'string' ? g : g?.name || null;
    if (name && !seen.has(name)) {
      seen.add(name);
      genres.push({ anime_id: anime.id, genre: name });
    }
  }
  return genres;
}

function extractAiring(anime) {
  const entries = [];
  const schedule = anime.airing_schedule || [];
  for (const ep of schedule) {
    if (ep.episode && ep.airingAt) {
      entries.push({ anime_id: anime.id, episode: ep.episode, airing_at: ep.airingAt });
    }
  }
  if (!entries.length && anime.next_airing_episode) {
    const ep = typeof anime.next_airing_episode === 'number' ? anime.next_airing_episode : anime.next_airing_episode.episode;
    const at = anime.next_airing_at || anime.next_airing_episode?.airingAt;
    if (ep && at) entries.push({ anime_id: anime.id, episode: ep, airing_at: at });
  }
  return entries;
}

async function pushBatch(table, rows) {
  if (!rows.length) return;
  let attempt = 0;
  while (true) {
    attempt++;
    const { error } = await db.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      if (error.message?.includes('429') && attempt <= 5) {
        console.warn(`  429 on ${table}, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      throw new Error(`${table} batch error: ${error.message}`);
    }
    break;
  }
}

async function pushGenreBatch(rows) {
  if (!rows.length) return;
  let attempt = 0;
  while (true) {
    attempt++;
    const { error } = await db.from('anetsu_anime_genres').upsert(rows, { onConflict: 'anime_id,genre' });
    if (error) {
      if (error.message?.includes('429') && attempt <= 5) {
        console.warn(`  429 on genres, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      throw new Error(`genres batch error: ${error.message}`);
    }
    break;
  }
}

async function pushAiringBatch(rows) {
  if (!rows.length) return;
  let attempt = 0;
  while (true) {
    attempt++;
    const { error } = await db.from('anetsu_airing').upsert(rows, { onConflict: 'anime_id,episode' });
    if (error) {
      if (error.message?.includes('429') && attempt <= 5) {
        console.warn(`  429 on airing, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      throw new Error(`airing batch error: ${error.message}`);
    }
    break;
  }
}

async function main() {
  console.log(`Migrating ${TOTAL_SHARDS} shards to Supabase...`);
  console.log(`Target: ${url}`);

  const allAnime = [];
  const allGenres = [];
  const allAiring = [];

  for (let i = 0; i < TOTAL_SHARDS; i++) {
    try {
      const shard = await fetchShard(i);
      for (const raw of shard) {
        const flat = flattenAnime(raw);
        allAnime.push(flat);
        allGenres.push(...extractGenres(flat));
        allAiring.push(...extractAiring(flat));
      }
      process.stdout.write(`\r  Shard ${i + 1}/${TOTAL_SHARDS} loaded (${allAnime.length} anime)`);
    } catch (e) {
      console.warn(`\n  Shard ${i} failed: ${e.message}`);
    }
  }
  console.log(`\n  Total: ${allAnime.length} anime, ${allGenres.length} genre links, ${allAiring.length} airing entries`);

  // Push anime in batches
  console.log('\nPushing anime...');
  for (let i = 0; i < allAnime.length; i += BATCH) {
    const batch = allAnime.slice(i, i + BATCH);
    await pushBatch('anetsu_anime', batch);
    process.stdout.write(`\r  Anime: ${Math.min(i + BATCH, allAnime.length)}/${allAnime.length}`);
  }
  console.log(' ✓');

  // Push genres in batches
  console.log('Pushing genres...');
  for (let i = 0; i < allGenres.length; i += BATCH) {
    const batch = allGenres.slice(i, i + BATCH);
    await pushGenreBatch(batch);
    process.stdout.write(`\r  Genres: ${Math.min(i + BATCH, allGenres.length)}/${allGenres.length}`);
  }
  console.log(' ✓');

  // Push airing in batches
  if (allAiring.length) {
    console.log('Pushing airing schedule...');
    for (let i = 0; i < allAiring.length; i += BATCH) {
      const batch = allAiring.slice(i, i + BATCH);
      await pushAiringBatch(batch);
      process.stdout.write(`\r  Airing: ${Math.min(i + BATCH, allAiring.length)}/${allAiring.length}`);
    }
    console.log(' ✓');
  }

  console.log('\nMigration complete!');
}

main().catch((e) => { console.error(e); process.exit(1); });
