# Geographic data

The dashboard includes the Natural Earth 1:110m country geometry distributed by the `world-atlas` package. It joins numeric polygon identifiers to ISO alpha-3 codes through `i18n-iso-countries`, then joins ILOSTAT reference-area codes. Aggregate reference areas are excluded from the country map.

This is a country-level reference map, not a full territory or disputed-boundary gazetteer. A polygon without a matching ILOSTAT observation is hatched and is never assigned zero. ILOSTAT aggregates such as world or regional totals are not mapped as countries. The projection is Natural Earth (compromise), not equal-area.

The join is necessarily limited by the source codes and polygon identifiers present in each release. Check the source label, selected year, classification, and country-level coverage before interpreting the map. The accessible observation table remains available as an alternative.
