import csv
import io
import json

import openpyxl
import pytest
from pytest_mock import MockerFixture
from syrupy import SnapshotAssertion

import virtool.analyses
from virtool.analyses.format import (
    CSV_HEADERS,
    load_results,
    transform_coverage_to_coordinates,
)
from virtool.mongo.core import Mongo
from virtool.storage.memory import MemoryStorageProvider


async def test_load_results_from_storage():
    """Offloaded results are read back from storage when the payload is ``"file"``."""
    results = {"foo": "bar", "bar": "baz"}

    storage = MemoryStorageProvider()

    async def _data():
        yield json.dumps(results).encode()

    await storage.write("samples/bar/analysis/foo/results.json", _data())

    result = await load_results(
        storage,
        results="file",
        legacy_id="foo",
        sample_id="bar",
    )

    assert result == results


async def test_load_results_inline():
    """Inline results are returned unchanged without touching storage."""
    storage = MemoryStorageProvider()

    result = await load_results(
        storage,
        results={"baz": "foo"},
        legacy_id="foo",
        sample_id="bar",
    )

    assert result == {"baz": "foo"}


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

    async def test_no_workflow(self, mongo: Mongo):
        """A ``None`` workflow raises a descriptive ``ValueError``."""
        with pytest.raises(ValueError, match="Analysis has no workflow field"):
            await virtool.analyses.format.format_analysis(
                MemoryStorageProvider(),
                mongo,
                None,
                workflow=None,
                results={"hits": []},
                legacy_id="test_analysis",
                sample_id="test_sample",
            )

    async def test_unknown_workflow(self, mongo: Mongo):
        """An unrecognised workflow raises a descriptive ``ValueError``."""
        with pytest.raises(ValueError, match="Unknown workflow: foobar"):
            await virtool.analyses.format.format_analysis(
                MemoryStorageProvider(),
                mongo,
                None,
                workflow="foobar",
                results={"hits": []},
                legacy_id="test_analysis",
                sample_id="test_sample",
            )

    async def test_nuvs(self, mocker: MockerFixture, mongo: Mongo):
        """The nuvs workflow dispatches to ``format_nuvs``."""
        m_format_nuvs = mocker.patch(
            "virtool.analyses.format.format_nuvs",
            return_value={"is_nuvs": True, "is_pathoscope": False},
        )
        m_format_pathoscope = mocker.patch("virtool.analyses.format.format_pathoscope")

        storage = MemoryStorageProvider()
        results = {"hits": []}

        formatted = await virtool.analyses.format.format_analysis(
            storage,
            mongo,
            mocker.Mock(),
            workflow="nuvs",
            results=results,
            legacy_id="test_analysis",
            sample_id="test_sample",
        )

        assert formatted == {"is_nuvs": True, "is_pathoscope": False}
        m_format_nuvs.assert_called_with(
            storage,
            mongo,
            results=results,
            legacy_id="test_analysis",
            sample_id="test_sample",
        )
        assert not m_format_pathoscope.called

    async def test_pathoscope(self, mocker: MockerFixture, mongo: Mongo):
        """The pathoscope workflow dispatches to ``format_pathoscope``."""
        m_format_nuvs = mocker.patch("virtool.analyses.format.format_nuvs")
        m_format_pathoscope = mocker.patch(
            "virtool.analyses.format.format_pathoscope",
            return_value={"is_nuvs": False, "is_pathoscope": True},
        )

        storage = MemoryStorageProvider()
        pg = mocker.Mock()
        results = {"hits": []}

        formatted = await virtool.analyses.format.format_analysis(
            storage,
            mongo,
            pg,
            workflow="pathoscope",
            results=results,
            legacy_id="test_analysis",
            sample_id="test_sample",
        )

        assert formatted == {"is_nuvs": False, "is_pathoscope": True}
        m_format_pathoscope.assert_called_with(
            storage,
            mongo,
            pg,
            results=results,
            legacy_id="test_analysis",
            sample_id="test_sample",
        )
        assert not m_format_nuvs.called


class TestDownloadOffloadedResults:
    """Downloading an analysis whose results were offloaded to storage.

    Regression: the median depths were previously calculated from the unresolved
    ``"file"`` sentinel, raising a ``TypeError`` before the results were loaded.
    """

    @staticmethod
    async def _seed_offloaded(storage: MemoryStorageProvider) -> None:
        async def _data():
            yield json.dumps(
                {"hits": [{"id": "sequence", "align": [1, 2, 3]}]},
            ).encode()

        await storage.write("samples/sample/analysis/analysis/results.json", _data())

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

    async def test_csv(self, mocker: MockerFixture, mongo: Mongo):
        storage = MemoryStorageProvider()
        await self._seed_offloaded(storage)
        self._patch_format_analysis(mocker)

        csv_data = await virtool.analyses.format.format_analysis_to_csv(
            storage,
            mongo,
            mocker.Mock(),
            results="file",
            workflow="pathoscope",
            sample_id="sample",
            legacy_id="analysis",
        )

        rows = list(csv.reader(io.StringIO(csv_data)))

        assert rows[0] == list(CSV_HEADERS)
        assert rows[1] == ["OTU", "Isolate A", "AB000", "3", "0.5", "2", "1.0"]

    async def test_excel(self, mocker: MockerFixture, mongo: Mongo):
        storage = MemoryStorageProvider()
        await self._seed_offloaded(storage)
        self._patch_format_analysis(mocker)

        excel_data = await virtool.analyses.format.format_analysis_to_excel(
            storage,
            mongo,
            mocker.Mock(),
            results="file",
            workflow="pathoscope",
            sample_id="sample",
            legacy_id="analysis",
        )

        worksheet = openpyxl.load_workbook(io.BytesIO(excel_data)).active

        median_depth_column = CSV_HEADERS.index("Median Depth") + 1

        assert worksheet.cell(row=2, column=median_depth_column).value == 2
