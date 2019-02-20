import json
import os
import pickle
import pytest
import sys
from aiohttp import web

import virtool.bio

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
TEST_BIO_PATH = os.path.join(TEST_FILES_PATH, "bio")


@pytest.fixture
def orf_containing():
    data = virtool.bio.read_fasta(os.path.join(TEST_BIO_PATH, "has_orfs.fa"))
    return data[0][1]


@pytest.fixture
def mock_blast_server(monkeypatch, loop, test_server):
    async def get_handler(req):

        params = dict(req.query)

        format_object = params.get("FORMAT_OBJECT", None)

        if format_object == "SearchInfo":
            with open(os.path.join(TEST_BIO_PATH, "check_rid.html"), "r") as f:
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

            with open(os.path.join(TEST_BIO_PATH, "blast.zip"), "rb") as f:
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

        with open(os.path.join(TEST_BIO_PATH, "initialize_blast.html"), "r") as f:
            return web.Response(text=f.read(), status=200)

    app = web.Application()

    app.router.add_get("/blast", get_handler)
    app.router.add_post("/blast", post_handler)

    server = loop.run_until_complete(test_server(app))

    monkeypatch.setattr("virtool.bio.BLAST_URL", "http://{}:{}/blast".format(server.host, server.port))

    return server


@pytest.mark.parametrize("illegal", [False, True])
def test_read_fasta(illegal, tmpdir):
    tmpfile = tmpdir.join("test.fa")

    content = (
        ">test_1\n"
        "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC\n"
        ">test_2\n"
        "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT\n"
    )

    if illegal:
        content = "ATTAGATAC\n" + content

    tmpfile.write(content)

    if illegal:
        with pytest.raises(IOError) as err:
            virtool.bio.read_fasta(str(tmpfile))

        assert "Illegal FASTA line: ATTAGATAC" in str(err)

    else:
        assert virtool.bio.read_fasta(str(tmpfile)) == [
            ("test_1", "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC"),
            ("test_2", "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT")
        ]


@pytest.mark.parametrize("headers_only", [True, False], ids=["read_fastq_headers", "read_fastq"])
def test_fastq(headers_only, tmpdir):
    tmpfile = tmpdir.join("test.fa")

    with open(os.path.join(TEST_FILES_PATH, "test.fq"), "r") as f:
        lines = list()

        while len(lines) < 16:
            lines.append(f.readline())

    tmpfile.write("".join(lines))

    expected = [
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:1531:1859 1:N:0:AGTCAA',
            'NTGAGTATCTATTCTACAAATTCATTGATGTTTAGATGAATCGATATACATATTCATTAATAGTCTAGATCATGATATATACTTATCCCTCTAGGTGTCTG',
            '#1=DDDFFHHHHHJJJJJJJJJJJJJJIJJJJJJJHJJIIGJIHJHIIJJJJJJJIJJIIIJJIJJJJJJJJJJIGGIJIJJJJJIJJHHHHGFFDDFEEE'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:1648:1927 1:N:0:AGTCAA',
            'NTTGGCGGAATCAGCGGGGAAAGAAGACCCTGTTGAGCTTGACTCTAGTCCGACTTTGTGAAATGACTTGAGAGGTGTAGGATAAGTGGGAGCCGGAAACG',
            '#4=DFFFFHHHHHJJJJJJIJIJJJJJJJHHHHFFFFFFEEEEEEDDDEDDDDDDDDDDDDEDDDDDDDDCDBDDDACDDDDDDDDCDDDBDDDDDDDDDD'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:2306:1918 1:N:0:AGTCAA',
            'NCTCGCGGTACTTGTTTGCTATCGGTCTCTCGCCCGTATTTAGCCTTGGACGGAATTTACCGCCCGATTGGGGCTGCATTCCCAAACAACCCGACTCGCCG',
            '#4=DFFFFHHHHHJJJJJJJJJJJJIIJJJJJJJJJFHJJJJIJJIJJIJJHHFFFEEEEEDDDDDDDDDDDDDDBDDDEDEDDDDDDDDDDDDDDDDDD<'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:2582:1955 1:N:0:AGTCAA',
            'NATCGGAAGAGCACACGTCTGAACTCCAGTCACAGTCAACAATCTCGTATGCCGTCTTCTGCTTGAAAAAAAAAAAAAAAAACAAAAAAAAGAACATAATA',
            '#1=DFFFFHHHGHJJJJGHJJJJJJJJJJHIJJJJIIIJJJJGCHGHGIIGIJGFHHIJGJJIGFHHHFFD##############################'
        )
    ]

    if headers_only:
        assert virtool.bio.read_fastq_headers(str(tmpfile)) == [i[0] for i in expected]
    else:
        assert virtool.bio.read_fastq(str(tmpfile)) == expected


def test_reverse_complement():
    sequence = "ATAGGGATTAGAGACACAGATA"
    expected = "TATCTGTGTCTCTAATCCCTAT"

    assert virtool.bio.reverse_complement(sequence) == expected


@pytest.mark.parametrize("sequence,expected", [
    ("ATAGGGATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "IGIRDTDKERYRTCDVRTI*A"),
    ("ATACCNATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "IPIRDTDKERYRTCDVRTI*A"),
    ("ATNGGGATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "XGIRDTDKERYRTCDVRTI*A"),
], ids=["no_ambiguous", "ambiguous", "ambigous_x"])
def test_translate(sequence, expected):
    """
    Test that translation works properly. Cases are standard, resolvable ambiguity, and non-resolvable ambiguity (X).

    """
    assert virtool.bio.translate(sequence) == expected


def test_find_orfs(orf_containing):
    result = virtool.bio.find_orfs(orf_containing)

    with open(os.path.join(TEST_BIO_PATH, "orfs"), "rb") as f:
        assert pickle.load(f) == result


async def test_initialize_ncbi_blast(mock_blast_server):
    """
    Using a mock BLAST server, test that a BLAST initialization request works properly.

    """
    seq = "ATGTACAGGATCAGCATCGAGCTACGAT"

    assert await virtool.bio.initialize_ncbi_blast({"proxy": ""}, seq) == ("YA40WNN5014", 19)


def test_extract_blast_info():
    """
    Test that the function returns the correct RID and RTOE from the stored test HTML file.

    """
    with open(os.path.join(TEST_BIO_PATH, "initialize_blast.html"), "r") as f:\
        assert virtool.bio.extract_blast_info(f.read()) == ("YA40WNN5014", 19)


@pytest.mark.parametrize("rid,expected", [
    ("YA27F0T6015", True),
    ("5106T0F27AY", False)
])
async def test_check_rid(rid, expected, mock_blast_server):
    """
    Test that check_rid() returns the correct result given HTML for a ready BLAST request and a waiting BLAST request.

    """
    assert await virtool.bio.check_rid({"proxy": ""}, rid) == expected


async def test_get_ncbi_blast_result(mock_blast_server):
    with open(os.path.join(TEST_BIO_PATH, "blast.json"), "r") as f:
        assert await virtool.bio.get_ncbi_blast_result({"proxy": ""}, "YA6M9135015") == json.load(f)
