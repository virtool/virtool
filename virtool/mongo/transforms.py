from abc import ABC, abstractmethod
from asyncio import gather
from typing import Any, Dict, List, Union

from virtool.types import Document


class AbstractTransform(ABC):
    @abstractmethod
    async def attach_one(self, document: Document, prepared: Any) -> Document:
        ...

    async def attach_many(
        self, documents: List[Document], prepared: Dict[str, Any]
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
