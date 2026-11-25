# Contributing

Contributions to the application, data pipeline and documentation are welcome. For substantial changes, open an issue first to discuss scope and statistical implications.

## Development

Use Python 3.11 or newer. The runtime has no third-party Python dependencies.

```sh
make setup
make dev
make test
make lint
```

Run `make test` and `make lint` before submitting a pull request. Include tests for changes to data parsing, validation or statistical calculations.

## Data and statistical changes

- Use official sources and preserve dataset IDs, release metadata, classifications and observation status.
- Keep nationally reported series separate from modelled estimates.
- Treat missing observations as missing; do not fill them with zero or fabricated values.
- Document definitions, denominators, units and source changes.
- Use synthetic observations only in clearly identified tests.

## Pull requests

Use the pull request template to summarize the change, link relevant issues, and report checks performed. Update the documentation when behavior, data sources or statistical definitions change. Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
