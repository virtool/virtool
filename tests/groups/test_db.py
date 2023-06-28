import pytest

from virtool.groups.transforms import AttachGroupTransform, AttachGroupsTransform
from virtool.mongo.transforms import apply_transforms


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
            groups = [
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]

            doc = {"_id": "doc", "groups": [groups[0].id, groups[1].id, groups[2].id]}

            assert (
                await apply_transforms(doc, [AttachGroupsTransform(mongo)]) == snapshot
            )

        case "many":
            groups = [
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]

            docs = [
                {"_id": "doc_0", "groups": [groups[0].id, groups[1].id, groups[2].id]},
                {"_id": "doc_1", "groups": [groups[3].id, groups[4].id, groups[5].id]},
                {"_id": "doc_2", "groups": [groups[6].id, groups[7].id, groups[8].id]},
            ]

            assert (
                await apply_transforms(docs, [AttachGroupsTransform(mongo)]) == snapshot
            )
