# Development

Requirements: Node.js 22+, pnpm 10+, and Python 3.11+.

```sh
pnpm install --frozen-lockfile
make dev
```

The Vite dashboard runs at <http://127.0.0.1:5173>; API requests are proxied to the local Python process on port 3001. `make dev` stops the API process when the Vite process exits.

```sh
make data        # refresh selected ILOSTAT series (requires source network access)
pnpm typecheck   # TypeScript strict checks
pnpm build       # type-check and create web/dist
make lint        # Python compile checks and frontend type checks
make test        # Python unittest suite
```

For the static production bundle, run `pnpm build`, then `python3 -m iwa.cli serve` and open <http://127.0.0.1:3001>. The server requires `web/dist/index.html`; build it first. Data snapshots and refresh staging files are ignored by Git.
