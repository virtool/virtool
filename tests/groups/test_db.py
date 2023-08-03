from virtool.fake.next import DataFaker
from virtool.groups.transforms import AttachPrimaryGroupTransform, AttachGroupsTransform
from virtool.data.transforms import apply_transforms


async def create_fake_users_with_groups(
    faker: DataFaker = None,
    quantity: int = 1,
    use_primary_group: bool = False,
    use_groups: bool = False,
) -> list[dict] | dict:
    if quantity <= 0:
        return None
    
    fake_users: list[dict] = []

    for i in range(0, quantity):
        fake_user: dict = {}

        fake_user.update({"id": f"doc_{i}"})

        if use_primary_group:
            fake_user.update({"primary_group": (await faker.groups.create()).id})

        if use_groups:
            fake_user.update(
                {"groups": [(await faker.groups.create()).id for i in range(0, 2)]}
            )

        fake_users.append(fake_user)

    if len(fake_users) == 1:
        return fake_users[0]

    return fake_users


class TestAttachGroupTransform:
    async def test_primary_group_missing(self, snapshot, mongo):
        doc = await create_fake_users_with_groups(None, 1, False, False)

        complete_doc = await apply_transforms(doc, [AttachPrimaryGroupTransform(mongo)])

        assert complete_doc == snapshot

    async def test_primary_group_present(self, snapshot, fake2, mongo):
        doc = await create_fake_users_with_groups(fake2, 1, True, False)

        complete_doc = await apply_transforms(doc, [AttachPrimaryGroupTransform(mongo)])

        assert complete_doc == snapshot

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        docs = await create_fake_users_with_groups(fake2, 3, True, False)

        complete_docs = await apply_transforms(
            docs, [AttachPrimaryGroupTransform(mongo)]
        )

        assert complete_docs == snapshot


class TestAttachGroupsTransform:
    async def test_groups_missing(self, snapshot, mongo):
        doc = await create_fake_users_with_groups(None, 1, False, False)

        complete_doc = await apply_transforms(doc, [AttachGroupsTransform(mongo)])

        assert complete_doc == snapshot

    async def test_groups_present(self, snapshot, fake2, mongo):
        doc = await create_fake_users_with_groups(fake2, 1, False, True)

        complete_doc = await apply_transforms(doc, [AttachGroupsTransform(mongo)])

        assert complete_doc == snapshot

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        docs = await create_fake_users_with_groups(fake2, 3, False, True)

        complete_docs = await apply_transforms(docs, [AttachGroupsTransform(mongo)])

        assert complete_docs == snapshot
