"""Helpers for seeding samples with explicit rights."""

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.samples.models import Sample
from virtool.users.models import User


async def create_rights_sample(
    data_layer: DataLayer,
    fake: DataFaker,
    owner: User,
    *,
    ready: bool = False,
    all_read: bool = False,
    all_write: bool = False,
    group_read: bool = False,
    group_write: bool = False,
    group: int | None = None,
) -> Sample:
    """Create a sample owned by ``owner`` with explicit rights.

    Rights default to closed so a test only opens the ones it means to exercise.
    """
    sample = await fake.samples.create(owner, ready=ready)

    await data_layer.samples.update_rights(
        sample.id,
        {
            "all_read": all_read,
            "all_write": all_write,
            "group_read": group_read,
            "group_write": group_write,
            "group": group,
        },
    )

    return sample
