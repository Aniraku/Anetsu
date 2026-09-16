export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export const INFO = {
  name: 'Anetsu',
  description: 'Open-source AniList REST + GraphQL API — zero rate limits, full data',
  version: '1.0.0',
  documentation: 'https://anetsu.is-a.dev/docs',
  github: 'https://github.com/Aniraku/Anetsu',
  endpoints: {
    rest: 'https://anetsu.is-a.dev/v1',
    graphql: 'https://anetsu.is-a.dev/graphql',
    docs: 'https://anetsu.is-a.dev/docs',
  },
  rateLimit: '120 requests per minute per IP',
  totalAnime: 14546,
};
