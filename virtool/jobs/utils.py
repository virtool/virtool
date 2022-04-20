from typing import Dict, List, Optional, Sequence, Union

import virtool.utils
from virtool.http.rights import MODIFY, READ, REMOVE, Right
from virtool.types import Document

WORKFLOW_NAMES = (
    "jobs_build_index",
    "jobs_create_sample",
    "jobs_create_subtraction",
    "jobs_aodp",
    "jobs_nuvs",
    "jobs_pathoscope_bowtie",
)


class JobRightsDomain:
    """
    Job rights that are specific to

    """

    def __init__(
        self,
        name: str,
        rights_dict: Optional[Dict[str, Dict[str, Sequence[Union[int, str]]]]] = None,
    ):
        self._name = name

        self._read = set()
        self._modify = set()
        self._remove = set()

        if rights_dict:
            domain = rights_dict.get(name)

            if domain:
                self.can_read(*domain.get(READ, []))
                self.can_modify(*domain.get(MODIFY, []))
                self.can_remove(*domain.get(REMOVE, []))

    def can_read(self, *id_list: Union[str, int]):
        """
        Set the passed resource IDs as readable by the rights holder.

        """
        self._read |= set(id_list)

    def can_modify(self, *id_list: Union[str, int]):
        """
        Set the passed resource IDs as modifiable by the rights holder.

        """
        self._modify |= set(id_list)

    def can_remove(self, *id_list: Union[str, int]):
        """
        Set the passed resource IDs as removable by the rights holder.

        """
        self._remove |= set(id_list)

    def has_right(self, id_, right: Right) -> bool:
        """
        Check that the holder of the rights has the ``right`` on a resource with a given
        ``id_``.

        :param id_: the resource ID
        :param right: the right
        :return: does the right holder have the right

        """
        if right == READ:
            return id_ in self._read

        if right == MODIFY:
            return id_ in self._modify

        if right == REMOVE:
            return id_ in self._remove

        raise ValueError(f"Right is unknown: {right}")

    def as_dict(self) -> Dict[str, List[str]]:
        """
        Return the dictionary representation of the rights.

        """
        rights_dict = dict()

        if len(self._read):
            rights_dict["read"] = sorted(self._read)

        if len(self._modify):
            rights_dict["modify"] = sorted(self._modify)

        if len(self._remove):
            rights_dict["remove"] = sorted(self._remove)

        return rights_dict


class JobRights:
    """
    Stores job rights for all resource types.

    """

    def __init__(self, rights_dict: Optional[Dict[str, dict]] = None):
        self.analyses = JobRightsDomain("analyses", rights_dict)
        self.indexes = JobRightsDomain("indexes", rights_dict)
        self.samples = JobRightsDomain("samples", rights_dict)
        self.subtractions = JobRightsDomain("subtractions", rights_dict)
        self.uploads = JobRightsDomain("uploads", rights_dict)
        self.references = JobRightsDomain("references", rights_dict)

    def as_dict(self) -> Dict[str, Dict[str, List[str]]]:
        """
        Return a dictionary representation of the rights.

        This is intended for writing the rights to a database or as JSON.

        """
        rights_dict = dict()

        for name, rights_domain in self.__dict__.items():
            rights_domain_dict = rights_domain.as_dict()

            if rights_domain_dict:
                rights_dict[name] = rights_domain_dict

        return rights_dict


def compose_status(
    state: Optional[str],
    stage: Optional[str],
    step_name: Optional[str] = None,
    step_description: Optional[str] = None,
    error: Optional[dict] = None,
    progress: Optional[int] = 0,
) -> Document:
    """
    Compose a status subdocument for a job.

    :param state: the current state
    :param stage: the current stage
    :param step_name: the name of the current step
    :param step_description: a description of the current step
    :param error: an error dict
    :param progress: the current progress
    :return: a status subdocument
    """
    return {
        "state": state,
        "stage": stage,
        "step_name": step_name,
        "step_description": step_description,
        "error": error,
        "progress": progress,
        "timestamp": virtool.utils.timestamp(),
    }
