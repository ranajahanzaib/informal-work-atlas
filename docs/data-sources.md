# Data sources

## ILOSTAT

The pipeline discovers up to 18 annual ILO modelled tables from the English table of contents at the [ILOSTAT bulk download facility](https://ilostat.ilo.org/data/bulk/). Series cover informal employment, labour-force participation, employment-to-population, unemployment, youth NEET, employment by status/activity/occupation, underemployment, labour underutilization, average hours and associated counts. The [indicator registry](./indicator-registry.md) lists each catalogue phrase. Dataset IDs are resolved from the live catalogue at refresh time. The snapshot manifest records catalogue labels, collections, frequency, update markers, and data coverage. Raw catalogue and compressed tables are retained with SHA-256 checksums in local snapshots.

The ILOEST catalogue lists the selected series with November 2025 releases. Downloaded values are not bundled with the source code. Run `make data` to retrieve them; until a validated snapshot is available, the application reports that data is unavailable. See the [current ILO Modelled Estimates catalogue](https://ilostat.ilo.org/databases/iloest/).

ILOSTAT metadata and bulk data are published by the International Labour Organization. Consult ILOSTAT's current terms and series notes before redistributing extracted datasets. Informal Work Atlas is independent and is not an official ILO product.
