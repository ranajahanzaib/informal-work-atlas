"""Read and validate the latest atomically published ILOSTAT snapshot."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS = ROOT / "data" / "processed" / "snapshots"
CURRENT = ROOT / "data" / "processed" / "CURRENT"


def snapshot_path() -> Path | None:
    try:
        name = CURRENT.read_text(encoding="utf-8").strip()
        path = SNAPSHOTS / name
        if path.is_dir() and (path / "manifest.json").is_file():
            return path
    except OSError:
        pass
    return None


def manifest() -> dict[str, Any]:
    path = snapshot_path()
    if not path:
        return {"available": False, "message": "No validated ILOSTAT snapshot has been published. Run `make data` when network access is available."}
    return json.loads((path / "manifest.json").read_text(encoding="utf-8")) | {"available": True}


def observations(indicator: str | None = None, country: str | None = None, sex: str | None = None,
                 classif1: str | None = None, classif2: str | None = None,
                 start_year: int | None = None, end_year: int | None = None,
                 limit: int = 5000, countries: set[str] | None = None) -> list[dict[str, Any]]:
    path = snapshot_path()
    if not path:
        return []
    rows: list[dict[str, Any]] = []
    if indicator:
        if not re.fullmatch(r"[a-z0-9-]+", indicator):
            return []
        files = [(path / "tables" / f"{indicator}.csv")]
    else:
        files = sorted((path / "tables").glob("*.csv"))
    for file in files:
        if not file.is_file():
            continue
        with file.open(newline="", encoding="utf-8-sig") as stream:
            for row in csv.DictReader(stream):
                if indicator and row.get("indicator_key") != indicator:
                    continue
                if country and row.get("ref_area") != country.upper():
                    continue
                if countries and row.get("ref_area") not in countries:
                    continue
                if sex and row.get("sex") != sex:
                    continue
                if classif1 and row.get("classif1") != classif1:
                    continue
                if classif2 and row.get("classif2") != classif2:
                    continue
                try:
                    year = int(row.get("year", ""))
                    value = float(row.get("value", ""))
                except (TypeError, ValueError):
                    continue
                if start_year is not None and year < start_year:
                    continue
                if end_year is not None and year > end_year:
                    continue
                row["year"] = year
                row["value"] = value
                rows.append(row)
                if limit > 0 and len(rows) >= limit:
                    return rows
    return rows

