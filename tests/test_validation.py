from virtool.validation import RequestModel, Unset, UnsetType


class TestModel(RequestModel):
    name: str
    nickname: str | UnsetType = Unset


class TestRequestModel:
    def test_set(self):
        model = TestModel(name="John", nickname="Johnny")

        assert model.name == "John"
        assert model.nickname == "Johnny"
        assert model.model_dump() == {
            "name": "John",
            "nickname": "Johnny",
        }

    def test_unset(self):
        model = TestModel.model_validate({"name": "John"})

        assert model.name == "John"
        assert model.nickname is UnsetType
        assert model.model_dump() == {
            "name": "John",
        }
