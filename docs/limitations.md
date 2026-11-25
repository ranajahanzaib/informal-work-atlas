# Scope and limitations

- No ILOSTAT observations are bundled with the repository. A working internet connection to ILOSTAT is required to run `make data`; until then the app shows an explicit unavailable-data state.
- The pipeline selects a curated subset of annual ILO modelled estimates. It does not currently provide nationally reported mode, working poverty, or full-catalogue discovery in the UI.
- Country profiles and basic country comparisons use source observations. Dedicated advanced country context, benchmark distributions, and saved comparisons are incomplete.
- Dedicated youth, gender, informality, employment, and coverage navigation exists, but several sections currently reuse the shared indicator workspace rather than implementing every plan-specific analytical view.
- Working poverty observations are unavailable in the selected pipeline registry. The page discloses this limitation.
- Aggregate regions are not computed from country percentages. `/api/v1/regions` is empty, and weighted regional/global aggregation is not implemented.
- The relationship-analysis API returns 501. There is no correlation, similarity, regression, causal, or bivariate map engine.
- Snapshot storage is CSV, not Parquet or DuckDB. Large source files are read into bounded local query results; the application is intended for a local research workflow, not high-concurrency public serving.
- The map uses bundled Natural Earth 1:110m country geometry. Detailed boundaries, a geographic mapping audit, disputed-boundary notes, and all exceptional ILO territory mappings are not complete.
- There is no FastAPI service, Docker deployment, scheduled refresh workflow, or hosted environment.
- Automated checks include Python unit tests and TypeScript/build checks. Browser end-to-end tests, realistic-volume performance tests, and a formal WCAG audit are not included.
- The user interface provides filters and an export for the currently returned records, capped by API query limits. It does not yet provide every export and interaction described in `PLAN.md`.
