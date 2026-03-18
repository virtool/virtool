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
        """Test that a remote reference is updated correctly, including OTU and sequence syncing."""
        user = await fake.users.create()

        # 1. Setup initial Remote Reference
        # Mock github to avoid external calls when creating the reference
        mocker.patch(
            "virtool.github.get_release",
            return_value={
                "id": 1,
                "name": "v1.0.0",
                "body": "Initial release",
                "etag": "etag1",
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
                "published_at": static_time.datetime,
                "assets": [
                    {
                        "id": 1,
                        "name": "reference.json.gz",
                        "size": 1024,
                        "browser_download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v1.0.0/reference.json.gz",
                        "content_type": "application/gzip",
                    }
                ],
            },
        )

        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Remote Reference",
                organism="Original Organism",
                remote_from="virtool/ref-plant-viruses",
                release_id="1",
            ),
            user.id,
        )

        # Initial data for the reference
        initial_data = ReferenceSourceData(
            data_type=ReferenceDataType.genome,
            organism="Original Organism",
            otus=[
                ReferenceSourceOTU(
                    _id="otu_1",
                    name="Cherry virus B",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_1",
                            default=True,
                            source_type="strain",
                            source_name="S3",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_1",
                                    accession="NC_012345",
                                    definition="Original definition",
                                    sequence="ATGC" * 25,
                                    host="None",
                                )
                            ],
                        )
                    ],
                ),
                ReferenceSourceOTU(
                    _id="otu_2",
                    name="Apple virus A",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_2",
                            default=True,
                            source_type="strain",
                            source_name="Standard",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_2_1",
                                    accession="NC_222222",
                                    definition="Kept sequence",
                                    sequence="ATGC" * 25,
                                    host="None",
                                ),
                                ReferenceSourceSequence(
                                    _id="seq_2_2",
                                    accession="NC_111111",
                                    definition="To be removed",
                                    sequence="ATGC" * 25,
                                    host="None",
                                ),
                            ],
                        )
                    ],
                ),
            ],
        )

        initial_release = {
            "id": 1,
            "name": "v1.0.0",
            "body": "Initial release",
            "etag": "etag",
            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.0.0",
            "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v1.0.0/reference.json.gz",
            "published_at": static_time.datetime,
            "retrieved_at": static_time.datetime,
            "filename": "reference.json.gz",
            "size": 1024,
            "newer": False,
            "content_type": "application/gzip",
        }

        # Use the built-in populate_remote_reference to set the initial state
        await data_layer.references.populate_remote_reference(
            reference.id,
            initial_data,
            user.id,
            initial_release,
            mocker.AsyncMock(),
        )

        # 2. Update Logic (The "New" Reference)
        update_data = ReferenceSourceData(
            data_type=ReferenceDataType.genome,
            organism="Updated Organism",
            otus=[
                # Update: Existing OTU (otu_1) with modified data
                ReferenceSourceOTU(
                    _id="otu_1",
                    name="Cherry virus B updated",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_1",
                            default=True,
                            source_type="strain",
                            source_name="S3",
                            sequences=[
                                # Updated Sequence: definition changed
                                ReferenceSourceSequence(
                                    _id="seq_1",
                                    accession="NC_012345",
                                    definition="Updated definition",
                                    sequence="ATGC" * 25,
                                    host="None",
                                )
                            ],
                        )
                    ],
                ),
                # Sync: Existing OTU (otu_2) with one sequence removed and one added
                ReferenceSourceOTU(
                    _id="otu_2",
                    name="Apple virus A",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_2",
                            default=True,
                            source_type="strain",
                            source_name="Standard",
                            sequences=[
                                # Kept Sequence
                                ReferenceSourceSequence(
                                    _id="seq_2_1",
                                    accession="NC_222222",
                                    definition="Kept sequence",
                                    sequence="ATGC" * 25,
                                    host="None",
                                ),
                                # Added Sequence (New)
                                ReferenceSourceSequence(
                                    _id="seq_2_3",
                                    accession="NC_333333",
                                    definition="New sequence",
                                    sequence="GATC" * 25,
                                    host="None",
                                ),
                            ],
                        )
                    ],
                ),
                # Creation: Completely new OTU
                ReferenceSourceOTU(
                    _id="otu_3",
                    name="Plum virus C",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_3",
                            default=True,
                            source_type="strain",
                            source_name="P1",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_3_1",
                                    accession="NC_444444",
                                    definition="New OTU sequence",
                                    sequence="CGTA" * 25,
                                    host="None",
                                )
                            ],
                        )
                    ],
                ),
            ],
        )

        update_release = {
            "id": 2,
            "name": "v1.1.0",
            "body": "This is a release.",
            "etag": "etag2",
            "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.1.0",
            "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v1.1.0/reference.json.gz",
            "published_at": static_time.datetime,
            "retrieved_at": static_time.datetime,
            "filename": "reference.json.gz",
            "size": 1024,
            "newer": False,
            "content_type": "application/gzip",
        }

        # Simulate that a newer release was found and reference is marked for update
        await mongo.references.update_one(
            {"_id": reference.id},
            {
                "$set": {"updating": True, "release": update_release},
                "$push": {
                    "updates": {
                        "id": 2,
                        "name": "v1.1.0",
                        "body": "This is a release.",
                        "filename": "reference.json.gz",
                        "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v1.1.0",
                        "published_at": static_time.datetime,
                        "size": 1024,
                        "ready": False,
                        "user": {"id": user.id},
                        "created_at": static_time.datetime,
                        "newer": True,
                    }
                },
            },
        )

        # Call the function
        await data_layer.references.update_remote_reference(
            reference.id,
            update_data,
            update_release,
            user.id,
            mocker.AsyncMock(),
        )

        # 3. Assertions
        # Verify Reference metadata
        updated_ref = await mongo.references.find_one({"_id": reference.id})
        assert updated_ref["organism"] == "Updated Organism"
        assert updated_ref["updating"] is False
        assert updated_ref["installed"]["name"] == "v1.1.0"

        # Verify OTU count
        assert await mongo.otus.count_documents({"reference.id": reference.id}) == 3

        # Verify OTU 1 Update
        updated_otu_1 = await mongo.otus.find_one({"remote.id": "otu_1"})
        assert updated_otu_1["name"] == "Cherry virus B updated"

        # Verify Sequence 1 Update
        updated_seq_1 = await mongo.sequences.find_one({"remote.id": "seq_1"})
        assert updated_seq_1["definition"] == "Updated definition"
        assert updated_seq_1["accession"] == "NC_012345"
        assert updated_seq_1["sequence"] == "ATGC" * 25
        assert updated_seq_1["host"] == "None"

        # Verify OTU 2 Sync
        updated_otu_2 = await mongo.otus.find_one({"remote.id": "otu_2"})
        otu_2_sequences = await mongo.sequences.find(
            {"otu_id": updated_otu_2["_id"]}
        ).to_list(None)

        # Should have seq_2_1 and seq_2_3, but NOT seq_2_2
        assert len(otu_2_sequences) == 2
        remote_ids = {s["remote"]["id"] for s in otu_2_sequences}
        assert "seq_2_1" in remote_ids
        assert "seq_2_3" in remote_ids
        assert "seq_2_2" not in remote_ids

        seq_2_1 = next(s for s in otu_2_sequences if s["remote"]["id"] == "seq_2_1")
        assert seq_2_1["accession"] == "NC_222222"
        assert seq_2_1["definition"] == "Kept sequence"
        assert seq_2_1["sequence"] == "ATGC" * 25

        seq_2_3 = next(s for s in otu_2_sequences if s["remote"]["id"] == "seq_2_3")
        assert seq_2_3["accession"] == "NC_333333"
        assert seq_2_3["definition"] == "New sequence"
        assert seq_2_3["sequence"] == "GATC" * 25

        # Verify OTU 3 Creation
        updated_otu_3 = await mongo.otus.find_one({"remote.id": "otu_3"})
        assert updated_otu_3["name"] == "Plum virus C"
        assert (
            await mongo.sequences.count_documents({"otu_id": updated_otu_3["_id"]}) == 1
        )

        otu_3_seq = await mongo.sequences.find_one({"otu_id": updated_otu_3["_id"]})
        assert otu_3_seq["remote"]["id"] == "seq_3_1"
        assert otu_3_seq["accession"] == "NC_444444"
        assert otu_3_seq["definition"] == "New OTU sequence"
        assert otu_3_seq["sequence"] == "CGTA" * 25

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


class TestPopulateRemoteReference:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
        mocker,
    ):
        """Test that a remote reference is populated correctly."""
        user = await fake.users.create()

        release = {
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
        }

        # Simulate existing remote reference created by create_remote
        await mongo.references.insert_one(
            {
                "_id": "ref_id",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "Remote reference description",
                "name": "Remote Reference",
                "organism": "Original Organism",
                "remotes_from": {"slug": "virtool/ref-plant-viruses", "errors": []},
                "restrict_source_types": False,
                "source_types": ["strain", "isolate"],
                "updating": True,
                "release": release,
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
                "installed": None,
                "user": {"id": user.id},
                "groups": [],
                "users": [
                    {
                        "id": user.id,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "created_at": static_time.datetime,
                        "remove": True,
                    }
                ],
            }
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

        # Progress handler
        progress_handler = mocker.AsyncMock()

        mocker.patch(
            "virtool.references.alot.random_alphanumeric",
            side_effect=["otu_id_1", "iso_id_1", "seq_id_1"],
        )

        # Call the function
        await data_layer.references.populate_remote_reference(
            "ref_id",
            data,
            user.id,
            release,
            progress_handler,
        )

        # Assertions
        assert await mongo.references.find_one({"_id": "ref_id"}) == snapshot
        assert (
            await mongo.otus.find({"reference.id": "ref_id"}).to_list(None) == snapshot
        )
        assert (
            await mongo.history.find({"reference.id": "ref_id"}).to_list(None)
            == snapshot
        )
