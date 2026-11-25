# Indicator registry

The pipeline resolves series by matching the phrase shown against `indicator.label` in the current English ILOSTAT table of contents, restricted to annual frequency. The ILO catalogue may add/remove a selected series; unavailable entries are listed in the snapshot manifest. The catalogue-derived ID, exact display label, database/collection, last update, frequency, unit class and year coverage are recorded after download.

| Registry key                           | Catalogue phrase                                                                                   | Unit class |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| `informal-rate-modelled`               | Informal employment rate by sex — ILO modelled estimates                                           | Percentage |
| `informal-count-modelled`              | Informal employment by sex — ILO modelled estimates                                                | Thousands  |
| `participation-rate-modelled`          | Labour force participation rate by sex and age — ILO modelled estimates                            | Percentage |
| `employment-population-ratio-modelled` | Employment-to-population ratio by sex and age — ILO modelled estimates                             | Percentage |
| `unemployment-rate-modelled`           | Unemployment rate by sex and age — ILO modelled estimates                                          | Percentage |
| `neet-rate-modelled`                   | NEET rate: share of youth not in employment, education or training by sex — ILO modelled estimates | Percentage |
| `employment-sector-modelled`           | Employment by sex and economic activity — ILO modelled estimates                                   | Thousands  |
| `employment-status-modelled`           | Employment by sex and status in employment — ILO modelled estimates                                | Thousands  |
| `employment-occupation-modelled`       | Employment by sex and occupation — ILO modelled estimates                                          | Thousands  |
| `underemployment-rate-modelled`        | Time-related underemployment rate by sex and age — ILO modelled estimates                          | Percentage |
| `labour-force-count-modelled`          | Labour force by sex and age — ILO modelled estimates                                               | Thousands  |
| `employment-count-modelled`            | Employment by sex and age — ILO modelled estimates                                                 | Thousands  |
| `unemployment-count-modelled`          | Unemployment by sex and age — ILO modelled estimates                                               | Thousands  |
| `lu2-rate-modelled`                    | LU2 combined rate of time-related underemployment and unemployment by sex — ILO modelled estimates | Percentage |
| `lu3-rate-modelled`                    | LU3 combined rate of unemployment and potential labour force by sex — ILO modelled estimates       | Percentage |
| `lu4-rate-modelled`                    | LU4 composite rate of labour underutilization by sex — ILO modelled estimates                      | Percentage |
| `average-hours-modelled`               | Average weekly hours actually worked per employed person by sex — ILO modelled estimates           | Hours      |
| `neet-count-modelled`                  | NEET: youth not in employment, education or training by sex — ILO modelled estimates               | Thousands  |

The phrases are checked against ILOSTAT's [ILO Modelled Estimates catalogue](https://ilostat.ilo.org/databases/iloest/). Catalogue availability does not imply a table is present in a local snapshot; the snapshot manifest records retrieved IDs and coverage. Unit classes control validation and display only; they do not supply denominators for recomputed statistics.
