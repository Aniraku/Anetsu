# Anetsu

Open-source AniList REST + GraphQL API — zero rate limits, full data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **REST API** — `/v1/anime`, `/v1/anime/{id}`, `/v1/genres`, `/v1/seasons`, `/v1/schedules`
- **GraphQL API** — `/graphql` — full AniList-compatible queries, fragments, variables
- **Swagger Docs** — `/docs` — interactive API documentation
- **Zero rate limits** — no API key required, 120 req/min per IP
- **Full data** — 14,546+ anime with characters, relations, recommendations, airing schedules
- **Daily updates** — data synced from AniList via automated workflows

## Quick Start

```bash
# REST — List anime
curl https://anetsu.dev/v1/anime?search=naruto&per_page=5

# REST — Get anime by ID
curl https://anetsu.dev/v1/anime/1

# GraphQL — Query
curl -X POST https://anetsu.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Media(id: 1) { id title { romaji english } averageScore } }"}'

# Swagger docs
open https://anetsu.dev/docs
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1` | API info |
| GET | `/v1/anime` | List/search anime |
| GET | `/v1/anime/{id}` | Get anime by ID |
| GET | `/v1/genres` | List all genres |
| GET | `/v1/seasons` | Seasonal anime |
| GET | `/v1/schedules` | Airing schedule |
| POST | `/graphql` | GraphQL API |
| GET | `/docs` | Swagger documentation |

## Rate Limiting

- **120 requests per minute per IP**
- No API key required
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Tech Stack

- **Runtime:** Node.js (Vercel Serverless)
- **Database:** Supabase (PostgreSQL)
- **Data Source:** [anilist-offline-db](https://github.com/Shoislam0311/anilist-offline-db)
- **API Style:** REST + GraphQL (AniList-compatible)

## Development

```bash
git clone https://github.com/Aniraku/Anetsu.git
cd Anetsu
npm install
vercel dev
```

### Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Acknowledgments

- Data sourced from [AniList](https://anilist.co)
- Inspired by [Jikan](https://jikan.moe) — the open-source MyAnimeList API
