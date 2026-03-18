import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.references.models import ReferenceDataType
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)
from virtool.references.utils import (
    ReferenceSourceData,
    ReferenceSourceIsolate,
    ReferenceSourceOTU,
    ReferenceSourceSequence,
)


class TestUpdate:
    @pytest.mark.parametrize("control_exists", [True, False])
    @pytest.mark.parametrize("control_id", [None, "", "baz"])
    async def test_control(
        self,
        control_exists: bool,
        control_id: str | None,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the `internal_control` field is correctly set with various `internal_control` input value and the case
        where the internal control ID refers to a non-existent OTU.
        The field should only be set when the input value is truthy and the control ID exists.
        """
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        )

        update = UpdateReferenceRequest(
            name="Tester",
            description="This is a test reference.",
        )

        if control_id is not None:
            update.internal_control = control_id

        mocker.patch(
            "virtool.references.db.get_internal_control",
            make_mocked_coro({"id": "baz"} if control_exists else None),
        )

        assert await data_layer.references.update("foo", update) == snapshot
        assert await mongo.references.find_one() == snapshot


class TestCreateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a user can be added to a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"), user_1.id
        )

        user = await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(
                build=True,
                modify_otu=True,
                user_id=user_2.id,
            ),
        )

        assert user.id == user_2.id
        assert user == snapshot(name="user_obj")
        assert await data_layer.references.get(reference.id) == snapshot(
            name="reference"
        )

    async def test_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that a user cannot be added to a reference if they are already a member."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [{"id": user_2.id, "build": True, "modify_otu": True}],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(
                    build=True,
                    modify_otu=True,
                    user_id=user_2.id,
                ),
            )

        assert "User already exists" in str(err)

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Test that a `NotFound` error is raised when the reference does not exist."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(
                    build=True, modify_otu=True, user_id=user.id
                ),
            )

    async def test_user_does_not_exist(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that a `NotFound` error is raised when the user does not exist."""
        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(build=True, modify_otu=True, user_id=99),
            )

        assert "User does not exist" in str(err)


class TestUpdateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference user can be updated."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
            },
        )

        assert await data_layer.references.update_user(
            "foo",
            user_2.id,
            ReferenceRightsRequest(
                modify_otu=False,
            ),
        ) == snapshot(name="obj_1")

        assert await data_layer.references.update_user(
            "foo",
            user_2.id,
            ReferenceRightsRequest(
                modify=True,
                modify_otu=True,
            ),
        ) == snapshot(name="obj_2")

        assert await mongo.references.find_one() == snapshot(name="mongo")

    @pytest.mark.parametrize("reference_exists", [True, False])
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user_1.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.update_user(
                "foo",
                user_1.id,
                ReferenceRightsRequest(
                    modify_otu=False,
                ),
            )


class TestDeleteUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a user can be deleted from a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
            },
        )

        assert await data_layer.references.delete_user("foo", user_2.id) is None

        document = await mongo.references.find_one()
        assert document["users"] == []
        assert document == snapshot

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user_1.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.delete_user("foo", "bar")


class TestCreateGroup:
    async def test_ok_and_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a group can be added to a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.create_group(
            "foo",
            CreateReferenceGroupRequest(
                build=True,
                modify_otu=True,
                group_id=group.id,
            ),
        ) == snapshot(name="obj")

        assert await mongo.references.find_one() == snapshot(name="mongo")

        # Try creating again to make sure an error is raised if the group already
        # exists.
        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(
                    build=True,
                    modify_otu=True,
                    group_id=group.id,
                ),
            )

        assert "Group already exists" in str(err)

    async def test_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that `ResourceNotFound` is raised when the reference does not exist."""
        group = await fake.groups.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(
                    build=True,
                    modify_otu=True,
                    group_id=group.id,
                ),
            )

    async def test_group_does_not_exist(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that `ResourceNotFound` is raised when the group does not exist."""
        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(build=True, modify_otu=True, group_id=21),
            )

        assert "Group does not exist" in str(err)


class TestUpdateGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference group can be updated."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.update_group(
            "foo",
            group.id,
            ReferenceRightsRequest(build=False, modify=True),
        ) == snapshot(name="obj")

        assert await mongo.references.find_one() == snapshot(name="mongo")

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.update_group(
                "foo",
                "bar",
                ReferenceRightsRequest(
                    modify_otu=False,
                ),
            )


class TestDeleteGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a group can be deleted from a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.delete_group("foo", group.id) is None

        document = await mongo.references.find_one()
        assert document["groups"] == []
        assert document == snapshot

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.delete_group("foo", "bar")


class TestUpdateRemoteReference:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
        mocker,
    ):
        """Test that a remote reference is updated correctly."""
        user = await fake.users.create()

        # Create a reference using the data layer
        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Remote Reference",
                organism="Original Organism",
                description="Remote reference description",
            ),
            user.id,
        )

        # Simulate existing remote reference with a pending update
        await mongo.references.update_one(
            {"_id": reference.id},
            {
                "$set": {
                    "remotes_from": {"slug": "virtool/ref-plant-viruses", "errors": []},
                    "updating": True,
                    "release": {
                        "id": 1,
                        "name": "v1.0.0",
                        "body": "This is a release.",
                        "etag": "etag",
                        "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
                        "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v1.0.0/reference.json.gz",
                        "published_at": static_time.datetime,
                        "retrieved_at": static_time.datetime,
                        "filename": "reference.json.gz",
                        "size": 1024,
                        "newer": True,
                        "content_type": "application/gzip",
                    },
                    "updates": [
                        {
                            "id": 1,
                            "name": "v1.0.0",
                            "body": "This is a release.",
                            "filename": "reference.json.gz",
                            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
                            "published_at": static_time.datetime,
                            "size": 1024,
                            "ready": False,
                            "user": {"id": user.id},
                            "created_at": static_time.datetime,
                            "newer": True,
                        }
                    ],
                }
            },
        )

        # Prepare ReferenceSourceData
        data = ReferenceSourceData(
            data_type=ReferenceDataType.genome,
            organism="Updated Organism",
            otus=[
                ReferenceSourceOTU(
                    _id="otu_1",
                    name="Cherry virus B",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="isolate_1",
                            default=True,
                            source_type="strain",
                            source_name="S3",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_1",
                                    accession="NC_076603.1",
                                    definition="Cherry virus B S3 genomic RNA, complete genome",
                                    sequence="GATAAGCACACGATCTATCAACAAACAACCTCACTCGACCCAGACTGAGACTGTTCGCAATGGCCCTATCTTACAGGAGCCCGATAGAAGAAGTACTTAA",
                                )
                            ],
                        )
                    ],
                )
            ],
        )

        release = {
            "id": 1,
            "name": "v1.0.0",
            "body": "This is a release.",
            "etag": "etag",
            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
            "published_at": "2022-01-01T00:00:00Z",
            "filename": "reference.json.gz",
            "size": 1024,
            "newer": False,
        }

        # Progress handler
        progress_handler = mocker.AsyncMock()

        # Call the function
        await data_layer.references.update_remote_reference(
            reference.id,
            data,
            release,
            user.id,
            progress_handler,
        )

        # Assertions
        assert await mongo.references.find_one({"_id": reference.id}) == snapshot
        assert (
            await mongo.otus.find({"reference.id": reference.id}).to_list(None)
            == snapshot
        )

    async def test_with_deletion(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
        mocker,
    ):
        """Test that an OTU is deleted if it's not in the new data."""
        user = await fake.users.create()

        # Create a reference using the data layer
        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Remote Reference",
                organism="Original Organism",
                description="Remote reference description",
            ),
            user.id,
        )

        # Simulate existing remote reference with a pending update
        await mongo.references.update_one(
            {"_id": reference.id},
            {
                "$set": {
                    "remotes_from": {"slug": "virtool/ref-plant-viruses", "errors": []},
                    "updating": True,
                    "release": {
                        "id": 1,
                        "name": "v1.0.0",
                        "body": "This is a release.",
                        "etag": "etag",
                        "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
                        "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v1.0.0/reference.json.gz",
                        "published_at": static_time.datetime,
                        "retrieved_at": static_time.datetime,
                        "filename": "reference.json.gz",
                        "size": 1024,
                        "newer": True,
                        "content_type": "application/gzip",
                    },
                    "updates": [
                        {
                            "id": 1,
                            "name": "v1.0.0",
                            "body": "This is a release.",
                            "filename": "reference.json.gz",
                            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
                            "published_at": static_time.datetime,
                            "size": 1024,
                            "ready": False,
                            "user": {"id": user.id},
                            "created_at": static_time.datetime,
                            "newer": True,
                        }
                    ],
                }
            },
        )

        # Add an OTU that should be deleted
        await mongo.otus.insert_one(
            {
                "_id": "otu_to_delete",
                "name": "Old OTU",
                "abbreviation": "OO",
                "version": 0,
                "reference": {"id": reference.id},
                "remote": {"id": "remote_otu_to_delete"},
                "isolates": [],
            }
        )

        # Prepare ReferenceSourceData (without the old OTU)
        data = ReferenceSourceData(
            data_type=ReferenceDataType.genome,
            organism="Updated Organism",
            otus=[
                ReferenceSourceOTU(
                    _id="otu_1",
                    name="Cherry virus B",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="isolate_1",
                            default=True,
                            source_type="strain",
                            source_name="S3",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_1",
                                    accession="NC_076603.1",
                                    definition="Cherry virus B S3 genomic RNA, complete genome",
                                    sequence="GATAAGCACACGATCTATCAACAAACAACCTCACTCGACCCAGACTGAGACTGTTCGCAATGGCCCTATCTTACAGGAGCCCGATAGAAGAAGTACTTAA",
                                )
                            ],
                        )
                    ],
                )
            ],
        )

        release = {
            "id": 1,
            "name": "v1.0.0",
            "body": "This is a release.",
            "etag": "etag",
            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
            "published_at": "2022-01-01T00:00:00Z",
            "filename": "reference.json.gz",
            "size": 1024,
            "newer": False,
        }

        # Progress handler
        progress_handler = mocker.AsyncMock()

        # Call the function
        await data_layer.references.update_remote_reference(
            reference.id,
            data,
            release,
            user.id,
            progress_handler,
        )

        # Assertions
        assert await mongo.otus.find_one({"_id": "otu_to_delete"}) is None
        assert await mongo.otus.count_documents({"reference.id": reference.id}) == 1
        assert await mongo.references.find_one({"_id": reference.id}) == snapshot
