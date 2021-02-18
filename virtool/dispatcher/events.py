from collections import defaultdict
from typing import Callable, Dict, List, Union

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from virtool.dispatcher.operations import Operation
from virtool.labels.models import Label
from virtool.uploads.models import Upload


def get_interface_from_model(obj) -> str:
    """
    Transform the passed model object into an dispatcher interface name.

    For example, a :class:``Label`` model will result in a string with the value `labels` being
    returned.

    :param obj: the model object
    :return: the interface string

    """
    if isinstance(obj, Upload):
        return "uploads"

    if isinstance(obj, Label):
        return "labels"

    raise TypeError("Not a transformable model: ", obj)


class DispatcherSQLEvents:
    """
    Listens on SQLAlchemy session events to know what models have changes on transaction commits.

    Calls enqueue change with the correct dispatcher interface and list of modified IDs when a
    transaction is committed. Gracefully handles rollbacks.

    Inspired by signalling in [Flask-SQLAlchemy](https://github.com/pallets/flask-sqlalchemy).

    """
    def __init__(self, enqueue_change: Callable[[str, Operation, List[Union[str, int]]], None]):
        self._enqueue_change = enqueue_change
        self._changes = defaultdict(dict)

        event.listen(Session, "before_flush", self._record_ops)
        event.listen(Session, "before_commit", self._record_ops)
        event.listen(Session, "after_commit", self._after_commit)
        event.listen(Session, "after_rollback", self._after_rollback)

    def _after_commit(self, session: Session):
        """
        Executed after a commit.

        Processes recorded changes and uses them to call :meth:`enqueue_change` as needed. Clears
        the record changes when complete.

        :param session: the session that was committed

        """
        changes = list(self._changes[id(session)].values())

        id_lists = dict()

        for data, change_type in changes:
            interface = get_interface_from_model(data)
            self._enqueue_change(interface, change_type, [data.id])

        del self._changes[id(session)]

    def _after_rollback(self, session: Session):
        """
        Executed after session rollback.

        Clears the records changes for the passed session.

        :param session: the session that was rolled back

        """
        del self._changes[id(session)]

    def _record_ops(self, session: Session, flush_context=None, instances=None):
        """
        Called when a session fires the `after_flush` or `before_commit` events.

        Records the operations that have occurred in the session and stores them so they can be
        sent via `enqueue_change` when the transaction is committed.

        The `flush_context` and `instances` arguments are included to match the callback function
        signature expected by SQLAlchemy for the `after_flush` or `before_commit` events. They are
        not used.

        :param session: the session the event was fired on
        :param flush_context: unused
        :param instances: unused

        """
        session_changes = self._changes[id(session)]

        for targets, operation in (
                (session.new, "insert"), (session.dirty, "update"), (session.deleted, "delete")):
            for target in targets:
                state = inspect(target)
                key = state.identity_key if state.has_identity else id(target)
                session_changes[key] = (target, operation)

