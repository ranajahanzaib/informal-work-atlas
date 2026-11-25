# Visualization system

The interface uses a paper-and-ink palette, editorial serif display type, sans-serif controls, and tabular statistical values. React renders a Natural Earth country map from the `world-atlas` TopoJSON package through D3 Geo; map color scales use only returned country observations. Missing polygons are hatched. The map's Natural Earth projection is a compromise projection, not equal-area.

Time-series charts draw only returned observations and preserve gaps. The timeline changes the selected source year without interpolating between years. Country comparisons show source observations and do not create regional averages. The searchable table is the accessible alternative to the map, and CSV export includes the metadata fields preserved by the current snapshot.

Every visual is driven by the active ILOSTAT snapshot. If a selection has no mapped observations, the interface states that directly instead of falling back to another indicator or presenting missing values as low values.
