from typing import Union


def parse_value(value: str) -> Union[bool, str]:
    if value == "false" or value == "False":
        return False

    if value == "true" or value == "True":
        return True

    return value
