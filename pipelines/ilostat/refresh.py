"""Selective ILOSTAT bulk-data discovery and snapshot publication.

Identifiers are resolved from the live official catalogue; no table codes are guessed.
The current published snapshot is replaced only after download and validation succeed.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import html.parser
import io
import json
import os
import re
import shutil
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://rplumber.ilo.org"
USER_AGENT = "Informal-Work-Atlas/0.1 (open research data client)"
CATALOGUE = f"{BASE}/metadata/toc/indicator?format=.csv"
DIC_INDEX = f"{BASE}/files/website/bulk/dic.html"
SELECTIONS = (
    ("informal-rate-modelled", "informal employment rate by sex -- ilo modelled estimates", "percentage"),
    ("informal-count-modelled", "informal employment by sex -- ilo modelled estimates", "thousands"),
    ("participation-rate-modelled", "labour force participation rate by sex and age -- ilo modelled estimates", "percentage"),
    ("employment-population-ratio-modelled", "employment-to-population ratio by sex and age -- ilo modelled estimates", "percentage"),
    ("unemployment-rate-modelled", "unemployment rate by sex and age -- ilo modelled estimates", "percentage"),
    ("neet-rate-modelled", "neet rate: share of youth not in employment, education or training by sex -- ilo modelled estimates", "percentage"),
    ("employment-sector-modelled", "employment by sex and economic activity -- ilo modelled estimates", "thousands"),
    ("employment-status-modelled", "employment by sex and status in employment -- ilo modelled estimates", "thousands"),
    ("employment-occupation-modelled", "employment by sex and occupation -- ilo modelled estimates", "thousands"),
    ("underemployment-rate-modelled", "time-related underemployment rate by sex and age -- ilo modelled estimates", "percentage"),
    ("labour-force-count-modelled", "labour force by sex and age -- ilo modelled estimates", "thousands"),
    ("employment-count-modelled", "employment by sex and age -- ilo modelled estimates", "thousands"),
    ("unemployment-count-modelled", "unemployment by sex and age -- ilo modelled estimates", "thousands"),
    ("lu2-rate-modelled", "lu2: combined rate of time-related underemployment and unemployment by sex -- ilo modelled estimates", "percentage"),
    ("lu3-rate-modelled", "lu3: combined rate of unemployment and potential labour force by sex -- ilo modelled estimates", "percentage"),
    ("lu4-rate-modelled", "lu4: composite rate of labour underutilization by sex -- ilo modelled estimates", "percentage"),
    ("average-hours-modelled", "average weekly hours actually worked per employed person by sex -- ilo modelled estimates", "hours"),
    ("neet-count-modelled", "neet: youth not in employment, education or training by sex -- ilo modelled estimates", "thousands"),
)


def fetch(url: str, attempts: int = 4) -> bytes:
    error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except (OSError, urllib.error.URLError) as exc:
            error = exc
            if attempt + 1 < attempts:
                time.sleep(min(2 ** attempt, 8))
    raise RuntimeError(f"Could not retrieve {url}: {error}")


def decode_table(blob: bytes):
    if blob[:2] == b"\x1f\x8b":
        blob = gzip.decompress(blob)
    return list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig", errors="replace"))))


class _LinkCollector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)


def dictionary_links(index: bytes, fields):
    """Resolve English ILO dictionary CSV links from the official DIC index."""
    parser = _LinkCollector()
    parser.feed(index.decode("utf-8", errors="replace"))
    links = []
    for href in parser.hrefs:
        url = urljoin(DIC_INDEX, href)
        parsed = urlparse(url)
        if parsed.hostname != "rplumber.ilo.org":
            continue
        if not (parsed.path.casefold().endswith(".csv") or ".csv" in parsed.query.casefold()):
            continue
        links.append(url)
    chosen = {}
    for field in fields:
        candidates = []
        for url in links:
            parsed = urlparse(url)
            filename = Path(parsed.path).name.casefold()
            qs = parse_qs(parsed.query)
            var = qs.get("var", [""])[0].casefold()
            if filename.startswith(field.casefold()) or var == field.casefold() or var == f"cl_{field}".casefold():
                candidates.append(url)
        # Prefer a specifically English dictionary when several locales exist.
        def _en_priority(url):
            parsed = urlparse(url)
            filename = Path(parsed.path).name.casefold()
            if "_en." in filename:
                return (0, url)
            qs = parse_qs(parsed.query)
            lang = qs.get("lang", [""])[0].casefold()
            if lang == "en":
                return (0, url)
            if not lang:
                return (1, url)
            return (2, url)
        candidates.sort(key=_en_priority)
        if candidates:
            chosen[field] = candidates[0]
    return chosen


def decode_dictionary(blob: bytes, field: str):
    rows = decode_table(blob)
    if not rows:
        return {}
    columns = list(rows[0])
    code_column = field if field in columns else next((c for c in columns if c.casefold() in {"code", "id"}), columns[0])
    label_column = next((c for c in (f"{field}.label", "label", f"{field}_label") if c in columns), None)
    if label_column is None:
        label_column = next((c for c in columns if c.casefold().endswith(".label")), None)
    if label_column is None:
        return {}
    return {r[code_column]: r[label_column] for r in rows if r.get(code_column) and r.get(label_column)}


def fetch_dictionaries(staging: Path, fields):
    """Best-effort enrichment: retain codes and report a warning if labels are unavailable."""
    warnings = []
    try:
        index = fetch(DIC_INDEX)
        (staging / "dictionary_index.html").write_bytes(index)
        urls = dictionary_links(index, fields)
    except RuntimeError as exc:
        return {}, [f"Could not retrieve official dictionary index: {exc}"]
    maps = {}
    for field in fields:
        url = urls.get(field)
        if not url:
            warnings.append(f"No English dictionary link found for {field}; source codes remain visible.")
            continue
        try:
            blob = fetch(url)
            (staging / "dictionaries").mkdir(exist_ok=True)
            parsed_path = urlparse(url)
            filename = Path(parsed_path.path).name
            if filename.endswith(".csv"):
                file_name = filename
            else:
                qs = parse_qs(parsed_path.query)
                var = qs.get("var", [field])[0]
                lang = qs.get("lang", ["en"])[0]
                file_name = f"{var}_{lang}.csv"
            (staging / "dictionaries" / file_name).write_bytes(blob)
            mapping = decode_dictionary(blob, field)
            if mapping:
                maps[field] = mapping
            else:
                warnings.append(f"Dictionary {file_name} did not expose a usable code/label pair; source codes remain visible.")
        except RuntimeError as exc:
            warnings.append(f"Could not retrieve dictionary for {field}: {exc}")
    return maps, warnings


def choose_tables(catalogue):
    chosen = []
    for slug, phrase, unit_kind in SELECTIONS:
        # Match the beginning of the publisher label. Substring matching would
        # mistake "employment" inside "unemployment" for the employment series.
        matches = [r for r in catalogue if (r.get("indicator.label", "").casefold()).startswith(phrase)
                   and r.get("freq", "").upper() == "A"]
        # Prefer the most recently updated catalogue row; preserve the official ID.
        matches.sort(key=lambda r: (r.get("last.update", ""), r.get("id", "")), reverse=True)
        if matches:
            chosen.append((slug, matches[0], unit_kind))
    if not chosen:
        raise RuntimeError("The live ILOSTAT catalogue did not contain any selected annual modelled series. No snapshot was published.")
    return chosen


def normalise(rows, indicator_id, indicator_label, slug, unit_kind=None):
    if not rows:
        raise RuntimeError(f"Dataset {indicator_id} has no observations")
    fields = set(rows[0])
    required = {"ref_area", "time", "obs_value"}
    if not required.issubset(fields):
        raise RuntimeError(f"Unexpected upstream schema for {indicator_id}; missing {sorted(required - fields)}")
    normalized = []
    seen = set()
    for row in rows:
        val = row.get("obs_value", "")
        if not val or val.strip().lower() in {"", "na", "nan", "null"}:
            continue
        try:
            value = float(val)
        except ValueError as exc:
            raise RuntimeError(f"Non-numeric non-missing observation {val!r} in {indicator_id}") from exc
        raw_year = row.get("time", "")
        if not re.fullmatch(r"\d{4}", raw_year):
            raise RuntimeError(f"Unexpected annual time value {raw_year!r} in {indicator_id}")
        year = int(raw_year)
        if not row.get("ref_area"):
            raise RuntimeError(f"Missing reference-area code in {indicator_id} for year {year}")
        if not (0 <= value <= 100 if unit_kind == "percentage" or "rate" in slug else value >= 0):
            raise RuntimeError(f"Invalid value {value} in {indicator_id}; refusing to publish")
        item = {
            "indicator_id": indicator_id, "indicator_key": slug,
            "indicator_label": indicator_label, "ref_area": row.get("ref_area", ""),
            "source": row.get("source", ""), "year": year, "freq": row.get("freq", "A"),
            "sex": row.get("sex", ""), "classif1": row.get("classif1", ""),
            "classif2": row.get("classif2", ""), "value": value,
            "unit": row.get("unit_measure") or row.get("unit") or unit_kind or "",
            "obs_status": row.get("obs_status", ""),
        }
        # Keep any additional upstream classification dimensions and all note fields.
        for field, field_value in row.items():
            if field.startswith("classif") or field.startswith("note_"):
                item[field] = field_value
        dimensions = sorted(k for k in item if k.startswith("classif"))
        key = tuple(item.get(k, "") for k in ("ref_area", "year", "freq", "sex", "source", *dimensions))
        if key in seen:
            raise RuntimeError(f"Duplicate observations found in {indicator_id} for {key}; refusing to pick one arbitrarily")
        seen.add(key)
        normalized.append(item)
    if not normalized:
        raise RuntimeError(f"No numeric observations found in {indicator_id}")
    return normalized


def refresh():
    now = datetime.now(timezone.utc).isoformat()
    staging = ROOT / "data" / "staging" / f"refresh-{time.time_ns()}"
    tables = staging / "tables"
    tables.mkdir(parents=True, exist_ok=False)
    try:
        catalogue_blob = fetch(CATALOGUE)
        (staging / "table_of_contents_en.csv").write_bytes(catalogue_blob)
        catalogue = decode_table(catalogue_blob)
        selected = choose_tables(catalogue)
        records, indicators = [], []
        tables_by_indicator = {}
        import csv as csv_module
        downloaded = {}
        previous = {}
        try:
            current_id = (ROOT / "data" / "processed" / "CURRENT").read_text(encoding="utf-8").strip()
            previous_path = ROOT / "data" / "processed" / "snapshots" / current_id
            previous_manifest = json.loads((previous_path / "manifest.json").read_text(encoding="utf-8"))
            previous = {entry["id"]: (entry.get("release", ""), previous_path / f"{entry['id']}.csv.gz")
                        for entry in previous_manifest.get("indicators", [])}
        except (OSError, ValueError, KeyError):
            previous = {}
        with ThreadPoolExecutor(max_workers=4) as pool:
            tasks = {}
            for slug, entry, unit_kind in selected:
                dataset_id = entry["id"]
                if not re.fullmatch(r"[A-Za-z0-9_.-]+", dataset_id):
                    raise RuntimeError(f"Unsafe catalogue dataset identifier: {dataset_id!r}")
                cached = previous.get(dataset_id)
                if cached and cached[0] == entry.get("last.update", "") and cached[1].is_file():
                    downloaded[slug] = (entry, unit_kind, cached[1].read_bytes())
                    print(f"Reusing unchanged source release: {entry.get('indicator.label', dataset_id)}")
                    continue
                tasks[pool.submit(fetch, f"{BASE}/data/indicator?id={dataset_id}&format=.csv.gz")] = (slug, entry, unit_kind)
            for task in as_completed(tasks):
                slug, entry, unit_kind = tasks[task]
                downloaded[slug] = (entry, unit_kind, task.result())
                print(f"Retrieved {len(downloaded)}/{len(selected)}: {entry.get('indicator.label', entry['id'])}")
        for slug, entry, unit_kind in selected:
            dataset_id = entry["id"]
            raw = downloaded[slug][2]
            (staging / f"{dataset_id}.csv.gz").write_bytes(raw)
            parsed = decode_table(raw)
            normalized = normalise(parsed, dataset_id, entry.get("indicator.label", dataset_id), slug, unit_kind)
            for row in normalized:
                row["database"] = entry.get("collection.label", entry.get("collection", ""))
                row["release"] = entry.get("last.update", "")
                row["estimate_type"] = "modelled"
                row["retrieved_at"] = now
            years = [r["year"] for r in normalized]
            indicators.append({"key": slug, "id": dataset_id, "label": entry.get("indicator.label", ""),
                               "database": entry.get("collection.label", entry.get("collection", "")),
                               "release": entry.get("last.update", ""), "unit_kind": unit_kind,
                               "frequency": entry.get("freq.label", "Annual"),
                               "observations": len(normalized), "reference_areas": len({r["ref_area"] for r in normalized}),
                               "missing_values": len(parsed) - len(normalized),
                               "classifications": {field: sorted({r[field] for r in normalized if r.get(field)})
                                                   for field in sorted({key for row in normalized for key in row if key.startswith("classif")})},
                               "year_start": min(years), "year_end": max(years),
                               "standard": "ILOSTAT modelled estimates; see series-specific source metadata"})
            records.extend(normalized)
            tables_by_indicator[slug] = normalized
        dictionary_fields = sorted({field for row in records for field in row
                                    if field in {"ref_area", "sex", "source"} or field.startswith("classif")})
        dictionary_maps, dictionary_warnings = fetch_dictionaries(staging, dictionary_fields)
        for row in records:
            for field, mapping in dictionary_maps.items():
                if row.get(field):
                    row[f"{field}_label"] = mapping.get(row[field], "")
        for indicator in indicators:
            indicator["classification_labels"] = {
                field: {code: dictionary_maps.get(field, {}).get(code, "") for code in codes}
                for field, codes in indicator["classifications"].items()
            }
        for slug, rows in tables_by_indicator.items():
            with (tables / f"{slug}.csv").open("w", newline="", encoding="utf-8") as output:
                writer = csv_module.DictWriter(output, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
        snapshot_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        checksums = {}
        for file in sorted(staging.rglob("*")):
            if file.is_file():
                checksums[str(file.relative_to(staging))] = hashlib.sha256(file.read_bytes()).hexdigest()
        manifest = {"snapshot_id": snapshot_id, "source": "ILOSTAT bulk download facility", "source_url": CATALOGUE,
                    "retrieved_at": now, "observations": len(records), "indicators": indicators,
                    "reference_area_count": len({r["ref_area"] for r in records}),
                    "reference_areas": sorted({r["ref_area"] for r in records}),
                    "reference_area_labels": dictionary_maps.get("ref_area", {}),
                    "sex_codes": sorted({r["sex"] for r in records if r["sex"]}),
                    "sex_labels": dictionary_maps.get("sex", {}),
                    "dictionaries": {"status": "complete" if not dictionary_warnings else "partial",
                                     "code_lists": sorted(dictionary_maps), "warnings": dictionary_warnings},
                    "classification_codes": {field: sorted({r[field] for r in records if r.get(field)})
                                              for field in sorted({key for row in records for key in row if key.startswith("classif")})},
                    "year_range": [min(r["year"] for r in records), max(r["year"] for r in records)],
                    "validation": {"status": "passed", "duplicate_observations": 0,
                                   "invalid_numeric_values": 0, "missing_values_preserved_as_absent": True},
                    "checksums_sha256": checksums,
                    "unavailable_indicators": [{"key": slug, "reason": "No matching annual table was present in the live catalogue."}
                                                for slug, phrase, _ in SELECTIONS if slug not in {k for k, _, _ in selected}],
                    "notes": "The observation status, source, classifications and notes are retained in each normalized table. Modelled series are not combined with nationally reported tables."}
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        target = ROOT / "data" / "processed" / "snapshots" / snapshot_id
        target.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging, target)
        current_tmp = ROOT / "data" / "processed" / ".CURRENT.tmp"
        current_tmp.write_text(snapshot_id + "\n", encoding="utf-8")
        os.replace(current_tmp, ROOT / "data" / "processed" / "CURRENT")
        print(f"Published {snapshot_id}: {len(records):,} observations across {len(indicators)} indicators")
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

