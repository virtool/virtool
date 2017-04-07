import os
import gzip
import json
import copy
import pytest

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


@pytest.fixture
def test_virus():
    return {
        "version": 0,
        "abbreviation": "PVF",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "isolate_id": "cab8b360",
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "modified": False,
        "name": "Prunus virus F",
        "user_id": "igboyes",
        "_id": "6116cba1"
    }


@pytest.fixture
def test_sequence():
    return {
        "_id": "KX269872",
        "annotated": True,
        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
        "host": "sweet cherry",
        "isolate_id": "cab8b360",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTCGTTACCAGAAACTGCTTTCTACGTTCTCTGAACGTTTCTGTTTACTCATTGCTTT"
                    "TGCGTACTCTTTTACTACGGAAATTTCTGAAAAGAATTTTCCTTCTTGATTCTTTTCTCTCTCTTTCTCATCCCTTTTTCTT"
                    "CCTTCAGATTCTTCTATTTCCTTTGGTCACACTGTTGCTTTCGGTCTCTATGCAAACCTATAATCTTTTCAAAGATATTACG"
                    "GGTTTTGAAACATACGCTGAATACGAGTTTGATCTGTTTACCAGTAGTTCCTGGTTGAATTACGAAGAAAGACGTGATCACA"
                    "TATCCACGTTCGTGTCCAAACACCTCACCCCTTGCAAGCGCATATATCATCTTGATCAGAGAAAGACGCAGCGTCTTACGTA"
                    "TTCAGAAAAATTCACGTCCTTTGTGATCAGCATACTCTTGATATCTCTTTATTACATATCCTCTCTTTCTCGCAAGCTTGAA"
                    "AGGATGGCATTTCAGAGATCTTCACATAGTGCTGGTCTGGGGACTTCTGAAGTTCTCCAGGTACCTCTCGGAGCTGCTAACA"
                    "CCATACCAGCAGATGTTTTGGCTGATCGCAGCAGAGCTTATCGTGAAACTGTTCCTTCACGTGCGTCAGTCCTGCCTCATTC"
                    "ACGGGATGTGTATAGTGGTAGGGTTACTCGATTTATGCGCCTTGGTTGGCAGGGGCTGGTTGGAAATACAGCGACAACCATG"
                    "CGCATCGAGAACGCAGAACTTACAGCACTTGGTGGCAATCATGTCGTTGATGTTCCCATACCTTTTTTGGGAACGGAAGCCA"
                    "CGTCTGTGAATCCAGTGGTTATGGCCATGGATGAGCGTTTAACTCCATCTGTCCGGTCCAGCTCAGGGCCTAATCTGGCCCA"
                    "CGTGGGAGTTGTAGAAATTCTTGTGGATGGGCTTGTAGCGCAGAATGCGTGTACTGTGGCAGGTGCACTACTGTATGATGCT"
                    "CGACATCAAGACCGGGAACAAGCTTTTCTTGGTGCTTTTGCTTCTACAATAGCATCAGAACCATCACGGGTTCTATTTTACC"
                    "CAGATCATACAGTCAGTTTATTGCAGGCTGATGCTGCGCGAACTCTCCATCTTGCTATCGTTCTGCCCAACAATGATATGCG"
                    "TGAGCATGATATAGCTGCACACATCCGTGTTGGTTCCATCACTCAGTTCACTCGTGGGTCATTTGAATCCACCCACACAGCT"
                    "CGTCTCATCAACCACACTAAAACTGATCGTGCTGAGGCAGTCCGTTATCTTGGACAGAATATGCATGTTATACACGCTGCTC"
                    "CACGGCCTCGAGTTGAGATGCCAAACATTTCTATTCCATTTGGCAGGTCCATTTCTATGAGGCAAACTAGAACTTTGCAATG"
                    "GGAAGCTGTCGAAAGACCTCGTCAATCTGTTGTTCTTCAATTTGACAATCCAAACAACAGATCAACGTTTTCTTTTGGCGCT"
                    "AGCAATGCTGAAACTCCTCCTGTGAATCCTGATCCTGCGCTCAGTGAAAGTCAGGGACAAGCTGTTTCTTCTTTGGAAGTTG"
                    "AGATGAAAGTTCCTATAGTACAGGCCGGTGAAATGACCCAGCGTGTTCTATATTCAGGAACCGCTTCTATCGCCACCAATGC"
                    "TGCAGAAGGAACAGTTCTGGCTTCCTTTTCTATGGCAGAAGTTATGTCTGCACAGACAACGCATGCGCCAATGTTGCAGACA"
                    "TATGGGCGAGTTCCTGGCAAGGTTCTTTTGCGGAGCAAATGTCAAATTCCAGCTGCTTGTGGCATATCCTTGTTCTGGATCT"
                    "ACAAGGAGCGAGGGGTCCCCTATACATCACCGCTTGCTGTAAAACAGGCTGCATCTGATCCCCATATTTTTTGGAATCCAGC"
                    "TTGTCAGTCTTCTATAGATTTTTGGGTGGCCCCATTTTCATGCTCCTCCCATTGGATTCCTAGTTACTTTTCTAGCATGGAA"
                    "TCCCATTTTGTTCTAGCTTGTTCTACACCTTGGCAACAGGCTCCAAAAACAGCAGCTGCAGTACAATTTGCGCTCTATATGG"
                    "AACCTTCAGTCGAAGCCATACCAAGAATAACCAATGTTCTCTCCCCTGAGGGCATGGATTATTTTCGGTTTCTTGGGACCAT"
                    "AGCTTTTAAGCAACAAGCTTATGCCAGCGCGCAAGTGTTGGACCTCTCTCTTGGTCTTCCATGCATTTATAGCTCAGGGTTA"
                    "GGCCATAACAGTTGCTCAGCTATTATGTCACAATTCCAGTATTGGAAGGGAGATGTATTTGTTGAAATTGTTAAAGCTAGCT"
                    "CTCCTTTTGTGACTGCAACCATTTCAGTTGCTCTTCTTCCAGGTGGTAAGGCTTGGGCCACAGATCAGCGTAGTCTGTCTTT"
                    "GGTTCCTCATGTCACTGTGGCTATTGATCCCCAGGCCAGTAGATATGTCTGCAAAATACCTAAGGAAGTTACAGGTGCGCAT"
                    "TTGCTGGCTAACAATGAAATTGCCTCACTTTCACGAGGGAAGAAGCTTTCAGCTGTTCTTGCTATCTGGATTCGAGATAGTG"
                    "TTACTTCCAGTGTGGATGGAGATCTCACATTAAATGTTAGTGTGTCCCGGGTTGAAAACCTTGAATTCTTGGGATTTTCCAG"
                    "TGGATACCCTTTCTCTGCATCTCGTGCACAACTGTCTGTCAGTGAAGCCAAATATCAAGATGTCTTCAAGGTTACTATGCCA"
                    "GATACACAAAAAGGTGTTGCTGCTTATGAAATTCCTCTTCATAGACCTCTGTCTGTTACAGTCAATGATAAGGTGAATGTGG"
                    "GTATGGAAAGATATTATTGCCCTCTGGTTAACATACTTCAGACAAGTGCATGGGCAAGAGGTACAATATATTGGAGGCTTGT"
                    "CTGGTATAGCAAGCCCATACAGATGGCGCTGCGCACGAGTTGTTTGGATATTGAAGTCCATGAAACATCTATTACTGGGTCT"
                    "TACGCTTATTTTCGGGATAGTTCACACCTCCCATCTGGTAAGTTTGAGTGGGAGACTTATTTCACAGGACCTATTGATGGAT"
                    "TCATGTTCCTTGATGATAAGTTCGGTGGTCAGCAAGCCTTCACCACTCTTCGCGTGCAAGTTTCTGAGGCGTCTGAATGTTC"
                    "TGGCTTGATACTTATGGCCAAATTTGGTCCAGATTTTGCTGTTTCTGGAAGTGCTGGAGGCTTATATAGAAGTGTACCCAAA"
                    "ACAACTATGTCATCCATCGTTTCTATGTTTCCTTGATTTGCATTCTCGTTTTCTGATATCGTATAATCAGAACTACCAGAAG"
                    "TTTTCTGGTGTGCTGGCGGACACTTATTCTGTTTGGTTCTTCAAACCTGCTTGTTGGTTCAAGTAACCAATCCTCTCGTTGG"
                    "ATTTCGAGTCCCACCTGGGTTATGGTTTTATTTTGTTTGTGTTGTTTTCTCTCCTTTTGTTTGTTTGTAACTTTTGTTGAGA"
                    "ATTGGTGAAAGCCCAATCGAGCAC"
    }


@pytest.fixture
def test_merged_virus():
    return {
        "version": 0,
        "abbreviation": "PVF",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "isolate_id": "cab8b360",
                "sequences": [
                    {
                        "_id": "KX269872",
                        "annotated": True,
                        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                        "host": "sweet cherry",
                        "isolate_id": "cab8b360",
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTCGTTACCAGAAACTGCTTTCTACGTTCTCTGAACGTTTCTGTTTACTCATTGCTTT"
                                    "TGCGTACTCTTTTACTACGGAAATTTCTGAAAAGAATTTTCCTTCTTGATTCTTTTCTCTCTCTTTCTCATCCCTTTTTCTT"
                                    "CCTTCAGATTCTTCTATTTCCTTTGGTCACACTGTTGCTTTCGGTCTCTATGCAAACCTATAATCTTTTCAAAGATATTACG"
                                    "GGTTTTGAAACATACGCTGAATACGAGTTTGATCTGTTTACCAGTAGTTCCTGGTTGAATTACGAAGAAAGACGTGATCACA"
                                    "TATCCACGTTCGTGTCCAAACACCTCACCCCTTGCAAGCGCATATATCATCTTGATCAGAGAAAGACGCAGCGTCTTACGTA"
                                    "TTCAGAAAAATTCACGTCCTTTGTGATCAGCATACTCTTGATATCTCTTTATTACATATCCTCTCTTTCTCGCAAGCTTGAA"
                                    "AGGATGGCATTTCAGAGATCTTCACATAGTGCTGGTCTGGGGACTTCTGAAGTTCTCCAGGTACCTCTCGGAGCTGCTAACA"
                                    "CCATACCAGCAGATGTTTTGGCTGATCGCAGCAGAGCTTATCGTGAAACTGTTCCTTCACGTGCGTCAGTCCTGCCTCATTC"
                                    "ACGGGATGTGTATAGTGGTAGGGTTACTCGATTTATGCGCCTTGGTTGGCAGGGGCTGGTTGGAAATACAGCGACAACCATG"
                                    "CGCATCGAGAACGCAGAACTTACAGCACTTGGTGGCAATCATGTCGTTGATGTTCCCATACCTTTTTTGGGAACGGAAGCCA"
                                    "CGTCTGTGAATCCAGTGGTTATGGCCATGGATGAGCGTTTAACTCCATCTGTCCGGTCCAGCTCAGGGCCTAATCTGGCCCA"
                                    "CGTGGGAGTTGTAGAAATTCTTGTGGATGGGCTTGTAGCGCAGAATGCGTGTACTGTGGCAGGTGCACTACTGTATGATGCT"
                                    "CGACATCAAGACCGGGAACAAGCTTTTCTTGGTGCTTTTGCTTCTACAATAGCATCAGAACCATCACGGGTTCTATTTTACC"
                                    "CAGATCATACAGTCAGTTTATTGCAGGCTGATGCTGCGCGAACTCTCCATCTTGCTATCGTTCTGCCCAACAATGATATGCG"
                                    "TGAGCATGATATAGCTGCACACATCCGTGTTGGTTCCATCACTCAGTTCACTCGTGGGTCATTTGAATCCACCCACACAGCT"
                                    "CGTCTCATCAACCACACTAAAACTGATCGTGCTGAGGCAGTCCGTTATCTTGGACAGAATATGCATGTTATACACGCTGCTC"
                                    "CACGGCCTCGAGTTGAGATGCCAAACATTTCTATTCCATTTGGCAGGTCCATTTCTATGAGGCAAACTAGAACTTTGCAATG"
                                    "GGAAGCTGTCGAAAGACCTCGTCAATCTGTTGTTCTTCAATTTGACAATCCAAACAACAGATCAACGTTTTCTTTTGGCGCT"
                                    "AGCAATGCTGAAACTCCTCCTGTGAATCCTGATCCTGCGCTCAGTGAAAGTCAGGGACAAGCTGTTTCTTCTTTGGAAGTTG"
                                    "AGATGAAAGTTCCTATAGTACAGGCCGGTGAAATGACCCAGCGTGTTCTATATTCAGGAACCGCTTCTATCGCCACCAATGC"
                                    "TGCAGAAGGAACAGTTCTGGCTTCCTTTTCTATGGCAGAAGTTATGTCTGCACAGACAACGCATGCGCCAATGTTGCAGACA"
                                    "TATGGGCGAGTTCCTGGCAAGGTTCTTTTGCGGAGCAAATGTCAAATTCCAGCTGCTTGTGGCATATCCTTGTTCTGGATCT"
                                    "ACAAGGAGCGAGGGGTCCCCTATACATCACCGCTTGCTGTAAAACAGGCTGCATCTGATCCCCATATTTTTTGGAATCCAGC"
                                    "TTGTCAGTCTTCTATAGATTTTTGGGTGGCCCCATTTTCATGCTCCTCCCATTGGATTCCTAGTTACTTTTCTAGCATGGAA"
                                    "TCCCATTTTGTTCTAGCTTGTTCTACACCTTGGCAACAGGCTCCAAAAACAGCAGCTGCAGTACAATTTGCGCTCTATATGG"
                                    "AACCTTCAGTCGAAGCCATACCAAGAATAACCAATGTTCTCTCCCCTGAGGGCATGGATTATTTTCGGTTTCTTGGGACCAT"
                                    "AGCTTTTAAGCAACAAGCTTATGCCAGCGCGCAAGTGTTGGACCTCTCTCTTGGTCTTCCATGCATTTATAGCTCAGGGTTA"
                                    "GGCCATAACAGTTGCTCAGCTATTATGTCACAATTCCAGTATTGGAAGGGAGATGTATTTGTTGAAATTGTTAAAGCTAGCT"
                                    "CTCCTTTTGTGACTGCAACCATTTCAGTTGCTCTTCTTCCAGGTGGTAAGGCTTGGGCCACAGATCAGCGTAGTCTGTCTTT"
                                    "GGTTCCTCATGTCACTGTGGCTATTGATCCCCAGGCCAGTAGATATGTCTGCAAAATACCTAAGGAAGTTACAGGTGCGCAT"
                                    "TTGCTGGCTAACAATGAAATTGCCTCACTTTCACGAGGGAAGAAGCTTTCAGCTGTTCTTGCTATCTGGATTCGAGATAGTG"
                                    "TTACTTCCAGTGTGGATGGAGATCTCACATTAAATGTTAGTGTGTCCCGGGTTGAAAACCTTGAATTCTTGGGATTTTCCAG"
                                    "TGGATACCCTTTCTCTGCATCTCGTGCACAACTGTCTGTCAGTGAAGCCAAATATCAAGATGTCTTCAAGGTTACTATGCCA"
                                    "GATACACAAAAAGGTGTTGCTGCTTATGAAATTCCTCTTCATAGACCTCTGTCTGTTACAGTCAATGATAAGGTGAATGTGG"
                                    "GTATGGAAAGATATTATTGCCCTCTGGTTAACATACTTCAGACAAGTGCATGGGCAAGAGGTACAATATATTGGAGGCTTGT"
                                    "CTGGTATAGCAAGCCCATACAGATGGCGCTGCGCACGAGTTGTTTGGATATTGAAGTCCATGAAACATCTATTACTGGGTCT"
                                    "TACGCTTATTTTCGGGATAGTTCACACCTCCCATCTGGTAAGTTTGAGTGGGAGACTTATTTCACAGGACCTATTGATGGAT"
                                    "TCATGTTCCTTGATGATAAGTTCGGTGGTCAGCAAGCCTTCACCACTCTTCGCGTGCAAGTTTCTGAGGCGTCTGAATGTTC"
                                    "TGGCTTGATACTTATGGCCAAATTTGGTCCAGATTTTGCTGTTTCTGGAAGTGCTGGAGGCTTATATAGAAGTGTACCCAAA"
                                    "ACAACTATGTCATCCATCGTTTCTATGTTTCCTTGATTTGCATTCTCGTTTTCTGATATCGTATAATCAGAACTACCAGAAG"
                                    "TTTTCTGGTGTGCTGGCGGACACTTATTCTGTTTGGTTCTTCAAACCTGCTTGTTGGTTCAAGTAACCAATCCTCTCGTTGG"
                                    "ATTTCGAGTCCCACCTGGGTTATGGTTTTATTTTGTTTGTGTTGTTTTCTCTCCTTTTGTTTGTTTGTAACTTTTGTTGAGA"
                                    "ATTGGTGAAAGCCCAATCGAGCAC"
                    }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "modified": False,
        "name": "Prunus virus F",
        "username": "igboyes",
        "virus_id": "6116cba1"
    }


@pytest.fixture
def test_add_history(monkeypatch, mocker):
    m = mocker.Mock()

    async def fake_add_history(*args, **kwargs):
        return m(*args, **kwargs)

    monkeypatch.setattr("virtool.history.add", fake_add_history)

    return m


@pytest.fixture(scope="session")
def import_json_from_file():
    with gzip.open(os.path.join(FIXTURE_DIR, "files", "import.json.gz"), "rt") as handle:
        return json.load(handle)


@pytest.fixture(scope="function")
def import_json(import_json_from_file):
    return copy.deepcopy(import_json_from_file)


@pytest.fixture(scope="function")
def import_report():
    return {
        "progress": 1,
        "added": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": []
    }


def create_merged_virus():
    return {
        "last_indexed_version": 0,
        "abbreviation": "CMV",
        "modified": False,
        "_id": "067jz0t8",
        "_version": 0,
        "name": "Cucumber mosaic virus",
        "isolates": [
            {
                "sequences": [
                    {
                        "annotated": True,
                        "sequence": "CAT",
                        "_id": "NC_001440",
                        "definition": "Cucumber mosaic virus RNA 3, complete sequence",
                        "_version": 0,
                        "isolate_id": "dqz9u58g",
                        "host": None,
                        "length": 2216
                    }
                ],
                "source_name": "Fny",
                "isolate_id": "dqz9u58g",
                "source_type": "strain",
                "default": True
            },
            {
                "sequences": [
                    {
                        "annotated": True,
                        "sequence": "GAT",
                        "_id": "NC_001441",
                        "definition": "Cucumber mosaic virus RNA 2, complete sequence",
                        "_version": 0,
                        "isolate_id": "sad23gat",
                        "host": None,
                        "length": 2212
                    }
                ],
                "source_name": "Fny",
                "isolate_id": "sad23gat",
                "source_type": "strain",
                "default": False
            }
        ]
    }


@pytest.fixture
def virus_document():
    return {
        "last_indexed_version": 0,
        "abbreviation": "CMV",
        "modified": False,
        "_id": "067jz0t8",
        "_version": 0,
        "name": "Cucumber mosaic virus",
        "isolates": [
            {
                "source_name": "Fny",
                "isolate_id": "dqz9u58g",
                "source_type": "strain",
                "default": True
            },
            {
                "source_name": "Fny",
                "isolate_id": "sad23gat",
                "source_type": "strain",
                "default": False
            }
        ]
    }


@pytest.fixture
def sequences_list():
    return [
        {
            "annotated": True,
            "sequence": "CAT",
            "_id": "NC_001440",
            "definition": "Cucumber mosaic virus RNA 3, complete sequence",
            "_version": 0,
            "isolate_id": "dqz9u58g",
            "host": None,
            "length": 2216
        },
        {
            "annotated": True,
            "sequence": "GAT",
            "_id": "NC_001441",
            "definition": "Cucumber mosaic virus RNA 2, complete sequence",
            "_version": 0,
            "isolate_id": "sad23gat",
            "host": None,
            "length": 2212
        }
    ]


@pytest.fixture
def merged_virus():
    return create_merged_virus()


@pytest.fixture
def virus_list():
    first_virus = create_merged_virus()
    second_virus = create_merged_virus()
    third_virus = create_merged_virus()
    fourth_virus = create_merged_virus()

    second_virus.update({
        "_id": "067jz0t3",
        "abbreviation": "TST",
        "name": "Test Virus"
    })

    third_virus.update({
        "_id": "067jz213",
        "abbreviation": "EXV",
        "name": "Example Virus"
    })

    fourth_virus.update({
        "_id": "067jz1kj",
        "abbreviation": "FKV",
        "name": "Fake Virus"
    })

    for prefix, virus in [("second", second_virus), ("third", third_virus), ("fourth", fourth_virus)]:
        for i, isolate in enumerate(virus["isolates"]):
            isolate["isolate_id"] = "{}_{}".format(prefix, i)
            isolate["sequences"][0]["isolate_id"] = isolate["isolate_id"]
            isolate["sequences"][0]["_id"] = "{}_seq_{}".format(prefix, i)

    return [first_virus, second_virus, third_virus, fourth_virus]
