from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.ml.pg import SQLMLModelRelease
from virtool.types import Document


class AttachMLTransform(AbstractTransform):
    """Attach more ML model release detail to a document with a field `ml` that
    contains a ML model release id.

    If a document does not have `ml` field or it is `None`, the returned `ml` field will
    be set to `None`.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(
        self, document: Document, prepared: Document | None
    ) -> Document:
        return {**document, "ml": prepared}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        if ml_release_id := document.get("ml"):
            ml_release = await session.get(SQLMLModelRelease, ml_release_id)

            if ml_release:
                return {**ml_release.to_dict(), "model": ml_release.model.to_dict()}

        return None

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[str, list[Document | None]]:
        ml_model_release_ids = {d.get("ml") for d in documents}
        ml_model_release_ids.discard(None)

        model_releases = await session.execute(select(SQLMLModelRelease))

        lookup: dict[int | None, Document | None] = {
            ml.id: {**ml.to_dict(), "model": ml.model.to_dict()}
            for ml in model_releases.scalars().all()
        }

        lookup[None] = None

        return {d["id"]: lookup[d.get("ml")] for d in documents}
