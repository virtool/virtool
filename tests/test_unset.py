from pydantic import BaseModel

from virtool.validation_2 import Unset


class ExampleModel(BaseModel):
    a: str
    b: str | Unset = Unset()
    c: str | None | Unset = Unset()
    d: int | None | Unset = None


def test_basic():
    model = ExampleModel(a="John")

    assert model.a == "John"
    assert model.b is Unset()
    assert model.c is Unset()
    assert model.d is None

    assert model.model_dump() == {
        "a": "John",
        "b": Unset(),
        "c": Unset(),
        "d": None,
    }


def test_from_python_unset():
    model = ExampleModel.model_validate({"a": "Fred"})

    assert model.model_dump() == {
        "a": "Fred",
        "b": Unset(),
        "c": Unset(),
        "d": None,
    }
