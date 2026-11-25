import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import isoCountries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Compass,
  Database,
  ExternalLink,
  Globe2,
  Info,
  Layers3,
  Map as MapIcon,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

isoCountries.registerLocale(en);

type Indicator = {
  key: string;
  id?: string;
  label: string;
  unit_kind?: string;
  unit?: string;
  observations?: number;
  reference_areas?: number;
  year_start?: number;
  year_end?: number;
  release?: string;
  database?: string;
  classifications?: Record<string, string[]>;
  classification_labels?: Record<string, Record<string, string>>;
};
type Observation = {
  indicator_key?: string;
  indicator_id?: string;
  indicator_label?: string;
  ref_area: string;
  ref_area_label?: string;
  year: number;
  value: number;
  unit?: string;
  sex?: string;
  sex_label?: string;
  source?: string;
  obs_status?: string;
  estimate_type?: string;
  release?: string;
  standard?: string;
  database?: string;
  classif1?: string;
  classif1_label?: string;
  classif2?: string;
  classif2_label?: string;
  [key: string]: unknown;
};
type Manifest = {
  available: boolean;
  message?: string;
  snapshot_id?: string;
  retrieved_at?: string;
  observations?: number;
  reference_area_count?: number;
  reference_areas?: string[];
  reference_area_labels?: Record<string, string>;
  sex_codes?: string[];
  sex_labels?: Record<string, string>;
  year_range?: number[];
  indicators?: Indicator[];
  validation?: Record<string, unknown>;
};
type Page = { path: string; label: string; icon: typeof Activity };

const pages: Page[] = [
  { path: "/", label: "Overview", icon: Compass },
  { path: "/atlas", label: "World atlas", icon: Globe2 },
  { path: "/countries", label: "Country explorer", icon: MapIcon },
  { path: "/compare", label: "Compare", icon: ArrowLeftRight },
  { path: "/trends", label: "Historical trends", icon: Activity },
  { path: "/informality", label: "Informality", icon: Layers3 },
  { path: "/youth", label: "Youth & generations", icon: BarChart3 },
  { path: "/gender", label: "Gender & work", icon: Activity },
  { path: "/poverty", label: "Working poverty", icon: BarChart3 },
  { path: "/employment", label: "Employment structure", icon: Layers3 },
  {
    path: "/relationships",
    label: "Relationship explorer",
    icon: ArrowLeftRight,
  },
  { path: "/data", label: "Data explorer", icon: Database },
  { path: "/data/coverage", label: "Data coverage", icon: Globe2 },
  { path: "/methodology", label: "Methodology", icon: BookOpen },
  { path: "/sources", label: "Sources", icon: ExternalLink },
];

const sectionText: Record<
  string,
  { kicker: string; title: string; intro: string }
> = {
  "/": {
    kicker: "INTERNATIONAL LABOUR STATISTICS",
    title: "The world at work.",
    intro:
      "Explore how employment conditions differ across countries and how work has changed over time.",
  },
  "/atlas": {
    kicker: "WORLD ATLAS",
    title: "Work, mapped.",
    intro:
      "Explore the geographic distribution of available labour-market observations.",
  },
  "/countries": {
    kicker: "COUNTRY EXPLORER",
    title: "A closer look at work.",
    intro:
      "Choose a reference area to inspect its available indicator series and source metadata.",
  },
  "/compare": {
    kicker: "COMPARISON STUDIO",
    title: "Compare countries.",
    intro:
      "Review observations for selected reference areas under one indicator and year range.",
  },
  "/trends": {
    kicker: "HISTORICAL TRENDS",
    title: "How work changes.",
    intro:
      "Follow observed values through time while preserving gaps in the source series.",
  },
  "/informality": {
    kicker: "INFORMALITY OBSERVATORY",
    title: "Beyond formal employment.",
    intro:
      "Explore ILOSTAT modelled informal-employment observations where available.",
  },
  "/youth": {
    kicker: "YOUTH & GENERATIONS",
    title: "Young people and work.",
    intro:
      "Explore youth labour-market measures such as unemployment and NEET where available.",
  },
  "/gender": {
    kicker: "GENDER & WORK",
    title: "Work across sexes.",
    intro:
      "Compare reported female, male, and total values without treating missing groups as zero.",
  },
  "/poverty": {
    kicker: "WORKING POVERTY",
    title: "Work and economic security.",
    intro:
      "Working-poverty observations are not yet included in this selected source snapshot.",
  },
  "/employment": {
    kicker: "EMPLOYMENT STRUCTURE",
    title: "What work looks like.",
    intro:
      "Explore available employment status, economic activity, and occupation series.",
  },
  "/relationships": {
    kicker: "RELATIONSHIP EXPLORER",
    title: "Explore indicators together.",
    intro:
      "This workspace presents source observations side by side; it does not infer causal relationships.",
  },
  "/data": {
    kicker: "DATA EXPLORER",
    title: "Inspect the observations.",
    intro:
      "Filter the available source records, inspect their classifications, and export the current selection.",
  },
  "/data/coverage": {
    kicker: "DATA COVERAGE",
    title: "See where data exists.",
    intro:
      "Coverage reflects the selected snapshot and can vary by indicator, country, year, and classification.",
  },
};

const TOP = world as unknown as Topology<{ countries: GeometryObject }>;
const COUNTRY_FEATURES = (
  feature(
    TOP,
    TOP.objects.countries,
  ) as import("geojson").FeatureCollection<Geometry>
).features;
const fmt = (value: number, digits = 1) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(
    value,
  );
const countryName = (code: string, manifest?: Manifest | null) =>
  manifest?.reference_area_labels?.[code] ||
  isoCountries.getName(isoCountries.alpha3ToAlpha2(code) || code, "en") ||
  code;
const routeFromLocation = () =>
  window.location.pathname.replace(/\/$/, "") || "/";

async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function App() {
  const initial = new URLSearchParams(window.location.search);
  const [page, setPage] = useState(routeFromLocation());
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicator, setIndicator] = useState(
    initial.get("indicator") || "informal-rate-modelled",
  );
  const [country, setCountry] = useState(initial.get("country") || "");
  const [sex, setSex] = useState(initial.get("sex") || "");
  const [classification, setClassification] = useState(
    initial.get("classif1") || "",
  );
  const [year, setYear] = useState(initial.get("year") || "");
  const [startYear, setStartYear] = useState(initial.get("start_year") || "");
  const [endYear, setEndYear] = useState(initial.get("end_year") || "");
  const [compare, setCompare] = useState<string[]>(
    initial.get("countries")?.split(",").filter(Boolean) || [
      "PAK",
      "IND",
      "NGA",
    ],
  );
  const [observations, setObservations] = useState<Observation[]>([]);
  const [mapRows, setMapRows] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(
    initial.get("theme") || localStorage.getItem("iwa-theme") || "light",
  );
  const [navOpen, setNavOpen] = useState(false);
  const [selectedOnMap, setSelectedOnMap] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [playing, setPlaying] = useState(false);

  const activeIndicator = useMemo(
    () => indicators.find((item) => item.key === indicator),
    [indicators, indicator],
  );
  const years = useMemo(
    () =>
      [...new Set(observations.map((row) => row.year))].sort((a, b) => a - b),
    [observations],
  );
  const routeCountry = page.startsWith("/country/")
    ? page.split("/")[2]?.toUpperCase() || ""
    : "";
  const currentPage = page.startsWith("/country/")
    ? {
        path: page,
        label: countryName(routeCountry, manifest) || "Country profile",
        icon: MapIcon,
      }
    : pages.find((item) => item.path === page) || pages[0];
  const copy = routeCountry
    ? {
        kicker: "COUNTRY PROFILE",
        title: countryName(routeCountry, manifest),
        intro:
          "Inspect available observations and source metadata for this reference area.",
      }
    : sectionText[page] || sectionText["/countries"];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("iwa-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onPop = () => setPage(routeFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    api<Manifest>("/api/v1/metadata")
      .then((result) => {
        setManifest(result);
        const list = result.indicators || [];
        setIndicators(list);
        if (list.length && !list.some((item) => item.key === indicator))
          setIndicator(list[0].key);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!manifest?.available || !activeIndicator) {
      setLoading(false);
      setObservations([]);
      setMapRows([]);
      return;
    }
    const ctrl = new AbortController();
    const params = new URLSearchParams({ indicator, limit: "5000" });
    if (country && page !== "/compare") params.set("country", country);
    if (sex) params.set("sex", sex);
    if (classification) params.set("classif1", classification);
    if (page === "/compare" && compare.length)
      params.set("countries", compare.join(","));
    if (startYear) params.set("start_year", startYear);
    if (endYear) params.set("end_year", endYear);
    setLoading(true);
    setError("");
    const mapParams = new URLSearchParams({ indicator });
    if (year) mapParams.set("year", year);
    if (sex) mapParams.set("sex", sex);
    if (classification) mapParams.set("classif1", classification);
    Promise.all([
      api<{ observations: Observation[] }>(
        `/api/v1/observations?${params}`,
        ctrl.signal,
      ),
      api<{ observations: Observation[] }>(
        `/api/v1/map?${mapParams}`,
        ctrl.signal,
      ),
    ])
      .then(([series, map]) => {
        setObservations(series.observations || []);
        setMapRows(map.observations || []);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [
    indicator,
    country,
    sex,
    classification,
    startYear,
    endYear,
    year,
    page,
    compare,
    manifest?.available,
    activeIndicator,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!playing || years.length === 0) return;
      const current = Number(year || years.at(-1));
      const idx = years.indexOf(current);
      setYear(String(years[(idx + 1) % years.length]));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, years, year]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (indicator) params.set("indicator", indicator);
    if (country) params.set("country", country);
    if (sex) params.set("sex", sex);
    if (classification) params.set("classif1", classification);
    if (year) params.set("year", year);
    if (startYear) params.set("start_year", startYear);
    if (endYear) params.set("end_year", endYear);
    if (page === "/compare" && compare.length)
      params.set("countries", compare.join(","));
    const next = `${page}${params.size ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [
    page,
    indicator,
    country,
    sex,
    classification,
    year,
    startYear,
    endYear,
    compare,
  ]);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setPage(routeFromLocation());
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectCountry = (code: string) => {
    setCountry(code);
    setSelectedOnMap(code);
    if (page === "/") navigate("/country/" + code);
  };

  const exportCSV = () => {
    const rows = filteredObservations;
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const csv = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${indicator}-${country || "all-areas"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredObservations = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return observations.filter(
      (row) =>
        !q ||
        [
          row.ref_area,
          countryName(row.ref_area, manifest),
          row.year,
          row.value,
          row.sex_label,
          row.classif1_label,
          row.classif2_label,
          row.source,
          row.obs_status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  }, [observations, tableSearch, manifest]);

  useEffect(() => {
    if (routeCountry) setCountry(routeCountry);
  }, [routeCountry]);

  const displayedRows =
    page === "/compare" && compare.length
      ? observations.filter((row) => compare.includes(row.ref_area))
      : observations;
  const selectedLabel = country ? countryName(country, manifest) : "";
  const overviewObservation = useMemo(() => {
    const code =
      country ||
      (observations.some((row) => row.ref_area === "X01") ? "X01" : "");
    const series = observations.filter(
      (row) =>
        (!code || row.ref_area === code) && (row.sex === "SEX_T" || !row.sex),
    );
    const latestYear = Math.max(0, ...series.map((row) => row.year));
    return series.find((row) => row.year === latestYear) || null;
  }, [observations, country]);
  const yearsForMap = manifest?.year_range || [];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">I</div>
          <div>
            <b>Informal Work</b>
            <span>ATLAS · RESEARCH EDITION</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-label">EXPLORE</div>
        <nav aria-label="Research workspaces">
          {pages.slice(0, 12).map((item) => (
            <button
              key={item.path}
              className={`nav-item ${page === item.path || (item.path === "/countries" && page.startsWith("/country/")) ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
              {(page === item.path ||
                (item.path === "/countries" &&
                  page.startsWith("/country/"))) && (
                <span className="nav-indicator" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-rule" />
        <div className="nav-label">REFERENCE</div>
        {pages.slice(12).map((item) => (
          <button
            key={item.path}
            className={`nav-item ${page === item.path ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={17} strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="source-chip">
            <span
              className={`source-light ${manifest?.available ? "on" : ""}`}
            />
            <div>
              <b>
                {manifest?.available
                  ? "Snapshot available"
                  : "Source connection"}
              </b>
              <small>
                {manifest?.available
                  ? manifest.snapshot_id
                  : "No local data snapshot"}
              </small>
            </div>
          </div>
          <button className="nav-item" onClick={() => navigate("/sources")}>
            <CircleHelp size={17} />
            <span>About this atlas</span>
          </button>
        </div>
      </aside>

      {navOpen && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>Informal Work Atlas</span>
            <span className="crumb-sep">/</span>
            <b>{currentPage.label}</b>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={15} />
              <input
                aria-label="Search countries"
                placeholder="Find a country…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const match = (manifest?.reference_areas || []).find(
                      (code) =>
                        countryName(code, manifest)
                          .toLowerCase()
                          .includes(query.toLowerCase()) ||
                        code.toLowerCase() === query.toLowerCase(),
                    );
                    if (match) {
                      setCountry(match);
                      setSelectedOnMap(match);
                      if (page.startsWith("/country/"))
                        navigate("/country/" + match);
                    }
                  }
                }}
              />
              <kbd>↵</kbd>
            </div>
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="avatar" title="Independent research atlas">
              IW
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-rule" />
                {copy.kicker}
              </div>
              <h1>{copy.title}</h1>
              <p>{copy.intro}</p>
            </div>
            <div className="heading-actions">
              <button
                className="outline-button"
                onClick={() => navigate("/methodology")}
              >
                <Info size={15} /> How to read this
              </button>
              <button
                className="solid-button"
                onClick={exportCSV}
                disabled={!observations.length}
              >
                <ArrowDownToLine size={15} /> Export data
              </button>
            </div>
          </section>

          {page === "/methodology" ? (
            <Methodology />
          ) : page === "/sources" ? (
            <Sources manifest={manifest} />
          ) : (
            <>
              <section className="control-strip" aria-label="Data filters">
                <label className="control-field indicator-control">
                  <span>INDICATOR</span>
                  <select
                    value={indicator}
                    onChange={(e) => {
                      setIndicator(e.target.value);
                      setClassification("");
                    }}
                  >
                    {indicators.map((item) => (
                      <option value={item.key} key={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label className="control-field">
                  <span>COUNTRY / AREA</span>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="">All available areas</option>
                    {(manifest?.reference_areas || []).map((code) => (
                      <option value={code} key={code}>
                        {countryName(code, manifest)} · {code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label className="control-field">
                  <span>SEX</span>
                  <select value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="">All groups</option>
                    {(manifest?.sex_codes || []).map((code) => (
                      <option key={code} value={code}>
                        {manifest?.sex_labels?.[code] || code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                {activeIndicator?.classifications?.classif1?.length ? (
                  <label className="control-field">
                    <span>CLASSIFICATION</span>
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                    >
                      <option value="">All classifications</option>
                      {activeIndicator.classifications.classif1.map((code) => (
                        <option key={code} value={code}>
                          {activeIndicator.classification_labels?.classif1?.[
                            code
                          ] || code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                ) : null}
                <label className="control-field year-control">
                  <span>REFERENCE YEAR</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="">Latest available</option>
                    {Array.from(
                      {
                        length: Math.max(
                          0,
                          (yearsForMap[1] || 0) - (yearsForMap[0] || 0) + 1,
                        ),
                      },
                      (_, i) => (yearsForMap[1] || 0) - i,
                    ).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label className="control-field small-control">
                  <span>FROM</span>
                  <input
                    inputMode="numeric"
                    aria-label="From year"
                    placeholder="Year"
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                  />
                </label>
                <label className="control-field small-control">
                  <span>TO</span>
                  <input
                    inputMode="numeric"
                    aria-label="To year"
                    placeholder="Year"
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                  />
                </label>
                <button
                  className="reset-button"
                  onClick={() => {
                    setCountry("");
                    setSex("");
                    setClassification("");
                    setYear("");
                    setStartYear("");
                    setEndYear("");
                    setTableSearch("");
                    if (page.startsWith("/country/")) navigate("/countries");
                  }}
                  title="Clear filters"
                >
                  Reset
                </button>
              </section>

              {!manifest?.available && (
                <div className="notice notice-warn">
                  <Info size={18} />
                  <div>
                    <b>Awaiting a validated ILOSTAT snapshot</b>
                    <p>
                      {manifest?.message ||
                        "No observations are bundled with this source checkout. Run the documented refresh command when the ILOSTAT bulk service is reachable."}
                    </p>
                  </div>
                  <button onClick={() => navigate("/sources")}>
                    Data source details <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {error && (
                <div className="notice notice-error">
                  <Info size={18} />
                  <div>
                    <b>Could not load the selected data</b>
                    <p>{error}</p>
                  </div>
                  <button onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </div>
              )}

              {page === "/poverty" ? (
                <section className="panel prose">
                  <span className="panel-kicker">SOURCE COVERAGE</span>
                  <h2>Working poverty data is not in this snapshot</h2>
                  <p>
                    The current selected ILOSTAT source series do not include
                    working-poverty observations. No substitute series or
                    calculated values are shown here.
                  </p>
                  <button
                    className="outline-button"
                    onClick={() => navigate("/sources")}
                  >
                    Review source coverage <ArrowUpRight size={14} />
                  </button>
                </section>
              ) : page === "/relationships" ? (
                <section className="panel prose">
                  <span className="panel-kicker">STATISTICAL ANALYSIS</span>
                  <h2>Relationship analysis needs comparable series</h2>
                  <p>
                    This analysis is unavailable in the current release.
                    Correlation estimates require aligned observations,
                    compatible definitions, and a documented method. The app
                    will not infer relationships from unmatched series.
                  </p>
                </section>
              ) : page === "/" ? (
                <>
                  <div className="metric-row">
                    <Metric
                      label="Latest available value"
                      value={
                        overviewObservation
                          ? fmt(overviewObservation.value)
                          : "—"
                      }
                      note={
                        overviewObservation
                          ? `${countryName(overviewObservation.ref_area, manifest)} · ${overviewObservation.year} · modelled`
                          : selectedLabel ||
                            "Choose an area with an available observation"
                      }
                      unit={unitLabel(activeIndicator)}
                    />
                    <Metric
                      label="Reference areas"
                      value={fmt(manifest?.reference_area_count || 0, 0)}
                      note="Areas represented in snapshot"
                    />
                    <Metric
                      label="Observation records"
                      value={fmt(manifest?.observations || 0, 0)}
                      note="Across selected series"
                    />
                    <Metric
                      label="Source release"
                      value={manifest?.snapshot_id?.slice(0, 8) || "—"}
                      note={
                        manifest?.retrieved_at
                          ? `Retrieved ${manifest.retrieved_at.slice(0, 10)}`
                          : "No snapshot published"
                      }
                    />
                  </div>
                  <div className="atlas-layout">
                    <section className="panel map-panel">
                      <PanelHeading
                        kicker="GEOGRAPHIC DISTRIBUTION"
                        title={
                          activeIndicator?.label || "Labour market indicator"
                        }
                        note={
                          year
                            ? `Reference year · ${year}`
                            : "Latest available observation by area"
                        }
                      />
                      <WorldMap
                        rows={mapRows}
                        year={year}
                        selected={selectedOnMap || country}
                        manifest={manifest}
                        onSelect={selectCountry}
                      />
                      <div className="map-footer">
                        <div className="map-legend">
                          <span>Lower</span>
                          <i />
                          <span>Higher</span>
                          <em>Hatched · no observation</em>
                        </div>
                        <span className="map-source">
                          Source: ILOSTAT modelled estimates
                        </span>
                      </div>
                    </section>
                    <CountryInspector
                      code={selectedOnMap || country}
                      rows={observations}
                      manifest={manifest}
                      indicator={activeIndicator}
                      onCompare={() => {
                        const code = selectedOnMap || country;
                        if (code) {
                          setCompare((list) =>
                            list.includes(code)
                              ? list
                              : [...list, code].slice(-6),
                          );
                          navigate("/compare");
                        }
                      }}
                      onOpen={(code) => navigate("/country/" + code)}
                    />
                  </div>
                  <div className="lower-grid">
                    <section className="panel trend-panel">
                      <PanelHeading
                        kicker="OBSERVED SERIES"
                        title={
                          country
                            ? `${selectedLabel} over time`
                            : "Historical observations"
                        }
                        note="Source gaps remain visible"
                      />
                      <TrendChart
                        rows={observations}
                        indicator={activeIndicator}
                      />
                    </section>
                    <section className="panel coverage-panel">
                      <PanelHeading
                        kicker="DATA AVAILABILITY"
                        title="Coverage at a glance"
                        note="Current snapshot"
                      />
                      <CoverageSummary
                        rows={observations}
                        manifest={manifest}
                      />
                    </section>
                  </div>
                </>
              ) : (
                <Workspace
                  page={page}
                  country={routeCountry || country}
                  rows={displayedRows}
                  filtered={filteredObservations}
                  allRows={observations}
                  mapRows={mapRows}
                  indicator={activeIndicator}
                  manifest={manifest}
                  loading={loading}
                  compare={compare}
                  setCompare={setCompare}
                  tableSearch={tableSearch}
                  setTableSearch={setTableSearch}
                  exportCSV={exportCSV}
                  onMapSelect={selectCountry}
                  playing={playing}
                  setPlaying={setPlaying}
                  year={year}
                  setYear={setYear}
                  years={years}
                />
              )}
              <footer className="page-footer">
                <span>
                  Independent research platform · Not an official ILO product
                </span>
                <span>
                  {manifest?.snapshot_id
                    ? `Snapshot ${manifest.snapshot_id}`
                    : "ILOSTAT bulk data · Source status not yet refreshed"}
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  unit,
}: {
  label: string;
  value: string;
  note: string;
  unit?: string;
}) {
  return (
    <article className="metric">
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <span className="metric-note">{note}</span>
    </article>
  );
}
function PanelHeading({
  kicker,
  title,
  note,
}: {
  kicker: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <span className="panel-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {note && <span className="panel-note">{note}</span>}
    </div>
  );
}
function latestValue(rows: Observation[]) {
  if (!rows.length) return "—";
  const latest = Math.max(...rows.map((row) => row.year));
  const row =
    rows.find((item) => item.year === latest && item.sex === "SEX_T") ||
    rows.find((item) => item.year === latest);
  return row ? fmt(row.value) : "—";
}
function unitLabel(indicator?: Indicator) {
  return indicator?.unit_kind === "percentage"
    ? "%"
    : indicator?.unit_kind === "thousands"
      ? "thousand"
      : indicator?.unit_kind || "";
}

function WorldMap({
  rows,
  year,
  selected,
  manifest,
  onSelect,
}: {
  rows: Observation[];
  year: string;
  selected: string;
  manifest: Manifest | null;
  onSelect: (code: string) => void;
}) {
  const width = 900,
    height = 440;
  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitSize([width - 28, height - 28], { type: "Sphere" }),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const values = useMemo(() => {
    const byCode = new Map<string, Observation>();
    const filtered = rows.filter((row) => !year || String(row.year) === year);
    for (const row of filtered)
      if (!byCode.has(row.ref_area) || row.sex === "SEX_T")
        byCode.set(row.ref_area, row);
    return byCode;
  }, [rows, year]);
  const numericIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of Object.keys(isoCountries.getAlpha3Codes())) {
      const numeric = isoCountries.alpha3ToNumeric(code);
      if (numeric) map.set(String(Number(numeric)), code);
    }
    return map;
  }, []);
  const vals = [...values.values()].map((row) => row.value);
  const min = vals.length ? Math.min(...vals) : 0,
    max = vals.length ? Math.max(...vals) : 1;
  const color = (v: number) => {
    const t = Math.min(1, Math.max(0, (v - min) / (max - min || 1)));
    const r = Math.round(230 - 206 * t),
      g = Math.round(237 - 130 * t),
      b = Math.round(227 - 130 * t);
    return `rgb(${r},${g},${b})`;
  };
  return (
    <div className="map-stage">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`World map of ${year ? `observations for ${year}` : "latest available observations"}`}
      >
        <defs>
          <pattern
            id="missing-hatch"
            width="6"
            height="6"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--map-missing)"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <path
          d={path({ type: "Sphere" }) || ""}
          fill="var(--map-ocean)"
          stroke="var(--map-grid)"
          strokeWidth="0.6"
        />
        {COUNTRY_FEATURES.map((feature, index) => {
          const numeric = String(Number(feature.id));
          const code = numericIds.get(numeric) || "";
          const row = values.get(code);
          const d = path(feature as Feature<Geometry>);
          if (!d) return null;
          return (
            <path
              key={`${feature.id}-${index}`}
              d={d}
              fill={row ? color(row.value) : "url(#missing-hatch)"}
              className={`map-country ${selected === code ? "selected" : ""} ${row ? "has-data" : ""}`}
              tabIndex={row ? 0 : -1}
              role={row ? "button" : undefined}
              aria-label={
                row
                  ? `${countryName(code, manifest)} ${fmt(row.value)} ${year || row.year}`
                  : `${code || "Area"}: no observation`
              }
              onClick={() => row && onSelect(code)}
              onKeyDown={(e) => {
                if (row && (e.key === "Enter" || e.key === " ")) onSelect(code);
              }}
            >
              <title>
                {row
                  ? `${countryName(code, manifest)} · ${fmt(row.value)} · ${year || row.year}`
                  : "No observation in selected year"}
              </title>
            </path>
          );
        })}
      </svg>
      {!rows.length && (
        <div className="map-empty">
          <Globe2 size={26} />
          <b>
            {manifest?.available
              ? "No country values for this selection"
              : "No published data snapshot"}
          </b>
          <span>
            {manifest?.available
              ? "The source may cover aggregates or other years; missing country observations remain unavailable."
              : "Map colors appear after a validated ILOSTAT snapshot is published."}
          </span>
        </div>
      )}
      <div className="map-tools">
        <span>Natural Earth · compromise projection</span>
        <button title="Reset map view" onClick={() => onSelect("")}>
          Reset selection
        </button>
      </div>
    </div>
  );
}

function CountryInspector({
  code,
  rows,
  manifest,
  indicator,
  onCompare,
  onOpen,
}: {
  code: string;
  rows: Observation[];
  manifest: Manifest | null;
  indicator?: Indicator;
  onCompare: () => void;
  onOpen: (code: string) => void;
}) {
  const series = rows
    .filter((row) => row.ref_area === code && row.sex === "SEX_T")
    .sort((a, b) => a.year - b.year);
  const latest = series.at(-1);
  return (
    <aside className="panel inspector-panel">
      <div className="inspector-top">
        <span className="panel-kicker">COUNTRY INSPECTOR</span>
        <button className="icon-button" aria-label="More country information">
          <ArrowUpRight size={16} />
        </button>
      </div>
      {code ? (
        <>
          <div className="country-monogram">{code.slice(0, 2)}</div>
          <h2>{countryName(code, manifest)}</h2>
          <p className="country-code">REFERENCE AREA · {code}</p>
          <div className="inspector-rule" />
          <span className="panel-kicker">
            {indicator?.label || "Selected indicator"}
          </span>
          <div className="inspector-value">
            {latest ? fmt(latest.value) : "—"}
            <small>{unitLabel(indicator)}</small>
          </div>
          <p className="inspector-meta">
            {latest
              ? `Latest available · ${latest.year}`
              : "No comparable observation for selected area"}
          </p>
          <div className="inspector-spark">
            <MiniLine rows={series} />
          </div>
          <div className="inspector-provenance">
            <span>ESTIMATE TYPE</span>
            <b>{latest?.estimate_type || "ILOSTAT modelled"}</b>
            <span>RELEASE</span>
            <b>
              {latest?.release || indicator?.release || "See source manifest"}
            </b>
            <span>STATUS</span>
            <b>{latest?.obs_status || "Source status retained"}</b>
          </div>
          <div className="inspector-actions">
            <button className="solid-button" onClick={() => onOpen(code)}>
              Country profile <ArrowUpRight size={14} />
            </button>
            <button className="outline-button" onClick={onCompare}>
              Add to compare
            </button>
          </div>
        </>
      ) : (
        <div className="inspector-blank">
          <Globe2 size={28} />
          <b>Select a country on the map</b>
          <span>
            Choose a mapped area to inspect its latest value and source details.
          </span>
        </div>
      )}
    </aside>
  );
}

function MiniLine({ rows }: { rows: Observation[] }) {
  if (rows.length < 2)
    return (
      <div className="mini-line-empty">A longer series is not available</div>
    );
  const values = rows.map((row) => row.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const points = rows
    .map(
      (row, i) =>
        `${(i / (rows.length - 1)) * 100},${40 - ((row.value - min) / (max - min || 1)) * 36}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
      aria-label="Historical sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function TrendChart({
  rows,
  indicator,
}: {
  rows: Observation[];
  indicator?: Indicator;
}) {
  const data = useMemo(() => {
    const codes = new Set(rows.map((row) => row.ref_area));
    const code = codes.has("X01")
      ? "X01"
      : codes.size === 1
        ? [...codes][0]
        : "";
    if (!code) return [];
    return rows
      .filter(
        (row) =>
          (!code || row.ref_area === code) && (row.sex === "SEX_T" || !row.sex),
      )
      .sort((a, b) => a.year - b.year);
  }, [rows]);
  if (!data.length)
    return (
      <EmptyState
        title="Select a country to inspect its trend"
        body="The atlas does not average country observations into an overall series. Choose a reference area with an official aggregate if one is available."
      />
    );
  const width = 820,
    height = 260,
    left = 48,
    right = 16,
    top = 16,
    bottom = 34;
  const minYear = data[0].year,
    maxYear = data.at(-1)!.year,
    minValue = Math.min(...data.map((r) => r.value)),
    maxValue = Math.max(...data.map((r) => r.value));
  const x = (v: number) =>
    left + ((v - minYear) / (maxYear - minYear || 1)) * (width - left - right);
  const y = (v: number) =>
    height -
    bottom -
    ((v - minValue) / (maxValue - minValue || 1)) * (height - top - bottom);
  const segments: Observation[][] = [];
  let segment: Observation[] = [];
  let prior = 0;
  for (const row of data) {
    if (segment.length && row.year > prior + 1) {
      segments.push(segment);
      segment = [];
    }
    segment.push(row);
    prior = row.year;
  }
  if (segment.length) segments.push(segment);
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Time series of ${indicator?.label || "observations"}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const v = minValue + (maxValue - minValue) * t,
            yy = y(v);
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={yy}
                y2={yy}
                className="chart-grid"
              />
              <text
                x={left - 8}
                y={yy + 4}
                textAnchor="end"
                className="chart-axis"
              >
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((r) => `${x(r.year)},${y(r.value)}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
          />
        ))}
        {data.map((r, i) => (
          <circle
            key={i}
            cx={x(r.year)}
            cy={y(r.value)}
            r="3"
            fill="var(--accent)"
            tabIndex={0}
          >
            <title>
              {r.year}: {fmt(r.value)} {unitLabel(indicator)}
            </title>
          </circle>
        ))}
        <text x={left} y={height - 8} className="chart-axis">
          {minYear}
        </text>
        <text
          x={width - right}
          y={height - 8}
          textAnchor="end"
          className="chart-axis"
        >
          {maxYear}
        </text>
      </svg>
      <div className="chart-footnote">
        {data.length} observed values · missing years are shown as gaps ·{" "}
        {unitLabel(indicator)}
      </div>
    </div>
  );
}

function CoverageSummary({
  rows,
  manifest,
}: {
  rows: Observation[];
  manifest: Manifest | null;
}) {
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  const areas = [...new Set(rows.map((row) => row.ref_area))];
  return (
    <div className="coverage-content">
      <div className="coverage-numbers">
        <div>
          <b>{areas.length}</b>
          <span>areas in view</span>
        </div>
        <div>
          <b>{years.length}</b>
          <span>observed years</span>
        </div>
        <div>
          <b>{rows.length ? fmt(rows.length, 0) : "—"}</b>
          <span>records returned</span>
        </div>
      </div>
      <div
        className="coverage-years"
        role="img"
        aria-label="Available years in the current selection"
      >
        {Array.from({ length: Math.min(36, yearsFor(manifest)) }, (_, i) => {
          const year = yearsFor(manifest) - i;
          const on = years.includes(year);
          return (
            <span
              key={year}
              className={on ? "on" : ""}
              title={`${year}: ${on ? "observation present" : "no observation in current selection"}`}
            />
          );
        })}
      </div>
      <div className="coverage-legend">
        <span>
          <i className="covered-dot" />
          Observation present
        </span>
        <span>
          <i className="empty-dot" />
          No observation
        </span>
      </div>
      <p>
        Absence of an observation does not mean zero. Coverage is specific to
        the selected indicator and filters.
      </p>
    </div>
  );
}
function yearsFor(manifest: Manifest | null) {
  return manifest?.year_range?.[1] || new Date().getFullYear();
}

function Workspace({
  page,
  country,
  rows,
  filtered,
  allRows,
  mapRows,
  indicator,
  manifest,
  loading,
  compare,
  setCompare,
  tableSearch,
  setTableSearch,
  exportCSV,
  onMapSelect,
  playing,
  setPlaying,
  year,
  setYear,
  years,
}: {
  page: string;
  country: string;
  rows: Observation[];
  filtered: Observation[];
  allRows: Observation[];
  mapRows: Observation[];
  indicator?: Indicator;
  manifest: Manifest | null;
  loading: boolean;
  compare: string[];
  setCompare: React.Dispatch<React.SetStateAction<string[]>>;
  tableSearch: string;
  setTableSearch: (v: string) => void;
  exportCSV: () => void;
  onMapSelect: (v: string) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  year: string;
  setYear: (v: string) => void;
  years: number[];
}) {
  if (page.startsWith("/country/"))
    return (
      <div className="research-grid">
        <section className="panel wide-panel">
          <PanelHeading
            kicker="COUNTRY PROFILE"
            title={
              country ? countryName(country, manifest) : "Select a country"
            }
            note={country}
          />
          <div className="profile-stat-grid">
            <Metric
              label="Latest available value"
              value={latestValue(rows)}
              note={indicator?.label || "Selected indicator"}
              unit={unitLabel(indicator)}
            />
            <Metric
              label="Observed years"
              value={String(new Set(rows.map((r) => r.year)).size)}
              note="Years in current series"
            />
            <Metric
              label="Source records"
              value={fmt(rows.length, 0)}
              note="Returned under current filters"
            />
          </div>
          <TrendChart rows={rows} indicator={indicator} />
        </section>
        <section className="panel">
          <PanelHeading kicker="GEOGRAPHY" title="Country location" />
          <WorldMap
            rows={mapRows}
            year={year}
            selected={country}
            manifest={manifest}
            onSelect={onMapSelect}
          />
          <button
            className="text-button"
            onClick={() =>
              setCompare((list) =>
                list.includes(country) ? list : [...list, country].slice(-6),
              )
            }
          >
            Add this country to comparison <ArrowUpRight size={14} />
          </button>
        </section>
        <DataTable
          rows={rows}
          search={tableSearch}
          setSearch={setTableSearch}
          exportCSV={exportCSV}
          loading={loading}
        />
      </div>
    );
  if (page === "/compare")
    return (
      <div className="research-grid">
        <section className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">COUNTRY COMPARISON</span>
              <h2>Selected countries</h2>
            </div>
            <label className="add-country">
              Add country
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    setCompare((list) =>
                      list.includes(e.target.value)
                        ? list
                        : [...list, e.target.value].slice(-6),
                    );
                }}
              >
                <option value="">Choose…</option>
                {(manifest?.reference_areas || []).map((code) => (
                  <option key={code} value={code}>
                    {countryName(code, manifest)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="compare-chips">
            {compare.map((code) => (
              <button
                key={code}
                onClick={() =>
                  setCompare((list) => list.filter((c) => c !== code))
                }
              >
                {countryName(code, manifest)} <X size={13} />
              </button>
            ))}
          </div>
          <ComparisonChart
            rows={rows}
            codes={compare}
            manifest={manifest}
            indicator={indicator}
          />
        </section>
        <section className="panel">
          <PanelHeading kicker="COMPARABILITY" title="Source context" />
          <div className="prose">
            <p>
              Values are compared only within the selected indicator series.
              They retain the estimate type and statistical dimensions provided
              by ILOSTAT.
            </p>
            <p>
              This workspace does not calculate a world or regional average and
              does not infer that a higher value is better or worse.
            </p>
          </div>
        </section>
        <DataTable
          rows={rows}
          search={tableSearch}
          setSearch={setTableSearch}
          exportCSV={exportCSV}
          loading={loading}
        />
      </div>
    );
  if (page === "/atlas" || page === "/data/coverage")
    return (
      <div className="research-grid">
        <section className="panel wide-panel">
          <PanelHeading
            kicker={
              page === "/atlas"
                ? "INTERACTIVE WORLD ATLAS"
                : "OBSERVATION COVERAGE"
            }
            title={indicator?.label || "Available observations"}
            note={year ? `Year · ${year}` : "Latest available"}
          />
          <WorldMap
            rows={mapRows}
            year={year}
            selected={country}
            manifest={manifest}
            onSelect={onMapSelect}
          />
          <Timeline
            years={years}
            year={year}
            setYear={setYear}
            playing={playing}
            setPlaying={setPlaying}
          />
        </section>
        <section className="panel">
          <PanelHeading kicker="COVERAGE" title="Current selection" />
          <CoverageSummary rows={allRows} manifest={manifest} />
        </section>
        <DataTable
          rows={rows}
          search={tableSearch}
          setSearch={setTableSearch}
          exportCSV={exportCSV}
          loading={loading}
        />
      </div>
    );
  if (page === "/data")
    return (
      <div className="research-grid">
        <DataTable
          rows={filtered}
          search={tableSearch}
          setSearch={setTableSearch}
          exportCSV={exportCSV}
          loading={loading}
        />
        <section className="panel">
          <PanelHeading
            kicker="OBSERVATION DEFINITIONS"
            title="Read each record carefully"
          />
          <div className="prose">
            <p>
              Every row is an observation for a reference area, year, and
              classification. The indicator definition and denominator come from
              the original source series.
            </p>
            <p>
              Missing values are not represented as zero. Modelled estimates and
              nationally reported data are separate modes and are never silently
              combined.
            </p>
            <p>
              Exported CSV rows include the metadata fields preserved by the
              current snapshot.
            </p>
          </div>
        </section>
      </div>
    );
  return (
    <div className="research-grid">
      <section className="panel wide-panel">
        <PanelHeading
          kicker={sectionText[page]?.kicker || "RESEARCH WORKSPACE"}
          title={indicator?.label || "Selected series"}
          note={
            country
              ? `${countryName(country, manifest)} · ${country}`
              : "All reference areas"
          }
        />
        <div className="series-summary">
          <Metric
            label="Observations"
            value={fmt(rows.length, 0)}
            note="In current query"
          />
          <Metric
            label="Reference areas"
            value={String(new Set(rows.map((r) => r.ref_area)).size)}
            note="With returned observations"
          />
          <Metric
            label="Years covered"
            value={
              years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—"
            }
            note="Observed range"
          />
          <Metric
            label="Data type"
            value="Modelled"
            note="Source series classification"
          />
        </div>
        <TrendChart rows={rows} indicator={indicator} />
      </section>
      <section className="panel">
        <PanelHeading kicker="AVAILABLE INDICATORS" title="Related measures" />
        <div className="indicator-list">
          {(manifest?.indicators || []).map((item) => (
            <button
              className={item.key === indicator?.key ? "selected" : ""}
              key={item.key}
              onClick={() => {
                const sel = document.querySelector<HTMLSelectElement>(
                  ".indicator-control select",
                );
                if (sel) {
                  sel.value = item.key;
                  sel.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }}
            >
              <span>{item.label}</span>
              <small>{fmt(item.observations || 0, 0)} observations</small>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <CoverageSummary rows={allRows} manifest={manifest} />
      </section>
      <DataTable
        rows={rows}
        search={tableSearch}
        setSearch={setTableSearch}
        exportCSV={exportCSV}
        loading={loading}
      />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Database size={22} />
      <b>{title}</b>
      <span>{body}</span>
    </div>
  );
}

function ComparisonChart({
  rows,
  codes,
  manifest,
  indicator,
}: {
  rows: Observation[];
  codes: string[];
  manifest: Manifest | null;
  indicator?: Indicator;
}) {
  const latestByCode = codes.map((code) => {
    const series = rows.filter(
      (r) => r.ref_area === code && (r.sex === "SEX_T" || !r.sex),
    );
    const max = Math.max(0, ...series.map((r) => r.year));
    return { code, row: series.find((r) => r.year === max) };
  });
  if (!latestByCode.some((x) => x.row))
    return (
      <EmptyState
        title="No comparable values in this selection"
        body="Change the indicator, country, or year filters. Only source observations are compared."
      />
    );
  const max = Math.max(
    ...latestByCode.flatMap((x) => (x.row ? [x.row.value] : [0])),
    1,
  );
  return (
    <div className="comparison-chart">
      {latestByCode.map(({ code, row }) => (
        <div className="compare-bar-row" key={code}>
          <span>{countryName(code, manifest)}</span>
          <div>
            <i style={{ width: `${row ? (row.value / max) * 100 : 0}%` }} />
          </div>
          <b>
            {row
              ? `${fmt(row.value)} ${unitLabel(indicator)}`
              : "No observation"}
          </b>
          <small>{row?.year || "—"}</small>
        </div>
      ))}
    </div>
  );
}

function Timeline({
  years,
  year,
  setYear,
  playing,
  setPlaying,
}: {
  years: number[];
  year: string;
  setYear: (v: string) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  const values = years.length ? years : [0];
  const current = Number(year || values.at(-1));
  return (
    <div className="timeline">
      <button className="solid-button" onClick={() => setPlaying(!playing)}>
        {playing ? "Pause" : "Play"}
      </button>
      <input
        aria-label="Historical year"
        type="range"
        min={values[0]}
        max={values.at(-1)}
        value={current}
        onChange={(e) => setYear(e.target.value)}
        disabled={!years.length}
      />
      <span>{year || "Latest"}</span>
      <div className="timeline-ends">
        <small>{values[0] || "—"}</small>
        <small>{values.at(-1) || "—"}</small>
      </div>
    </div>
  );
}

function DataTable({
  rows,
  search,
  setSearch,
  exportCSV,
  loading,
}: {
  rows: Observation[];
  search: string;
  setSearch: (v: string) => void;
  exportCSV: () => void;
  loading: boolean;
}) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">SOURCE OBSERVATIONS</span>
          <h2>
            Data table <small>{fmt(rows.length, 0)} rows</small>
          </h2>
        </div>
        <button
          className="outline-button"
          onClick={exportCSV}
          disabled={!rows.length}
        >
          <ArrowDownToLine size={14} /> CSV
        </button>
      </div>
      <div className="table-toolbar">
        <div className="table-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search country, year, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span>Up to 5,000 records per query</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Reference area</th>
              <th>Year</th>
              <th>Sex</th>
              <th>Classification</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  Loading source observations…
                </td>
              </tr>
            ) : rows.length ? (
              rows.slice(0, 1000).map((row, i) => (
                <tr
                  key={`${row.ref_area}-${row.year}-${row.sex}-${row.classif1}-${i}`}
                >
                  <td>
                    <b>{row.ref_area_label || row.ref_area}</b>
                    <small>{row.ref_area}</small>
                  </td>
                  <td>{row.year}</td>
                  <td>{row.sex_label || row.sex || "—"}</td>
                  <td>
                    {[
                      row.classif1_label || row.classif1,
                      row.classif2_label || row.classif2,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="num-cell">{fmt(row.value, 2)}</td>
                  <td>{row.unit || "—"}</td>
                  <td>
                    <span className="status-tag">{row.obs_status || "—"}</span>
                  </td>
                  <td>{row.source || "ILOSTAT"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="table-empty">
                  No source observations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-bottom">
        <span>
          Showing {Math.min(rows.length, 1000).toLocaleString()} of{" "}
          {rows.length.toLocaleString()} returned records.
        </span>
        <span>Values retain publisher units and status codes.</span>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <div className="reference-page">
      <section className="panel prose">
        <span className="panel-kicker">STATISTICAL METHODOLOGY</span>
        <h2>How to interpret labour-market data</h2>
        <p>
          Informal employment, employment in the informal sector,
          self-employment, vulnerable employment, and working poverty are
          distinct concepts. The selected series’ definition and denominator are
          set by its source and must travel with its observations.
        </p>
        <h3>Modelled estimates and national observations</h3>
        <p>
          Modelled estimates are produced using a statistical model and may
          combine national observations with imputation. They are not equivalent
          to a direct observation from a country's survey. This atlas keeps
          estimate type, source, release, and observation status attached when
          supplied.
        </p>
        <h3>Missing values and gaps</h3>
        <p>
          An absent observation is not zero. The interface does not interpolate
          missing years. Timeline playback moves between available years and
          should not be interpreted as a continuous underlying measurement.
        </p>
        <h3>Comparisons and aggregation</h3>
        <p>
          Country percentages are not averaged to create regional rates.
          Cross-country comparisons should check reference year, age group, sex,
          unit, estimate type, and statistical standards before interpretation.
          No causal relationship is implied by a visual association.
        </p>
        <h3>Standards and limitations</h3>
        <p>
          Employment concepts and informal-economy standards have changed over
          time. This version exposes the source metadata but does not yet
          classify every structural break or guarantee comparability across
          methodological revisions.
        </p>
        <p>
          Informal Work Atlas is an independent exploration platform and is not
          an official ILO product.
        </p>
      </section>
      <section className="panel source-links">
        <PanelHeading kicker="PRIMARY SOURCES" title="Publisher references" />
        <a
          href="https://ilostat.ilo.org/data/"
          target="_blank"
          rel="noreferrer"
        >
          ILOSTAT data portal <ExternalLink size={15} />
        </a>
        <a
          href="https://ilostat.ilo.org/topics/informality/"
          target="_blank"
          rel="noreferrer"
        >
          ILOSTAT informality <ExternalLink size={15} />
        </a>
        <a
          href="https://ilostat.ilo.org/methods/concepts-and-definitions/"
          target="_blank"
          rel="noreferrer"
        >
          Concepts and definitions <ExternalLink size={15} />
        </a>
      </section>
    </div>
  );
}
function Sources({ manifest }: { manifest: Manifest | null }) {
  return (
    <div className="reference-page">
      <section className="panel">
        <PanelHeading
          kicker="SOURCE REGISTRY"
          title="ILOSTAT bulk data"
          note="Primary publisher"
        />
        <div className="source-summary">
          <div>
            <span>Snapshot</span>
            <b>{manifest?.snapshot_id || "Not available"}</b>
          </div>
          <div>
            <span>Retrieved</span>
            <b>{manifest?.retrieved_at || "No retrieval recorded"}</b>
          </div>
          <div>
            <span>Observations</span>
            <b>{fmt(manifest?.observations || 0, 0)}</b>
          </div>
          <div>
            <span>Reference areas</span>
            <b>{manifest?.reference_area_count || 0}</b>
          </div>
        </div>
        <a
          className="source-link-card"
          href="https://ilostat.ilo.org/data/bulk/"
          target="_blank"
          rel="noreferrer"
        >
          <div>
            <b>ILOSTAT bulk data facility</b>
            <span>
              Official International Labour Organization statistics and metadata
            </span>
          </div>
          <ExternalLink size={17} />
        </a>
        <div className="indicator-list">
          {(manifest?.indicators || []).map((item) => (
            <div className="indicator-source" key={item.key}>
              <span>{item.label}</span>
              <small>
                {item.id} · {item.database || "ILOSTAT"} · release{" "}
                {item.release || "unspecified"}
              </small>
              <small>
                {fmt(item.observations || 0, 0)} observations ·{" "}
                {item.year_start || "—"}–{item.year_end || "—"}
              </small>
            </div>
          ))}
        </div>
        <p className="fine-print">
          Licensing and redistribution terms are governed by the publisher for
          each source series. See the original ILOSTAT entry before
          republication.
        </p>
      </section>
      <section className="panel">
        <PanelHeading kicker="VALIDATION" title="Snapshot checks" />
        <div className="validation-list">
          <div>
            <span>Snapshot status</span>
            <b>{manifest?.available ? "Published" : "Unavailable"}</b>
          </div>
          <div>
            <span>Validation report</span>
            <b>{String(manifest?.validation?.status || "Not run")}</b>
          </div>
          <div>
            <span>Data methodology</span>
            <b>ILOSTAT modelled series</b>
          </div>
        </div>
        <p className="prose-small">
          A failed refresh leaves the previous published snapshot intact. This
          checkout does not include a prebuilt data snapshot.
        </p>
      </section>
    </div>
  );
}

export default App;
