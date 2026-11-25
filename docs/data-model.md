# Data model

Normalized rows include ILOSTAT series ID and label, collection/database, reference-area code, source code, year, frequency, sex and all source classification dimensions, numeric value, unit, observation status, estimate type, release and retrieval timestamps, and source notes. English reference-area, source, sex and classification labels are appended when the official dictionary index exposes a matching code list; codes are always retained. Raw column dictionaries and unchanged `.csv.gz` files are kept in each local snapshot for audit.

The API returns `value` only for numeric rows. An absent row is a missing observation; the application does not infer zero or interpolate gaps. The API exposes source rows without calculating cross-series statistics. Its views do not combine national and modelled estimates or series with different statistical standards.
