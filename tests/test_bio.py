import json
from pathlib import Path

import pytest
from aiohttp import web
from virtool.bio import (check_rid, extract_blast_info, format_blast_hit,
                         get_ncbi_blast_result, initialize_ncbi_blast)

TEST_FILES_PATH = Path.cwd() / "tests" / "test_files"
TEST_BIO_PATH = TEST_FILES_PATH / "bio"


@pytest.fixture
def mock_blast_server(monkeypatch, loop, aiohttp_server):
    async def get_handler(req):
        params = dict(req.query)

        format_object = params.get("FORMAT_OBJECT", None)

        if format_object == "SearchInfo":
            with open(TEST_BIO_PATH / "check_rid.html", "r") as f:
                html = f.read()

            assert params["CMD"] == "Get"

            # For 'Status=READY' test, RID is YA27F0T6015. For 'WAITING' test, RID is 5106T0F27AY.
            if params["RID"] == "5106T0F27AY":
                html = html.replace("Status=READY", "Status=WAITING")

            return web.Response(text=html, status=200)

        if format_object == "Alignment":
            assert params == {
                "CMD": "Get",
                "RID": "YA6M9135015",
                "FORMAT_TYPE": "JSON2",
                "FORMAT_OBJECT": "Alignment"
            }

            with open(TEST_BIO_PATH / "blast.zip", "rb") as f:
                return web.Response(body=f.read(), status=200)

        return web.Response(status=404)

    async def post_handler(req):
        assert dict(req.query) == {
            "CMD": "Put",
            "DATABASE": "nr",
            "PROGRAM": "blastn",
            "MEGABLAST": "on",
            "HITLIST_SIZE": "5",
            "FILTER": "mL",
            "FORMAT_TYPE": "JSON2"
        }

        data = await req.post()

        assert dict(data) == {
            "QUERY": "ATGTACAGGATCAGCATCGAGCTACGAT",
        }

        with open(TEST_BIO_PATH / "initialize_blast.html", "r") as f:
            return web.Response(text=f.read(), status=200)

    app = web.Application()

    app.router.add_get("/blast", get_handler)
    app.router.add_post("/blast", post_handler)

    server = loop.run_until_complete(aiohttp_server(app))

    monkeypatch.setattr(
        "virtool.bio.BLAST_URL",
        "http://{}:{}/blast".format(server.host, server.port)
    )

    return server


@pytest.mark.parametrize("missing", ["accession", "taxid", "title", None])
@pytest.mark.parametrize("sciname", ["Vitis", None])
def test_format_blast_hit(missing, sciname, snapshot):
    hit = {
        "description": [
            {
                "accession": "ABC123",
                "taxid": "1234",
                "title": "Foo"
            }
        ],
        "hsps": [
            {
                "identity": 0.86,
                "evalue": 0.0000000123,
                "align_len": 231,
                "score": 98,
                "bit_score": 1092,
                "gaps": 3
            }
        ],
        "len": 4321
    }

    if missing:
        del hit["description"][0][missing]

    if sciname:
        hit["description"][0]["sciname"] = sciname

    assert format_blast_hit(hit) == snapshot


async def test_initialize_ncbi_blast(mock_blast_server, config):
    """
    Using a mock BLAST server, test that a BLAST initialization request works properly.

    """
    seq = "ATGTACAGGATCAGCATCGAGCTACGAT"
    config.proxy = ""
    assert await initialize_ncbi_blast(config, seq) == ("YA40WNN5014", 19)


def test_extract_blast_info():
    """
    Test that the function returns the correct RID and RTOE from the stored test HTML file.

    """
    with open(TEST_BIO_PATH / "initialize_blast.html", "r") as f:
        assert extract_blast_info(f.read()) == ("YA40WNN5014", 19)


@pytest.mark.parametrize("rid,expected", [
    ("YA27F0T6015", True),
    ("5106T0F27AY", False)
])
async def test_check_rid(rid, expected, mock_blast_server, config):
    """
    Test that check_rid() returns the correct result given HTML for a ready BLAST request and a waiting BLAST request.

    """
    config.proxy = ""
    assert await check_rid(config, rid) == expected


async def test_get_ncbi_blast_result(mock_blast_server, config):
    async def run_in_process(func, *args):
        return func(*args)

    with open(TEST_BIO_PATH / "unformatted_blast.json", "r") as f:
        config.proxy = ""
        result = await get_ncbi_blast_result(config, run_in_process, "YA6M9135015")
        assert result == json.load(f)
