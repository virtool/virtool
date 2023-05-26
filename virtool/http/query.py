from typing import Union


def parse_value(value: str) -> Union[bool, str]:
    if value in {"false", "False"}:
        return False

    if value in {"true", "True"}:
        return True

    return value
