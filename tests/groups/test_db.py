import pytest

from virtool.groups.transforms import AttachGroupTransform, AttachGroupsTransform
from virtool.data.transforms import apply_transforms


@pytest.mark.parametrize("quantity", ["one", "many"])
async def test_attach_group_transform(snapshot, fake2, mongo, quantity):
    match quantity:
        case "one":
            group = await fake2.groups.create()

            doc = {"_id": "doc", "group": {"id": group.id}}

            assert (
                await apply_transforms(doc, [AttachGroupTransform(mongo)]) == snapshot
            )

        case "many":
            group_0 = await fake2.groups.create()
            group_1 = await fake2.groups.create()
            group_2 = await fake2.groups.create()

            docs = [
                {"_id": "doc_0", "group": {"id": group_0.id}},
                {"_id": "doc_1", "group": {"id": group_1.id}},
                {"_id": "doc_2", "group": {"id": group_2.id}},
            ]

            assert (
                await apply_transforms(docs, [AttachGroupTransform(mongo)]) == snapshot
            )


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
