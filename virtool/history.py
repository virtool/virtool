import dictdiffer


def calculate_diff(old, new):
    """
    Calculate the diff for a joined virus document before and after modification.

    :param old: the joined virus document before modification
    :type old: dict

    :param new: the joined virus document after modification
    :type new: dict

    :return: the diff
    :rtype: list

    """
    return list(dictdiffer.diff(old, new))
