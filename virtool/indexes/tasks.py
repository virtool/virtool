from sqlalchemy.ext.asyncio import AsyncSession

from virtool.indexes.db import FILES
from virtool.indexes.models import IndexFile, IndexType
from virtool.tasks.pg import update
from virtool.tasks.task import Task
from virtool.types import App
from virtool.utils import file_stats


class AddIndexFilesTask(Task):
    """
    Add a 'files' field to index documents to list what files can be downloaded for that index.
    """
    task_type = "add_index_files"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [
            self.store_index_files
        ]

    async def store_index_files(self):
        await update(
            self.pg,
            self.id,
            step="store_index_files"
        )

        async for index in self.db.indexes.find():
            try:
                if index["ready"] and not index["files"]:
                    raise KeyError

            except KeyError:
                index_id = index["_id"]

                path = self.app["config"].data_path / "references" / index_id

                async with AsyncSession(self.app["pg"]) as session:
                    for file_path in sorted(path.iterdir()):

                        if file_path.name in FILES:
                            size = file_stats(path)["size"]

                            session.add(
                                IndexFile(
                                    name=file_path.name,
                                    index=index_id,
                                    type=get_index_file_type_from_name(file_path.name),
                                    size=size
                                )
                            )

                    await session.commit()


def get_index_file_type_from_name(name: str) -> IndexType:
    if ".json" in name:
        return IndexType.json

    if ".fa" in name:
        return IndexType.fasta

    if ".bt" in name:
        return IndexType.bowtie2

    raise ValueError(f"Filename does not map to valid IndexType: {name}")
