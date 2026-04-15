import datetime

import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.references.bulk import BulkOTUUpdater
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


def _make_otu_r1(
    name: str = "OTU One",
    abbreviation: str = "OO",
    isolates: list | None = None,
) -> ReferenceSourceOTU:
    if isolates is None:
        isolates = [_make_iso_r1a(), _make_iso_r1b()]
    return ReferenceSourceOTU(
        _id="otu_r1", name=name, abbreviation=abbreviation, isolates=isolates
    )


def _make_otu_r2(isolates: list | None = None) -> ReferenceSourceOTU:
    if isolates is None:
        isolates = [_make_iso_r2()]
    return ReferenceSourceOTU(
        _id="otu_r2", name="OTU Two", abbreviation="OT", isolates=isolates
    )


def _make_otu_r3() -> ReferenceSourceOTU:
    return ReferenceSourceOTU(
        _id="otu_r3",
        name="OTU Three",
        abbreviation="OTH",
        isolates=[_make_iso_r3()],
    )


def _make_iso_r1a(source_name: str = "S3", sequences: list | None = None):
    if sequences is None:
        sequences = [_make_seq_r1a()]
    return ReferenceSourceIsolate(
        id="iso_r1a",
        default=True,
        source_type="strain",
        source_name=source_name,
        sequences=sequences,
    )


def _make_iso_r1b(sequences: list | None = None):
    if sequences is None:
        sequences = [_make_seq_r1b()]
    return ReferenceSourceIsolate(
        id="iso_r1b",
        default=False,
        source_type="isolate",
        source_name="NSW",
        sequences=sequences,
    )


def _make_iso_r2(sequences: list | None = None):
    if sequences is None:
        sequences = [_make_seq_r2a(), _make_seq_r2b()]
    return ReferenceSourceIsolate(
        id="iso_r2",
        default=True,
        source_type="strain",
        source_name="Standard",
        sequences=sequences,
    )


def _make_iso_r3():
    return ReferenceSourceIsolate(
        id="iso_r3",
        default=True,
        source_type="strain",
        source_name="Type",
        sequences=[_make_seq_r3()],
    )


def _make_seq_r1a(
    definition: str = "Sequence 1A", accession: str = "NC_000001"
) -> ReferenceSourceSequence:
    return ReferenceSourceSequence(
        _id="seq_r1a",
        accession=accession,
        definition=definition,
        sequence="ATGCATGCATGCATGC",
        host="Plants",
    )


def _make_seq_r1b() -> ReferenceSourceSequence:
    return ReferenceSourceSequence(
        _id="seq_r1b",
        accession="NC_000002",
        definition="Sequence 1B",
        sequence="GCTAGCTAGCTAGCTA",
        host="Plants",
    )


def _make_seq_r2a(
    definition: str = "Sequence 2A", accession: str = "NC_000003"
) -> ReferenceSourceSequence:
    return ReferenceSourceSequence(
        _id="seq_r2a",
        accession=accession,
        definition=definition,
        sequence="TTTTTTTTTTTTTTTT",
        host="Insects",
    )


def _make_seq_r2b() -> ReferenceSourceSequence:
    return ReferenceSourceSequence(
        _id="seq_r2b",
        accession="NC_000004",
        definition="Sequence 2B",
        sequence="AAAAAAAAAAAAAAAA",
        host="Insects",
    )


def _make_seq_r3() -> ReferenceSourceSequence:
    return ReferenceSourceSequence(
        _id="seq_r3",
        accession="NC_000005",
        definition="Sequence 3",
        sequence="CCCCCCCCCCCCCCCC",
        host="Fungi",
    )


class TestUpdateRemoteReference:
    """Tests for update_remote_reference covering all CRUD operations on OTUs,
    isolates, and sequences.

    A shared ``populated_reference`` fixture sets up a reference with 3 OTUs:

    - OTU 1 (remote id ``otu_r1``): 2 isolates (``iso_r1a``, ``iso_r1b``), 1 sequence
      each
    - OTU 2 (remote id ``otu_r2``): 1 isolate (``iso_r2``), 2 sequences
    - OTU 3 (remote id ``otu_r3``): 1 isolate (``iso_r3``), 1 sequence (``seq_r3``)

    Remote ids (``otu_r*``, ``iso_r*``, ``seq_r*``) are used exclusively for matching
    in all assertions. MongoDB-generated ``_id`` values are masked in snapshots with
    ``path_type`` matchers so that tests remain stable across runs.
    """

    @pytest.fixture
    async def populated_reference(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        mocker: MockerFixture,
        static_time,
    ) -> tuple[str, int, dict]:
        """Populate a remote reference and prepare it for a v1.1.0 update.

        Returns ``(ref_id, user_id, update_release)`` where ``update_release`` is the
        pending release whose ``id`` must be present in the reference ``updates`` array
        when ``update_remote_reference`` is called.

        ``random_alphanumeric`` is patched with deterministic values so that all
        MongoDB-generated ids produced during the initial populate are fixed and
        therefore stable in snapshots.
        """
        user = await fake.users.create()
        ref_id = "test_ref"

        initial_release = {
            "id": 1,
            "name": "v1.0.0",
            "body": "Initial release",
            "html_url": "https://github.com/virtool/ref/releases/tag/v1.0.0",
            "published_at": static_time.datetime,
            "filename": "reference.json.gz",
            "size": 1024,
            "newer": False,
        }

        await mongo.references.insert_one(
            {
                "_id": ref_id,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "Test remote reference",
                "groups": [],
                "internal_control": None,
                "name": "Test Reference",
                "organism": "virus",
                "remotes_from": {"slug": "virtool/ref-plant-viruses", "errors": []},
                "restrict_source_types": False,
                "source_types": [],
                "updating": True,
                "updates": [
                    {
                        **initial_release,
                        "created_at": static_time.datetime,
                        "ready": False,
                        "user": {"id": user.id},
                    }
                ],
                "user": {"id": user.id},
                "users": [],
            }
        )

        # Deterministic ids for prepare_otu_insertion call order:
        # for each OTU: OTU id, then per-isolate: isolate id then sequence id(s).
        mocker.patch(
            "virtool.references.alot.random_alphanumeric",
            side_effect=[
                # OTU 1 (otu_r1): isolates iso_r1a (seq_r1a) and iso_r1b (seq_r1b)
                "otu_db_1",
                "iso_db_1a",
                "seq_db_1a",
                "iso_db_1b",
                "seq_db_1b",
                # OTU 2 (otu_r2): isolate iso_r2 with seq_r2a and seq_r2b
                "otu_db_2",
                "iso_db_2",
                "seq_db_2a",
                "seq_db_2b",
                # OTU 3 (otu_r3): isolate iso_r3 with seq_r3
                "otu_db_3",
                "iso_db_3",
                "seq_db_3",
            ],
        )

        await data_layer.references.populate_remote_reference(
            ref_id,
            ReferenceSourceData(
                data_type=ReferenceDataType.genome,
                organism="Viruses",
                otus=[_make_otu_r1(), _make_otu_r2(), _make_otu_r3()],
            ),
            user.id,
            initial_release,
            mocker.AsyncMock(),
        )

        update_release = {
            "id": 2,
            "name": "v1.1.0",
            "body": "v1.1.0 release",
            "content_type": "application/gzip",
            "download_url": "https://github.com/virtool/ref/releases/download/v1.1.0/reference.json.gz",
            "html_url": "https://github.com/virtool/ref/releases/tag/v1.1.0",
            "published_at": static_time.datetime,
            "retrieved_at": static_time.datetime,
            "filename": "reference.json.gz",
            "size": 2048,
            "newer": True,
        }

        await mongo.references.update_one(
            {"_id": ref_id},
            {
                "$set": {"updating": True, "release": update_release},
                "$push": {
                    "updates": {
                        **update_release,
                        "created_at": static_time.datetime,
                        "ready": False,
                        "user": {"id": user.id},
                    }
                },
            },
        )

        return ref_id, user.id, update_release

    async def _run_update(
        self,
        data_layer: DataLayer,
        mocker: MockerFixture,
        ref_id: str,
        user_id: int,
        update_release: dict,
        otus: list[ReferenceSourceOTU],
        organism: str = "Viruses",
    ) -> None:
        await data_layer.references.update_remote_reference(
            ref_id,
            ReferenceSourceData(
                data_type=ReferenceDataType.genome,
                organism=organism,
                otus=otus,
            ),
            update_release,
            user_id,
            mocker.AsyncMock(),
        )

    async def _assert(
        self,
        ref_id: str,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ) -> None:
        """Assert final OTU, sequence, and history collections against snapshots.

        Dynamic MongoDB-generated ``_id`` values and timestamps are masked with
        ``path_type`` so that snapshots remain stable across runs. Stable remote ids
        and field values are captured verbatim.
        """
        otus = await mongo.otus.find(
            {"reference.id": ref_id}, sort=[("remote.id", 1)]
        ).to_list(None)

        sequences = await mongo.sequences.find(
            {"reference.id": ref_id}, sort=[("remote.id", 1)]
        ).to_list(None)

        history = sorted(
            await mongo.history.find({"reference.id": ref_id}).to_list(None),
            key=lambda h: (
                h["otu"]["name"],
                str(h["otu"]["version"]),
                h["method_name"],
                h["_id"],
            ),
        )

        assert otus == snapshot(
            name="otus",
            matcher=path_type(
                {r".*_id": (str,), r".*\.created_at": (datetime.datetime,)},
                regex=True,
            ),
        )

        assert sequences == snapshot(
            name="sequences",
            matcher=path_type(
                {r".*_id": (str,), r".*\.otu_id": (str,)},
                regex=True,
            ),
        )

        assert history == snapshot(
            name="history",
            matcher=path_type(
                {
                    r".*_id": (str,),
                    r".*\.created_at": (datetime.datetime,),
                    r".*\.description": (str,),
                    r".*\.otu\.id": (str,),
                },
                regex=True,
            ),
        )

    # -- OTU-level tests --

    async def test_otu_create(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """An OTU present in the remote data but absent from the installed reference
        (matched by ``remote.id``) is inserted with its isolates and sequences, and a
        create history record is written.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                _make_otu_r1(),
                _make_otu_r2(),
                _make_otu_r3(),
                # New OTU not present in the installed reference
                ReferenceSourceOTU(
                    _id="otu_r4",
                    name="OTU Four",
                    abbreviation="OF",
                    isolates=[
                        ReferenceSourceIsolate(
                            id="iso_r4",
                            default=True,
                            source_type="strain",
                            source_name="New",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_r4",
                                    accession="NC_000006",
                                    definition="Sequence 4",
                                    sequence="GGGGGGGGGGGGGGGG",
                                    host="None",
                                )
                            ],
                        )
                    ],
                ),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_otu_update(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """An OTU whose ``name`` or ``abbreviation`` differs in the remote data is
        updated and an update history record is written.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                # otu_r1: name and abbreviation changed
                _make_otu_r1(name="OTU One Renamed", abbreviation="OOR"),
                _make_otu_r2(),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_otu_delete(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """An OTU present in the installed reference whose ``remote.id`` is absent from
        the remote data is deleted along with all of its sequences, and a remove history
        record is written.
        """
        ref_id, user_id, update_release = populated_reference

        # otu_r3 is intentionally omitted from the update
        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[_make_otu_r1(), _make_otu_r2()],
        )

        await self._assert(ref_id, mongo, snapshot)

    # -- Isolate-level tests --

    async def test_isolate_create(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """A new isolate in the remote OTU (matched by ``remote.id``) that has no
        corresponding id in the installed OTU is inserted with its sequences, and an
        update history record is written for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                # otu_r1 gains a third isolate
                _make_otu_r1(
                    isolates=[
                        _make_iso_r1a(),
                        _make_iso_r1b(),
                        ReferenceSourceIsolate(
                            id="iso_r1c",
                            default=False,
                            source_type="strain",
                            source_name="QLD",
                            sequences=[
                                ReferenceSourceSequence(
                                    _id="seq_r1c",
                                    accession="NC_000007",
                                    definition="Sequence 1C",
                                    sequence="TTTAAAACCCGGGTTTT",
                                    host="Plants",
                                )
                            ],
                        ),
                    ]
                ),
                _make_otu_r2(),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_isolate_update(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """An isolate whose ``source_name`` or ``source_type`` differs in the remote
        data is updated and an update history record is written for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                # iso_r1a: source_name changed from "S3" to "S3-Updated"
                _make_otu_r1(
                    isolates=[_make_iso_r1a(source_name="S3-Updated"), _make_iso_r1b()]
                ),
                _make_otu_r2(),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_isolate_delete(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """An isolate present in the installed OTU whose id is absent from the remote
        OTU is removed along with its sequences, and an update history record is
        written for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                # otu_r1: iso_r1b removed
                _make_otu_r1(isolates=[_make_iso_r1a()]),
                _make_otu_r2(),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    # -- Sequence-level tests --

    async def test_sequence_create(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """A new sequence in the remote isolate (matched by ``remote.id``) that has no
        corresponding ``remote.id`` in the installed isolate is inserted, and an update
        history record is written for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                _make_otu_r1(),
                # iso_r2 gains a third sequence
                _make_otu_r2(
                    isolates=[
                        _make_iso_r2(
                            sequences=[
                                _make_seq_r2a(),
                                _make_seq_r2b(),
                                ReferenceSourceSequence(
                                    _id="seq_r2c",
                                    accession="NC_000008",
                                    definition="Sequence 2C",
                                    sequence="CGTACGTACGTACGTA",
                                    host="Insects",
                                ),
                            ]
                        )
                    ]
                ),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_sequence_update(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """A sequence whose ``accession``, ``definition``, ``host``, or ``sequence``
        fields differ in the remote data is updated in place, and an update history
        record is written for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                _make_otu_r1(),
                # seq_r2a: accession and definition updated
                _make_otu_r2(
                    isolates=[
                        _make_iso_r2(
                            sequences=[
                                _make_seq_r2a(
                                    accession="NC_000003.1",
                                    definition="Sequence 2A updated",
                                ),
                                _make_seq_r2b(),
                            ]
                        )
                    ]
                ),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_sequence_delete(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        """A sequence present in the installed isolate whose ``remote.id`` is absent
        from the remote isolate is deleted, and an update history record is written
        for the parent OTU.
        """
        ref_id, user_id, update_release = populated_reference

        await self._run_update(
            data_layer,
            mocker,
            ref_id,
            user_id,
            update_release,
            otus=[
                _make_otu_r1(),
                # seq_r2b removed from iso_r2
                _make_otu_r2(isolates=[_make_iso_r2(sequences=[_make_seq_r2a()])]),
                _make_otu_r3(),
            ],
        )

        await self._assert(ref_id, mongo, snapshot)

    async def test_update_fails(
        self,
        populated_reference: tuple,
        data_layer: DataLayer,
        mocker: MockerFixture,
        mongo: Mongo,
    ):
        """When an exception is raised after BulkOTUUpdater.finish completes, both the
        MongoDB and PostgreSQL transactions are rolled back and the database is restored
        to its exact pre-update state.

        The update data exercises every main operation that can occur during a remote
        reference update:

        - OTU create  (otu_r4: new OTU inserted with one isolate and sequence)
        - OTU update  (otu_r1: name and abbreviation changed)
        - OTU delete  (otu_r3: absent from update data, so it is removed)
        - Sequence update (seq_r1a: definition updated within otu_r1)
        - Sequence delete (seq_r1b: removed by dropping iso_r1b from otu_r1)
        - Sequence insert (seq_r2c: new sequence added to iso_r2 of otu_r2)

        BulkOTUUpdater.finish is patched to call the real implementation first — so
        all resources are genuinely written within the open transaction — before raising
        a RuntimeError that triggers rollback.
        """
        ref_id, user_id, update_release = populated_reference

        pre_otus = await mongo.otus.find(
            {"reference.id": ref_id}, sort=[("remote.id", 1)]
        ).to_list(None)
        pre_sequences = await mongo.sequences.find(
            {"reference.id": ref_id}, sort=[("remote.id", 1)]
        ).to_list(None)
        pre_history = await mongo.history.find(
            {"reference.id": ref_id},
            sort=[("otu.name", 1), ("otu.version", 1)],
        ).to_list(None)
        pre_ref = await mongo.references.find_one({"_id": ref_id})

        original_finish = BulkOTUUpdater.finish

        async def fail_after_finish(self):
            await original_finish(self)
            raise RuntimeError("Simulated failure after insertion")

        mocker.patch.object(BulkOTUUpdater, "finish", fail_after_finish)

        with pytest.raises(RuntimeError, match="Simulated failure after insertion"):
            await self._run_update(
                data_layer,
                mocker,
                ref_id,
                user_id,
                update_release,
                otus=[
                    # otu_r1: name and abbreviation updated; iso_r1b (and seq_r1b)
                    # dropped; seq_r1a definition updated.
                    _make_otu_r1(
                        name="OTU One Renamed",
                        abbreviation="OOR",
                        isolates=[
                            _make_iso_r1a(
                                sequences=[
                                    _make_seq_r1a(definition="Sequence 1A Updated")
                                ]
                            )
                        ],
                    ),
                    # otu_r2: seq_r2c inserted into iso_r2.
                    _make_otu_r2(
                        isolates=[
                            _make_iso_r2(
                                sequences=[
                                    _make_seq_r2a(),
                                    _make_seq_r2b(),
                                    ReferenceSourceSequence(
                                        _id="seq_r2c",
                                        accession="NC_000008",
                                        definition="Sequence 2C",
                                        sequence="CGTACGTACGTACGTA",
                                        host="Insects",
                                    ),
                                ]
                            )
                        ]
                    ),
                    # otu_r3 intentionally absent — will be deleted.
                    # otu_r4: entirely new OTU.
                    ReferenceSourceOTU(
                        _id="otu_r4",
                        name="OTU Four",
                        abbreviation="OF",
                        isolates=[
                            ReferenceSourceIsolate(
                                id="iso_r4",
                                default=True,
                                source_type="strain",
                                source_name="New",
                                sequences=[
                                    ReferenceSourceSequence(
                                        _id="seq_r4",
                                        accession="NC_000009",
                                        definition="Sequence 4",
                                        sequence="GGGGGGGGGGGGGGGG",
                                        host="None",
                                    )
                                ],
                            )
                        ],
                    ),
                ],
            )

        assert (
            await mongo.otus.find(
                {"reference.id": ref_id}, sort=[("remote.id", 1)]
            ).to_list(None)
            == pre_otus
        )
        assert (
            await mongo.sequences.find(
                {"reference.id": ref_id}, sort=[("remote.id", 1)]
            ).to_list(None)
            == pre_sequences
        )
        assert (
            await mongo.history.find(
                {"reference.id": ref_id},
                sort=[("otu.name", 1), ("otu.version", 1)],
            ).to_list(None)
            == pre_history
        )
        assert await mongo.references.find_one({"_id": ref_id}) == pre_ref


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
