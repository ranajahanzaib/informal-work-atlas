# Repository guidance

- Treat `PLAN.md` as the implementation specification. Do not edit it unless the user explicitly asks.
- Preserve statistical provenance and source classifications. Never invent, interpolate, or silently substitute observations.
- Keep the React dashboard strict TypeScript and use the repository's pnpm scripts.
- Keep ILOSTAT raw downloads immutable and publish snapshots only after validation succeeds.
- Do not commit generated local datasets, build output, secrets, or local environment files.
- Run `make lint`, `pnpm build`, and `make test` after implementation changes.
