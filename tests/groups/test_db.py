import pytest

from virtool.groups.transforms import AttachGroupTransform, AttachGroupsTransform
from virtool.data.transforms import apply_transforms


@pytest.mark.parametrize("quantity", ["none", "one", "many"])
async def test_attach_group_transform(snapshot, fake2, mongo, quantity):
    match quantity:
        case "none":
            doc = {"_id": "doc_0", "primary_group": None}

            complete_doc = await apply_transforms(doc, [AttachGroupTransform(mongo)])

            assert complete_doc == snapshot

        case "one":
            doc = {
                "_id": "doc_0",
                "primary_group": {
                    "id": (await fake2.groups.create()).id,
                },
            }

            complete_doc = await apply_transforms(doc, [AttachGroupTransform(mongo)])

            assert complete_doc == snapshot

        case "many":
            docs = [
                {
                    "_id": "doc_0",
                    "primary_group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
                {
                    "_id": "doc_1",
                    "primary_group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
                {
                    "_id": "doc_2",
                    "primary_group": {
                        "id": (await fake2.groups.create()).id,
                    },
                },
            ]

            complete_docs = await apply_transforms(docs, [AttachGroupTransform(mongo)])

            assert complete_docs == snapshot


@pytest.mark.parametrize("quantity", ["none", "one", "many"])
async def test_attach_groups_transform(snapshot, fake2, mongo, quantity):
    match quantity:
        case "none":
            doc = {"_id": "doc", "primary_group": None, "groups": []}

            complete_doc = await apply_transforms(
                doc, [AttachGroupTransform(mongo), AttachGroupsTransform(mongo)]
            )

            assert complete_doc == snapshot

        case "one":
            primary_group_id = (await fake2.groups.create()).id

            doc = {
                "_id": "doc",
                "primary_group": primary_group_id,
                "groups": [
                    primary_group_id,
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                ],
            }

            complete_doc = await apply_transforms(
                doc, [AttachGroupTransform(mongo), AttachGroupsTransform(mongo)]
            )

            assert complete_doc == snapshot

        case "many":
            primary_group_id_0 = (await fake2.groups.create()).id
            primary_group_id_1 = (await fake2.groups.create()).id
            primary_group_id_2 = (await fake2.groups.create()).id

            docs = [
                {
                    "_id": "doc_0",
                    "primary_group": primary_group_id_0,
                    "groups": [
                        primary_group_id_0,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
                {
                    "_id": "doc_1",
                    "primary_group": primary_group_id_1,
                    "groups": [
                        primary_group_id_1,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
                {
                    "_id": "doc_2",
                    "primary_group": primary_group_id_2,
                    "groups": [
                        primary_group_id_2,
                        (await fake2.groups.create()).id,
                        (await fake2.groups.create()).id,
                    ],
                },
            ]

            complete_docs = await apply_transforms(
                docs, [AttachGroupTransform(mongo), AttachGroupsTransform(mongo)]
            )

            assert complete_docs == snapshot
