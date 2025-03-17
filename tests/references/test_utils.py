import pytest

from virtool.references.utils import (
    detect_duplicate_abbreviation,
    detect_duplicate_ids,
    detect_duplicate_isolate_ids,
    detect_duplicate_name,
    detect_duplicate_sequence_ids,
    detect_duplicates,
    get_owner_user,
    validate_otu,
)


class TestValidateOTU:
    def test_valid(self, test_merged_otu: dict):
        """Test that a valid OTU passes validation."""
        assert validate_otu(test_merged_otu) is None

    def test_missing_otu_field(self, test_merged_otu: dict):
        """Test that an OTU missing a required field fails validation."""
        del test_merged_otu["name"]

        assert validate_otu(test_merged_otu) == {
            "isolates": [],
            "otu": [
                {
                    "msg": "Field required",
                    "loc": ("name",),
                },
            ],
            "sequences": [],
        }

    def test_missing_isolate_field(self, test_merged_otu: dict):
        """Test that an OTU missing a required isolate field fails validation."""
        del test_merged_otu["isolates"][0]["source_name"]

        assert validate_otu(test_merged_otu) == {
            "isolates": [
                {
                    "msg": "Field required",
                    "loc": ("isolates", 0, "source_name"),
                    "isolate_id": "cab8b360",
                },
            ],
            "otu": [],
            "sequences": [],
        }

    def test_missing_sequence_field(self, test_merged_otu: dict):
        """Test that an OTU missing a required sequence field fails validation."""
        del test_merged_otu["isolates"][0]["sequences"][0]["sequence"]

        assert validate_otu(test_merged_otu) == {
            "isolates": [],
            "otu": [],
            "sequences": [
                {
                    "isolate_id": "cab8b360",
                    "msg": "Field required",
                    "loc": ("isolates", 0, "sequences", 0, "sequence"),
                    "sequence_id": "abcd1234",
                },
            ],
        }


@pytest.mark.parametrize("empty", [True, False])
@pytest.mark.parametrize("in_seen", [True, False])
def test_detect_duplicate_abbreviation(in_seen, empty, test_otu):
    seen = set()
    duplicates = set()

    if in_seen:
        seen.add("PVF")

    if empty:
        test_otu["abbreviation"] = ""

    detect_duplicate_abbreviation(test_otu, duplicates, seen)

    if in_seen or not empty:
        assert seen == {"PVF"}
    else:
        assert seen == set()

    if in_seen and not empty:
        assert duplicates == {"PVF"}
    else:
        assert duplicates == set()


@pytest.mark.parametrize("seen", [False, True])
def test_detect_duplicate_ids(seen, test_otu):
    duplicate_ids = set()
    seen_ids = set()

    if seen:
        seen_ids.add("6116cba1")

    detect_duplicate_ids(test_otu, duplicate_ids, seen_ids)

    assert duplicate_ids == ({"6116cba1"} if seen else set())
    assert seen_ids == {"6116cba1"}


@pytest.mark.parametrize("has_dups", [True, False])
def test_detect_duplicate_isolate_ids(has_dups, test_otu):
    extra_isolate = dict(test_otu["isolates"][0])

    if not has_dups:
        extra_isolate["id"] = "foobar"

    test_otu["isolates"].append(extra_isolate)

    duplicate_isolate_ids = {}

    detect_duplicate_isolate_ids(test_otu, duplicate_isolate_ids)

    if has_dups:
        assert duplicate_isolate_ids == {
            test_otu["_id"]: {"name": "Prunus virus F", "duplicates": ["cab8b360"]},
        }
    else:
        assert duplicate_isolate_ids == {}


@pytest.mark.parametrize("seen", [True, False])
@pytest.mark.parametrize("transform", [None, "lower", "upper"])
def test_detect_duplicate_name(seen, transform, test_otu):
    seen_names = set()

    if seen:
        seen_names.add("prunus virus f")

    if transform:
        transform_func = getattr(test_otu["name"], transform)
        transform_func()

    duplicates = set()

    detect_duplicate_name(test_otu, duplicates, seen_names)

    if seen:
        assert duplicates == {test_otu["name"]}
    else:
        assert duplicates == set()

    assert seen_names == {"prunus virus f"}


@pytest.mark.parametrize("intra", [True, False])
@pytest.mark.parametrize("seen", [True, False])
def test_detect_duplicate_sequence_ids(intra, seen, test_merged_otu):
    seen_sequence_ids = set()

    if intra:
        test_merged_otu["isolates"][0]["sequences"].append(
            test_merged_otu["isolates"][0]["sequences"][0],
        )

    if seen:
        seen_sequence_ids.add("abcd1234")

    duplicate_sequence_ids = set()

    detect_duplicate_sequence_ids(
        test_merged_otu,
        duplicate_sequence_ids,
        seen_sequence_ids,
    )

    if intra or seen:
        assert duplicate_sequence_ids == {"abcd1234"}
    else:
        assert duplicate_sequence_ids == set()

    assert seen_sequence_ids == {"abcd1234"}


@pytest.mark.parametrize("strict", [True, False])
def test_detect_duplicates(strict, test_merged_otu):
    otu_list = [test_merged_otu, test_merged_otu]

    otu_list[0]["isolates"].append(otu_list[0]["isolates"][0])

    result = detect_duplicates(otu_list, strict=strict)

    if strict:
        assert result == [
            {
                "duplicates": ["PVF"],
                "id": "duplicate_abbreviations",
                "message": "Duplicate OTU abbreviations found",
            },
            {
                "duplicates": ["6116cba1"],
                "id": "duplicate_ids",
                "message": "Duplicate OTU ids found",
            },
            {
                "duplicates": {
                    "6116cba1": {"duplicates": ["cab8b360"], "name": "Prunus virus F"},
                },
                "id": "duplicate_isolate_ids",
                "message": "Duplicate isolate ids found in some OTUs",
            },
            {
                "duplicates": ["Prunus virus F"],
                "id": "duplicate_names",
                "message": "Duplicate OTU names found",
            },
            {
                "duplicates": {"abcd1234"},
                "id": "duplicate_sequence_ids",
                "message": "Duplicate sequence ids found",
            },
        ]
    else:
        assert result == [
            {
                "duplicates": ["PVF"],
                "id": "duplicate_abbreviations",
                "message": "Duplicate OTU abbreviations found",
            },
            {
                "duplicates": ["Prunus virus F"],
                "id": "duplicate_names",
                "message": "Duplicate OTU names found",
            },
        ]


def test_get_owner_user(static_time):
    assert get_owner_user("fred", static_time.datetime) == {
        "id": "fred",
        "build": True,
        "modify": True,
        "modify_otu": True,
        "remove": True,
        "created_at": static_time.datetime,
    }
