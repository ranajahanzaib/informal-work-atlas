"""Small dependency-free HTTP API and static application server."""
from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import data

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "dist"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._api(parsed.path, parse_qs(parsed.query))
            return
        if parsed.path == "/":
            self.path = "/index.html"
        if not WEB.is_dir():
            return self._json({"error": "The dashboard has not been built. Run `pnpm build` first."}, 503)
        if not (WEB / parsed.path.lstrip("/")).is_file() and "." not in Path(parsed.path).name:
            self.path = "/index.html"
        return super().do_GET()

    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _api(self, path, query):
        if path.startswith("/api/v1/"):
            return self._api_v1(path.removeprefix("/api/v1/"), query)
        if path == "/api/health":
            return self._json({"status": "ok", "snapshot": data.manifest()})
        if path == "/api/manifest":
            return self._json(data.manifest())
        if path == "/api/indicators":
            return self._json(data.manifest().get("indicators", []))
        if path == "/api/observations":
            try:
                def one(key): return query.get(key, [None])[0]
                def integer(key): return int(one(key)) if one(key) else None
                indicator = one("indicator")
                country = one("country").upper() if one("country") else None
                snapshot = data.manifest()
                selected = next((item for item in snapshot.get("indicators", []) if item["key"] == indicator), None)
                if indicator and not selected:
                    return self._json({"error": "Unsupported indicator for this snapshot."}, 400)
                if country and country not in snapshot.get("reference_areas", []):
                    return self._json({"error": "Unsupported reference area for this snapshot."}, 400)
                if one("sex") and one("sex") not in snapshot.get("sex_codes", []):
                    return self._json({"error": "Unsupported sex category for this snapshot."}, 400)
                for dimension in ("classif1", "classif2"):
                    if one(dimension) and (not selected or one(dimension) not in selected.get("classifications", {}).get(dimension, [])):
                        return self._json({"error": f"Unsupported {dimension} value for this indicator."}, 400)
                start_year, end_year = integer("start_year"), integer("end_year")
                if start_year and end_year and start_year > end_year:
                    return self._json({"error": "Start year must be earlier than or equal to end year."}, 400)
                rows = data.observations(indicator, country, one("sex"),
                                         one("classif1"), one("classif2"),
                                         start_year, end_year)
                return self._json({"count": len(rows), "observations": rows})
            except ValueError:
                return self._json({"error": "Year filters must be integers."}, 400)
        return self._json({"error": "Not found"}, 404)

    @staticmethod
    def _one(query, key, default=None):
        return query.get(key, [default])[0]

    @staticmethod
    def _integer(query, key):
        value = Handler._one(query, key)
        return int(value) if value else None

    def _api_v1(self, route, query):
        snapshot = data.manifest()
        indicators = snapshot.get("indicators", [])
        if route.startswith("indicators/"):
            parts = route.removeprefix("indicators/").split("/")
            indicator = next((item for item in indicators if item.get("key") == parts[0]), None)
            if not indicator:
                return self._json({"error": "Unsupported indicator for this snapshot."}, 404)
            if len(parts) == 1:
                return self._json(indicator)
            if len(parts) == 2 and parts[1] == "dimensions":
                return self._json(indicator.get("classifications", {}))
            if len(parts) == 2 and parts[1] == "coverage":
                return self._coverage(snapshot, {**query, "indicator": [parts[0]]})
            return self._json({"error": "Not found"}, 404)
        if route in {"health", "metadata"}:
            return self._json({"status": "ok", **snapshot}) if route == "health" else self._json(snapshot)
        if route == "indicators":
            return self._json(indicators)
        if route == "countries":
            labels = snapshot.get("reference_area_labels", {})
            areas = snapshot.get("reference_areas", [])
            return self._json([{"iso3": code, "name": labels.get(code, code), "is_aggregate": code.startswith("X")}
                               for code in areas])
        if route == "regions":
            return self._json([])
        if route in {"sources", "releases"}:
            return self._json({"source": snapshot.get("source", "ILOSTAT bulk download facility"),
                               "source_url": snapshot.get("source_url", "https://ilostat.ilo.org/data/bulk/"),
                               "retrieved_at": snapshot.get("retrieved_at"),
                               "snapshot_id": snapshot.get("snapshot_id"), "indicators": indicators})
        if route == "coverage":
            return self._coverage(snapshot, query)
        if route == "observations":
            return self._observations_v1(snapshot, query)
        if route == "map":
            indicator = self._one(query, "indicator")
            indicator_info = next((item for item in indicators if item.get("key") == indicator), None)
            if indicator and not indicator_info:
                return self._json({"error": "Unsupported indicator for this snapshot."}, 400)
            classif1 = self._one(query, "classif1")
            classif2 = self._one(query, "classif2")
            classifications = (indicator_info or {}).get("classifications", {})
            for dimension, value in (("classif1", classif1), ("classif2", classif2)):
                if value and value not in classifications.get(dimension, []):
                    return self._json({"error": f"Unsupported {dimension} value for this indicator."}, 400)
            if not classif1:
                candidates = classifications.get("classif1", [])
                classif1 = next((code for code in candidates if code.endswith("YGE15")), None)
                classif1 = classif1 or next((code for code in candidates if code.endswith("TOTAL")), None)
            if not classif2:
                candidates = classifications.get("classif2", [])
                classif2 = next((code for code in candidates if code.endswith("TOTAL")), None)
            rows = data.observations(indicator=indicator, limit=0)
            requested_year = self._integer(query, "year")
            requested_sex = self._one(query, "sex") or "SEX_T"
            if requested_sex not in snapshot.get("sex_codes", []):
                return self._json({"error": "Unsupported sex category for this snapshot."}, 400)
            by_area = {}
            for row in rows:
                if row.get("sex") not in {"", requested_sex}:
                    continue
                if classif1 and row.get("classif1", "") != classif1:
                    continue
                if classif2 and row.get("classif2", "") != classif2:
                    continue
                if not classif1 and row.get("classif1"):
                    continue
                if not classif2 and row.get("classif2"):
                    continue
                area = row.get("ref_area")
                if not area or area.startswith("X"):
                    continue
                if requested_year is not None and row["year"] != requested_year:
                    continue
                if area not in by_area or row["year"] > by_area[area]["year"]:
                    by_area[area] = row
            if requested_year is None:
                by_area = {area: row for area, row in by_area.items()}
            return self._json({"year": requested_year, "count": len(by_area), "observations": list(by_area.values())})
        if route.startswith("countries/"):
            tail = route.removeprefix("countries/").split("/")
            code = tail[0].upper() if tail else ""
            if code not in snapshot.get("reference_areas", []):
                return self._json({"error": "Unsupported reference area for this snapshot."}, 404)
            if len(tail) == 1:
                return self._json({"iso3": code, "name": snapshot.get("reference_area_labels", {}).get(code, code),
                                   "is_aggregate": code.startswith("X")})
            if len(tail) > 1 and tail[1] == "profile":
                result = []
                for item in indicators:
                    result.extend(data.observations(item.get("key"), country=code, limit=10000))
                return self._json({"country": code, "name": snapshot.get("reference_area_labels", {}).get(code, code),
                                   "snapshot_id": snapshot.get("snapshot_id"), "observations": result})
            if len(tail) > 1 and tail[1] == "indicators":
                return self._json([item for item in indicators if any(r.get("indicator_key") == item.get("key")
                                   for r in data.observations(item.get("key"), country=code, limit=1))])
            if len(tail) > 1 and tail[1] == "coverage":
                return self._coverage(snapshot, {**query, "country": [code]})
            return self._json({"error": "Not found"}, 404)
        if route == "timeseries":
            return self._observations_v1(snapshot, query)
        if route in {"rankings", "comparison", "distribution", "composition"}:
            return self._observations_v1(snapshot, query)
        if route in {"analysis/correlation", "analysis/similarity", "relationships"}:
            return self._json({"error": "Analysis is unavailable: a documented statistical method and compatible observations are required."}, 501)
        if route == "download":
            return self._observations_v1(snapshot, query)
        return self._json({"error": "Not found"}, 404)

    def _observations_v1(self, snapshot, query):
        try:
            indicator = self._one(query, "indicator")
            if indicator and not any(item.get("key") == indicator for item in snapshot.get("indicators", [])):
                return self._json({"error": "Unsupported indicator for this snapshot."}, 400)
            country = self._one(query, "country")
            countries_param = self._one(query, "countries")
            countries = {part.strip().upper() for part in countries_param.split(",") if part.strip()} if countries_param else None
            if country and country.upper() not in snapshot.get("reference_areas", []):
                return self._json({"error": "Unsupported reference area for this snapshot."}, 400)
            if countries and not countries.issubset(set(snapshot.get("reference_areas", []))):
                return self._json({"error": "One or more unsupported reference areas were requested."}, 400)
            sex = self._one(query, "sex")
            if sex and sex not in snapshot.get("sex_codes", []):
                return self._json({"error": "Unsupported sex category for this snapshot."}, 400)
            selected_indicator = next((item for item in snapshot.get("indicators", []) if item.get("key") == indicator), None)
            for dimension in ("classif1", "classif2"):
                value = self._one(query, dimension)
                if value and (not selected_indicator or value not in selected_indicator.get("classifications", {}).get(dimension, [])):
                    return self._json({"error": f"Unsupported {dimension} value for this indicator."}, 400)
            start_year, end_year = self._integer(query, "start_year"), self._integer(query, "end_year")
            if start_year and end_year and start_year > end_year:
                return self._json({"error": "Start year must be earlier than or equal to end year."}, 400)
            limit = self._integer(query, "limit") or 5000
            if limit < 1 or limit > 50000:
                return self._json({"error": "Limit must be between 1 and 50,000."}, 400)
            rows = data.observations(indicator, country.upper() if country else None, sex,
                                     self._one(query, "classif1"), self._one(query, "classif2"),
                                     start_year, end_year, limit=limit, countries=countries)
            return self._json({"count": len(rows), "limit": limit, "snapshot_id": snapshot.get("snapshot_id"),
                               "observations": rows})
        except (ValueError, TypeError):
            return self._json({"error": "Year and limit filters must be integers."}, 400)

    def _coverage(self, snapshot, query):
        indicator = self._one(query, "indicator")
        if indicator and not any(item.get("key") == indicator for item in snapshot.get("indicators", [])):
            return self._json({"error": "Unsupported indicator for this snapshot."}, 400)
        if not snapshot.get("available"):
            return self._json({"available": False, "message": snapshot.get("message"), "areas": [], "years": []})
        rows = data.observations(indicator=indicator, country=self._one(query, "country"), limit=0)
        return self._json({"available": True, "count": len(rows),
                           "areas": sorted({row["ref_area"] for row in rows}),
                           "years": sorted({row["year"] for row in rows}),
                           "indicator": indicator, "snapshot_id": snapshot.get("snapshot_id")})


def serve(host="127.0.0.1", port=3001):
    last_error = None
    for candidate in range(port, port + 11):
        try:
            server = ThreadingHTTPServer((host, candidate), Handler)
            break
        except OSError as exc:
            last_error = exc
    else:
        raise RuntimeError(f"No available port in {port}–{port + 10}") from last_error
    print(f"Informal Work Atlas: http://{host}:{server.server_port}", flush=True)
    server.serve_forever()

