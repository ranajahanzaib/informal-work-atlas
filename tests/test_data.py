import csv
import json
import tempfile
import unittest
from pathlib import Path

from iwa import data


class SnapshotReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        snapshots = root / "snapshots"
        self.snapshot = snapshots / "fixture"
        (self.snapshot / "tables").mkdir(parents=True)
        data.CURRENT = root / "CURRENT"
        data.SNAPSHOTS = snapshots
        data.CURRENT.write_text("fixture\n", encoding="utf-8")
        (self.snapshot / "manifest.json").write_text(json.dumps({"snapshot_id": "fixture"}), encoding="utf-8")
        rows = [
            {"indicator_id": "dataset", "indicator_key": "informal-rate-modelled", "ref_area": "PAK", "sex": "SEX_T", "classif1": "AGE_YTH", "classif2": "", "year": 2020, "value": 31.5},
            {"indicator_id": "dataset", "indicator_key": "informal-rate-modelled", "ref_area": "PAK", "sex": "SEX_T", "classif1": "AGE_YTH", "classif2": "", "year": 2021, "value": 32.0},
            {"indicator_id": "dataset", "indicator_key": "informal-rate-modelled", "ref_area": "IND", "sex": "SEX_T", "classif1": "AGE_YTH", "classif2": "", "year": 2021, "value": 21.0},
        ]
        with (self.snapshot / "tables" / "informal-rate-modelled.csv").open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self):
        self.temp.cleanup()

    def test_filters_keep_only_matching_reference_area_and_years(self):
        rows = data.observations("informal-rate-modelled", country="PAK", start_year=2021)
        self.assertEqual([(row["year"], row["value"]) for row in rows], [(2021, 32.0)])

    def test_classification_filters_are_exact_and_missing_is_not_zero(self):
        rows = data.observations("informal-rate-modelled", classif1="OTHER")
        self.assertEqual(rows, [])
        self.assertEqual(data.observations("absent"), [])

    def test_indicator_key_cannot_escape_snapshot_directory(self):
        self.assertEqual(data.observations("../../manifest"), [])


if __name__ == "__main__":
    unittest.main()
