from types import NoneType
from typing import get_type_hints

from virtool.api.model import RequestModel


class Thing(RequestModel):
    name: str = None
    nickname: str | None = None


class TestOmission:
    """Test that Pydantic 2 omission works as expected."""



class TestOmissionTyping:
    def test_inst(self):
        """Test that instantiation of a model with an omitted field works as
        expected.
        """
        inst = Thing()

        assert inst.name is None
        assert "name" not in inst.__pydantic_fields_set__

    def test_type_hints(self):
        """Test that type hints can be determined as required for introspection."""
        hints = get_type_hints(Thing)

        assert issubclass(NoneType, hints["nickname"])
        assert issubclass(str, hints["nickname"])
