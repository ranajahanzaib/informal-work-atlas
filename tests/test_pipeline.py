import unittest

from pipelines.ilostat.refresh import choose_tables, decode_dictionary, dictionary_links, normalise


class ILOSTATPipelineTests(unittest.TestCase):
    def test_catalogue_selection_uses_live_id_and_annual_frequency(self):
        rows = [
            {"id": "quarterly", "indicator.label": "Informal employment rate by sex -- ILO modelled estimates", "freq": "Q"},
            {"id": "annual-old", "indicator.label": "Informal employment rate by sex -- ILO modelled estimates", "freq": "A", "last.update": "2024"},
            {"id": "annual-new", "indicator.label": "Informal employment rate by sex -- ILO modelled estimates", "freq": "A", "last.update": "2025"},
        ]
        selected = choose_tables(rows)
        self.assertEqual(selected[0][1]["id"], "annual-new")

    def test_catalogue_selection_does_not_match_employment_inside_unemployment(self):
        rows = [
            {"id": "outside-force", "indicator.label": "Persons outside the labour force by sex and age -- ILO modelled estimates", "freq": "A", "last.update": "2026"},
            {"id": "employment", "indicator.label": "Employment by sex and age -- ILO modelled estimates", "freq": "A", "last.update": "2025"},
            {"id": "unemployment", "indicator.label": "Unemployment by sex and age -- ILO modelled estimates", "freq": "A", "last.update": "2026"},
            {"id": "labour-force", "indicator.label": "Labour force by sex and age -- ILO modelled estimates", "freq": "A", "last.update": "2025"},
        ]
        selected = {slug: row["id"] for slug, row, _ in choose_tables(rows)}
        self.assertEqual(selected["employment-count-modelled"], "employment")
        self.assertEqual(selected["unemployment-count-modelled"], "unemployment")
        self.assertEqual(selected["labour-force-count-modelled"], "labour-force")

    def test_normalisation_preserves_missing_and_status_metadata(self):
        rows = [
            {"ref_area": "PAK", "time": "2022", "obs_value": "34.5", "sex": "SEX_T", "obs_status": "E"},
            {"ref_area": "PAK", "time": "2023", "obs_value": "", "sex": "SEX_T", "obs_status": ""},
        ]
        result = normalise(rows, "verified-id", "Verified label", "informal-rate-modelled")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["value"], 34.5)
        self.assertEqual(result[0]["obs_status"], "E")

    def test_duplicate_dimension_observations_fail_closed(self):
        row = {"ref_area": "PAK", "time": "2022", "obs_value": "34.5", "sex": "SEX_T"}
        with self.assertRaisesRegex(RuntimeError, "Duplicate observations"):
            normalise([row, row.copy()], "verified-id", "Verified label", "informal-rate-modelled")

    def test_invalid_rate_is_not_published(self):
        row = {"ref_area": "PAK", "time": "2022", "obs_value": "101", "sex": "SEX_T"}
        with self.assertRaisesRegex(RuntimeError, "Invalid value"):
            normalise([row], "verified-id", "Verified label", "informal-rate-modelled")

    def test_non_numeric_non_missing_observation_fails_closed(self):
        row = {"ref_area": "PAK", "time": "2022", "obs_value": "not-a-number"}
        with self.assertRaisesRegex(RuntimeError, "Non-numeric"):
            normalise([row], "verified-id", "Verified label", "unemployment-rate-modelled", "percentage")

    def test_unexpected_annual_time_format_fails_closed(self):
        row = {"ref_area": "PAK", "time": "2022Q1", "obs_value": "5.2"}
        with self.assertRaisesRegex(RuntimeError, "Unexpected annual time"):
            normalise([row], "verified-id", "Verified label", "unemployment-rate-modelled", "percentage")

    def test_additional_classification_dimensions_are_retained(self):
        base = {"ref_area": "PAK", "time": "2022", "obs_value": "10", "classif1": "AGE_YTH"}
        first = base | {"classif3": "EDU_LOW"}
        second = base | {"classif3": "EDU_HIGH"}
        result = normalise([first, second], "verified-id", "Verified label", "employment-sector-modelled", "thousands")
        self.assertEqual({row["classif3"] for row in result}, {"EDU_LOW", "EDU_HIGH"})

    def test_dictionary_decodes_official_code_and_label_columns(self):
        result = decode_dictionary(b"ref_area,ref_area.label\nPAK,Pakistan\n", "ref_area")
        self.assertEqual(result["PAK"], "Pakistan")

    def test_dictionary_discovery_uses_same_official_host_and_english_variant(self):
        html = b'<a href="dic/ref_area.csv">CSV</a><a href="dic/ref_area_en.csv">English</a><a href="https://example.com/ref_area_en.csv">external</a>'
        links = dictionary_links(html, ["ref_area"])
        self.assertTrue(links["ref_area"].endswith("ref_area_en.csv"))
        self.assertIn("rplumber.ilo.org", links["ref_area"])

    def test_dictionary_discovery_resolves_query_based_endpoints(self):
        html = (
            b'<a href="https://rplumber.ilo.org/metadata/dic?var=cl_ref_area&format=.csv">All</a>'
            b'<a href="https://rplumber.ilo.org/metadata/dic?var=cl_ref_area&lang=en&format=.csv">English</a>'
            b'<a href="https://rplumber.ilo.org/metadata/dic?var=cl_ref_area&lang=es&format=.csv">Spanish</a>'
        )
        links = dictionary_links(html, ["ref_area"])
        self.assertIn("lang=en", links["ref_area"])
        self.assertIn("var=cl_ref_area", links["ref_area"])


if __name__ == "__main__":
    unittest.main()
