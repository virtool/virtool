"""
Easily create fake data.

# Dependencies

A sample needs a user and upload to exist.
```py

```

"""
import inspect
from dataclasses import dataclass
from typing import Type, List, Optional, Dict

from faker import Faker
from faker.providers import BaseProvider
from pydantic import BaseModel
from virtool_core.models.analysis import Analysis
from virtool_core.models.group import Group
from virtool_core.models.index import Index
from virtool_core.models.reference import Reference
from virtool_core.models.samples import Sample
from virtool_core.models.upload import Upload
from virtool_core.models.user import User

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.data.layer import DataLayer
from virtool.labels.models import Label


class VirtoolProvider(BaseProvider):
    def mongo_id(self):
        return self.random_letters(8)

    def pg_id(self) -> int:
        return self.random_int()


class FakeDataResource:
    model = None
    depends_on = None

    def __init__(self, faker: Faker):
        self.faker = faker
        self._inserted_ids = []

    async def create(self, layer: DataLayer) -> Dict:
        ...


class GroupResource(FakeDataResource):
    model = Group

    def create(self, layer: DataLayer) -> Group:
        return await layer.groups.create(self.faker.mongo_id())


class UserResource(FakeDataResource):
    model = User
    depends_on = [Group]

    def create(self):
        return {
            "_id": self.faker.mongo_id(),
            "group": {"id": Group.id},
        }


class FakeDataLayer:
    def __init__(self, layer: DataLayer):
        self._layer = layer

        self._resources = []
        self._models = []
        self._resources_by_model = {}

        self._faker = Faker()
        self._faker.seed_instance(0)
        self._faker.add_provider(VirtoolProvider)

        self.groups = self.add_resource(GroupResource)
        self.users = self.add_resource(UserResource)

    def add_resource(self, cls: Type[FakeDataResource]) -> FakeDataResource:
        if cls.depends_on:
            for dep in cls.depends_on:
                if dep not in self._models:
                    raise ValueError(f"Resource definition missing: {dep}")

        resource = cls(self._faker)

        self._models.append(cls.model)
        self._resources.append(cls(self._faker))
        self._resources_by_model[cls.model.__name__] = resource

        return resource


def create_fake_data_layer(layer):
    fdl = FakeDataLayer(layer)

    # layer.add_resource(User, lambda faker: {}, depends_on=[Group])
    # layer.add_resource(Label, lambda faker: {})

    # layer.add_resource(FakeDataResource(Upload, depends_on=[User]))
    # layer.add_resource(FakeDataResource(Sample, depends_on=[User, Upload]))
    # layer.add_resource(FakeDataResource(Reference, depends_on=[User]))
    # layer.add_resource(FakeDataResource(Index, depends_on=[Reference]))
    # layer.add_resource(FakeDataResource(Analysis, depends_on=[User, Sample, Index]))

    return fdl
