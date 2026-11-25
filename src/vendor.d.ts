declare module "world-atlas/countries-110m.json" {
  const topology: import("topojson-specification").Topology<{
    countries: import("topojson-specification").GeometryCollection;
  }>;
  export default topology;
}
declare module "*.css";
