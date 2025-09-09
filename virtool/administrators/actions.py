from virtool.data.errors import ResourceError


def get_action_from_name(name: str) -> Action:
    """Derive an action from its name.

    :param name: the name of the action
    :return: the action
    """
    try:
        return actions[name]
    except KeyError:
        raise ResourceError("Invalid action name")
