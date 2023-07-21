import pytest

from virtool.groups.transforms import AttachGroupTransform, AttachGroupsTransform
from virtool.data.transforms import apply_transforms


@pytest.mark.parametrize("quantity", ["one", "many"])
async def test_attach_group_transform(snapshot, fake2, mongo, quantity):
    match quantity:
        case "one":
            doc = {
                "_id": "doc_0",
                "group": {
                    "id": (await fake2.groups.create()).id,
                },
            }

            complete_doc = await apply_transforms(doc, [AttachGroupTransform(mongo)])

            assert complete_doc == snapshot

        case "many":
            docs = [
                {
                    "_id": "doc_0",
                    "group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
                {
                    "_id": "doc_1",
                    "group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
                {
                    "_id": "doc_2",
                    "group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
            ]

            complete_docs = await apply_transforms(docs, [AttachGroupTransform(mongo)])

            assert complete_docs == snapshot


@pytest.mark.parametrize("quantity", ["one", "many"])
async def test_attach_groups_transform(snapshot, fake2, mongo, quantity):
    match quantity:
        case "one":
            doc = {
                "_id": "doc",
                "groups": [
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                ],
            }

            complete_doc = await apply_transforms(doc, [AttachGroupsTransform(mongo)])

            assert complete_doc == snapshot

            assert (
                await apply_transforms(doc, [AttachGroupsTransform(mongo)]) == snapshot
            )

        case "many":
            docs = [
                {
                    "_id": "doc_0",
                    "groups": [
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
                {
                    "_id": "doc_1",
                    "groups": [
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
                {
                    "_id": "doc_2",
                    "groups": [
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
            ]

            complete_docs = await apply_transforms(docs, [AttachGroupsTransform(mongo)])

            assert complete_docs == snapshot
