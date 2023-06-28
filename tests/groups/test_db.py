import pytest

from virtool.groups.transforms import AttachGroupTransform
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
            # not yet implemented
            pass
