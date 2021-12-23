from typing import Dict, Any


async def attach_sample_count(db, document: dict) -> Dict[str, Any]:
    """
    Attach the number of samples associated with the given label to the passed document.

    """
    return {
        **document,
        "count": await db.samples.count_documents({"labels": document["id"]}),
    }
