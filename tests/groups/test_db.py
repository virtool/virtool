from virtool.groups.transforms import AttachPrimaryGroupTransform, AttachGroupsTransform
from virtool.data.transforms import apply_transforms


class TestAttachGroupTransform:
    async def test_primary_group_missing(self, snapshot, mongo):
        doc = {"id": "doc_0", "primary_group": None}

        complete_doc = await apply_transforms(doc, [AttachPrimaryGroupTransform(mongo)])

        assert complete_doc == snapshot

    async def test_primary_group_present(self, snapshot, fake2, mongo):
        doc = {"id": "doc_0", "primary_group": (await fake2.groups.create()).id}

        complete_doc = await apply_transforms(doc, [AttachPrimaryGroupTransform(mongo)])

        assert complete_doc == snapshot

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        docs = [
            {
                "id": "doc_0",
                "primary_group": (await fake2.groups.create()).id,
            },
            {
                "id": "doc_1",
                "primary_group": (await fake2.groups.create()).id,
            },
            {
                "id": "doc_2",
                "primary_group": (await fake2.groups.create()).id,
            },
        ]

        complete_docs = await apply_transforms(
            docs, [AttachPrimaryGroupTransform(mongo)]
        )

        assert complete_docs == snapshot


class TestAttachGroupsTransform:
    async def test_groups_missing(self, snapshot, mongo):
        doc = {"id": "doc", "groups": []}

        complete_doc = await apply_transforms(doc, [AttachGroupsTransform(mongo)])

        assert complete_doc == snapshot

    async def test_groups_present(self, snapshot, fake2, mongo):
        doc = {
            "id": "doc",
            "groups": [
                (await fake2.groups.create()).id,
                (await fake2.groups.create()).id,
            ],
        }

        complete_doc = await apply_transforms(doc, [AttachGroupsTransform(mongo)])

        assert complete_doc == snapshot

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        docs = [
            {
                "id": "doc_0",
                "groups": [
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                ],
            },
            {
                "id": "doc_1",
                "groups": [
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                ],
            },
            {
                "id": "doc_2",
                "groups": [
                    (await fake2.groups.create()).id,
                    (await fake2.groups.create()).id,
                ],
            },
        ]

        complete_docs = await apply_transforms(docs, [AttachGroupsTransform(mongo)])

        assert complete_docs == snapshot
