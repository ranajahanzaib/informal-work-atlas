# Architecture

The dashboard is a React 19.3 single-page application built and served by Vite 8.3. Strict TypeScript is enabled. The production bundle is written to `web/dist`; the local Python server serves that bundle and the same-origin JSON API. During development, Vite runs on port 5173 and proxies `/api` requests to the Python server on port 3001.

`src/ui/App.tsx` contains route state, query filters, data requests, atlas/country/comparison workspaces, accessible SVG charts, and the data table. Country boundaries are bundled from `world-atlas` (Natural Earth 1:110m) and joined through ISO-3166 numeric/alpha-3 codes. The map uses ILO reference-area codes and explicitly excludes aggregate codes from country geometry.

`pipelines/ilostat/refresh.py` discovers selected annual series through the live ILOSTAT catalogue, fetches official tables and dictionaries with bounded concurrency, validates rows, and stages a snapshot. A validated snapshot is atomically published through `data/processed/CURRENT`. `iwa/data.py` reads the selected CSV tables and manifest. `iwa/server.py` provides the local API and static file server.

Current storage is normalized CSV plus a JSON manifest. The server streams CSV rows into bounded in-memory query results; it does not use DuckDB, Parquet, or a shared typed schema package. The application has no public hosting configuration. API analysis endpoints that lack a documented statistical implementation return an explicit unavailable response rather than fabricated output.
