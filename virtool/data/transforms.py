"""
Transforms are used to attach additional data to a dictionary before it is sent to the
client.

For example, you have a ``dict`` like the following:

.. code-block:: python

    label = {
        "id": 12,
        "name": "Apples",
        "color": "FF0000",
        "samples": ["abc123", "def456", "ghi789"],
        "user": {
            "id": "bob",
        }
    }

You have more information about the user and samples in separate collections and want to
attach it to the document before sending it to the client.

You can do this by writing two transforms that attach the user data to a dictionary with
a ``user`` ID at ``user.id`` and a list of sample IDs at `samples`.

You use :func:`apply_transforms` to apply the transforms to the label dictionary.

.. code-block:: python

    transformed = await apply_transforms(
        label,
        [AttachSamplesTransform(mongo), AttachUserTransform(mongo)]
    )

It is not efficient to serially perform each transform, so :func:`apply_transforms`
knows to prepare the data to be attached concurrently and then attach it when everything
is resolved.

Transforms are classes that inherit from :class:`AbstractTransform`. Minimally, you must
override the :meth:`prepare_one` and :meth:`attach_one` methods. If :meth:`prepare_many`
is not overridden, :meth:`prepare_one` will be called concurrently for each document in
the list.

Overriding :meth:`prepare_many` and :meth:`attach_many` allows you to optimize the
preparation and attachment of data to many documents. For example, if you wanted to
attach user data to a large list of documents, and you expect many of the documents to
have the same user ID, you could override :meth:`prepare_many` to only query the user
collection once for each unique user ID.

"""
from __future__ import annotations

from abc import ABC, abstractmethod
from asyncio import gather
from typing import Any, Dict, List, Union

from virtool.types import Document


class AbstractTransform(ABC):
    """
    A base class for writing transforms.

    Override the :meth:`prepare_one` and :meth:`attach_one` methods to implement attach
    data to a single document.

    Override the :meth:`prepare_many` and :meth:`attach_many` methods to implement an
    optimized flow for attaching data to many documents.

    """

    @abstractmethod
    async def attach_one(self, document: Document, prepared: Any) -> Document:
        """
        Attaches data to a single document.

        This method must be overriden to implement a transform.

        :param document:
        :param prepared:
        :return:
        """
        ...

    async def attach_many(
        self, documents: List[Document], prepared: Document
    ) -> List[Document]:
        return [
            await self.attach_one(document, prepared[document["id"]])
            for document in documents
        ]

    @abstractmethod
    async def prepare_one(self, document: Document) -> Any:
        ...

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        return {
            document["id"]: await self.prepare_one(document) for document in documents
        }


async def apply_transforms(
    documents: Union[Document, List[Document]], pipeline: List[AbstractTransform]
):
    """
    Apply a list of transforms to one or more documents.

    The function will concurrently prepare the data to be attached and then attach it to
    the documents. **Transforms are applied in the order they are listed**.

    If the transform includes optimized :meth:`prepare_many` and :meth:`attach_many`
    methods, they will be used. Otherwise, :meth:`prepare_one` and :meth:`attach_one`
    will be called concurrently for each document.

    :param documents: a single document or list of documents
    :param pipeline: a list of transforms to apply
    :return: one transformed document or a list of transformed documents
    """
    if isinstance(documents, list):
        all_prepared = await gather(
            *[transform.prepare_many(documents) for transform in pipeline]
        )

        for transform, prepared in zip(pipeline, all_prepared):
            documents = await transform.attach_many(documents, prepared)

        return documents

    for transform in pipeline:
        documents = await transform.attach_one(
            documents, await transform.prepare_one(documents)
        )

    return documents
