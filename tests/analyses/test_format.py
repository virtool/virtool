import csv
import io

import openpyxl
import pytest
from pytest_mock import MockerFixture
from syrupy import SnapshotAssertion

import virtool.analyses
from virtool.analyses.format import (
    CSV_HEADERS,
    format_nuvs,
    transform_coverage_to_coordinates,
)


@pytest.mark.parametrize(
    "coverage",
    [
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
        [
            0,
            0,
            0,
            1,
            1,
            1,
            0,
            0,
            1,
            1,
            1,
            2,
            2,
            2,
            2,
            2,
            3,
            3,
            3,
            2,
            2,
            2,
            5,
            5,
            4,
            4,
            3,
            3,
            2,
            2,
            1,
            1,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            8,
            7,
            6,
            5,
            5,
            5,
            5,
            4,
            3,
            2,
            6,
            7,
            9,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            2,
            2,
            3,
            3,
            4,
            4,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            7,
            8,
            7,
            7,
            6,
            6,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            4,
            4,
            4,
            4,
            4,
            4,
            3,
            3,
            3,
            3,
            4,
            3,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            1,
            1,
            2,
            3,
            2,
            3,
        ],
    ],
)
def test_transform_coverage_to_coordinates(
    coverage: list[int], snapshot: SnapshotAssertion
):
    """Test that two sample coverage datasets are correctly converted to coordinates."""
    assert transform_coverage_to_coordinates(coverage) == snapshot


class TestFormatAnalysis:
    """Test workflow dispatch in ``format_analysis``."""

    async def test_no_workflow(self):
        """A ``None`` workflow raises a descriptive ``ValueError``."""
        with pytest.raises(ValueError, match="Analysis has no workflow field"):
            await virtool.analyses.format.format_analysis(
                None,
                workflow=None,
                results={"hits": []},
            )

    async def test_unknown_workflow(self):
        """An unrecognised workflow raises a descriptive ``ValueError``."""
        with pytest.raises(ValueError, match="Unknown workflow: foobar"):
            await virtool.analyses.format.format_analysis(
                None,
                workflow="foobar",
                results={"hits": []},
            )

    async def test_nuvs(self, mocker: MockerFixture):
        """The nuvs workflow dispatches to ``format_nuvs``."""
        m_format_nuvs = mocker.patch(
            "virtool.analyses.format.format_nuvs",
            return_value={"is_nuvs": True, "is_pathoscope": False},
        )
        m_format_pathoscope = mocker.patch("virtool.analyses.format.format_pathoscope")

        pg = mocker.Mock()
        results = {"hits": []}

        formatted = await virtool.analyses.format.format_analysis(
            pg,
            workflow="nuvs",
            results=results,
        )

        assert formatted == {"is_nuvs": True, "is_pathoscope": False}
        m_format_nuvs.assert_called_with(pg, results=results)
        assert not m_format_pathoscope.called

    async def test_pathoscope(self, mocker: MockerFixture):
        """The pathoscope workflow dispatches to ``format_pathoscope``."""
        m_format_nuvs = mocker.patch("virtool.analyses.format.format_nuvs")
        m_format_pathoscope = mocker.patch(
            "virtool.analyses.format.format_pathoscope",
            return_value={"is_nuvs": False, "is_pathoscope": True},
        )

        pg = mocker.Mock()
        results = {"hits": []}

        formatted = await virtool.analyses.format.format_analysis(
            pg,
            workflow="pathoscope",
            results=results,
        )

        assert formatted == {"is_nuvs": False, "is_pathoscope": True}
        m_format_pathoscope.assert_called_with(pg, results=results)
        assert not m_format_nuvs.called


class TestFormatNuvs:
    """``format_nuvs`` enriches hits with HMM annotation data read from Postgres."""

    async def test_enriches_hits_from_postgres(self, pg, seed_pg_hmm, hmm_document):
        await seed_pg_hmm(hmm_document)

        results = {
            "hits": [
                {"orfs": [{"hits": [{"hit": "f8666902", "score": 1.0}]}]},
            ],
        }

        formatted = await format_nuvs(pg, results=results)

        hit = formatted["hits"][0]["orfs"][0]["hits"][0]

        assert hit["cluster"] == hmm_document["cluster"]
        assert hit["families"] == hmm_document["families"]
        assert hit["names"] == hmm_document["names"]
        assert hit["score"] == 1.0

    async def test_no_hits_skips_query(self, pg):
        results = {"hits": []}

        assert await format_nuvs(pg, results=results) == {"hits": []}


class TestDownloadResults:
    """Downloading an analysis to CSV or Excel.

    Median depths are calculated from the raw results before formatting, then the
    formatted hits drive the rendered rows.
    """

    results = {"hits": [{"id": "sequence", "align": [1, 2, 3]}]}

    @staticmethod
    def _patch_format_analysis(mocker: MockerFixture) -> None:
        mocker.patch(
            "virtool.analyses.format.format_analysis",
            return_value={
                "hits": [
                    {
                        "name": "OTU",
                        "isolates": [
                            {
                                "source_type": "isolate",
                                "source_name": "A",
                                "sequences": [
                                    {
                                        "id": "sequence",
                                        "accession": "AB000",
                                        "length": 3,
                                        "pi": 0.5,
                                        "coverage": 1.0,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        )

    async def test_csv(self, mocker: MockerFixture):
        self._patch_format_analysis(mocker)

        csv_data = await virtool.analyses.format.format_analysis_to_csv(
            mocker.Mock(),
            results=self.results,
            workflow="pathoscope",
        )

        rows = list(csv.reader(io.StringIO(csv_data)))

        assert rows[0] == list(CSV_HEADERS)
        assert rows[1] == ["OTU", "Isolate A", "AB000", "3", "0.5", "2", "1.0"]

    async def test_excel(self, mocker: MockerFixture):
        self._patch_format_analysis(mocker)

        excel_data = await virtool.analyses.format.format_analysis_to_excel(
            mocker.Mock(),
            results=self.results,
            workflow="pathoscope",
            sample_id="sample",
        )

        worksheet = openpyxl.load_workbook(io.BytesIO(excel_data)).active

        median_depth_column = CSV_HEADERS.index("Median Depth") + 1

        assert worksheet.cell(row=2, column=median_depth_column).value == 2
