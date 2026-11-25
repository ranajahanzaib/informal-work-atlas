# API

The local read-only API is served on port 3001. The Vite development server proxies `/api` to it.

## Snapshot and catalog

- `GET /api/v1/health`
- `GET /api/v1/metadata`
- `GET /api/v1/indicators`
- `GET /api/v1/indicators/{id}`
- `GET /api/v1/indicators/{id}/dimensions`
- `GET /api/v1/indicators/{id}/coverage`
- `GET /api/v1/countries`
- `GET /api/v1/countries/{iso3}`
- `GET /api/v1/countries/{iso3}/profile`
- `GET /api/v1/countries/{iso3}/indicators`
- `GET /api/v1/countries/{iso3}/coverage`
- `GET /api/v1/regions` (empty until regional benchmark data is implemented)
- `GET /api/v1/sources`
- `GET /api/v1/releases`

## Analytical queries

- `GET /api/v1/observations`
- `GET /api/v1/map`
- `GET /api/v1/timeseries`
- `GET /api/v1/rankings`
- `GET /api/v1/comparison`
- `GET /api/v1/distribution`
- `GET /api/v1/composition`
- `GET /api/v1/coverage`
- `GET /api/v1/download`
- `POST /api/v1/relationships`, `/api/v1/analysis/correlation`, and `/api/v1/analysis/similarity` currently return 501 with an explanation because compatible statistical analysis is not implemented.

The GET analytical endpoints accept supported filters such as `indicator`, `country`, `countries`, `sex`, `classif1`, `classif2`, `start_year`, `end_year`, and `limit`. Query results are capped at 50,000 rows. The map endpoint returns the latest total observation for each mappable area, or observations for the requested `year`. Missing years and observations remain absent.

Responses include the snapshot identifier where applicable. Individual records retain publisher fields, units, source, release, estimate type, observation status, and classifications when those are present in the upstream table. Unsupported filters return HTTP 400. The API is local and has no production authentication or rate-limiting layer.

Legacy routes `/api/health`, `/api/manifest`, `/api/indicators`, and `/api/observations` remain available for compatibility.
