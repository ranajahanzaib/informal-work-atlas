import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

from iwa import data
from iwa.server import Handler


class MockRequest:
    def __init__(self, path):
        self.path = path

    def makefile(self, *args, **kwargs):
        import io
        return io.BytesIO()


class ServerAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        snapshots = root / "snapshots"
        self.snapshot = snapshots / "test-snapshot"
        (self.snapshot / "tables").mkdir(parents=True)
        data.CURRENT = root / "CURRENT"
        data.SNAPSHOTS = snapshots
        data.CURRENT.write_text("test-snapshot\n", encoding="utf-8")
        manifest_data = {
            "snapshot_id": "test-snapshot",
            "reference_areas": ["PAK", "USA"],
            "sex_codes": ["SEX_T", "SEX_F"],
            "indicators": [{
                "key": "informal-rate-modelled",
                "label": "Informal employment rate",
                "classifications": {"classif1": ["AGE_YTH"]},
            }],
        }
        (self.snapshot / "manifest.json").write_text(json.dumps(manifest_data), encoding="utf-8")
        rows = [
            "indicator_id,indicator_key,ref_area,sex,classif1,classif2,year,value",
            "dataset,informal-rate-modelled,PAK,SEX_T,AGE_YTH,,2021,32.0",
            "dataset,informal-rate-modelled,USA,SEX_F,AGE_YTH,,2021,12.5",
        ]
        (self.snapshot / "tables" / "informal-rate-modelled.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def _call_api(self, path, query=None):
        query_str = f"?{urlencode(query)}" if query else ""
        handler = Handler.__new__(Handler)
        responses = []

        def mock_json(payload, status=200):
            responses.append((status, payload))

        handler._json = mock_json
        handler._api(path, {k: [v] for k, v in (query or {}).items()})
        return responses[0]

    def test_health_endpoint(self):
        status, payload = self._call_api("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(payload["snapshot"]["available"])

    def test_observations_case_insensitive_country(self):
        status, payload = self._call_api("/api/observations", {"indicator": "informal-rate-modelled", "country": "pak"})
        self.assertEqual(status, 200)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["observations"][0]["ref_area"], "PAK")

    def test_observations_rejects_invalid_year_range(self):
        status, payload = self._call_api("/api/observations", {"indicator": "informal-rate-modelled", "start_year": "2025", "end_year": "2020"})
        self.assertEqual(status, 400)
        self.assertIn("Start year must be earlier", payload["error"])

    def test_v1_metadata_endpoint(self):
        status, payload = self._call_api("/api/v1/metadata")
        self.assertEqual(status, 200)
        self.assertEqual(payload["snapshot_id"], "test-snapshot")
        self.assertEqual(len(payload["indicators"]), 1)

    def test_v1_countries_endpoint(self):
        status, payload = self._call_api("/api/v1/countries")
        self.assertEqual(status, 200)
        iso_codes = {c["iso3"] for c in payload}
        self.assertIn("PAK", iso_codes)
        self.assertIn("USA", iso_codes)

    def test_v1_map_endpoint(self):
        status, payload = self._call_api("/api/v1/map", {"indicator": "informal-rate-modelled", "classif1": "AGE_YTH"})
        self.assertEqual(status, 200)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["observations"][0]["ref_area"], "PAK")

    def test_v1_observations_endpoint(self):
        status, payload = self._call_api("/api/v1/observations", {"indicator": "informal-rate-modelled", "country": "USA"})
        self.assertEqual(status, 200)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["observations"][0]["ref_area"], "USA")


if __name__ == "__main__":
    unittest.main()
