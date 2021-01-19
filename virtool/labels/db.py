async def attach_sample_count(db, document, label_id):
    return {
        **document,
        "count": await db.samples.count_documents({"labels": label_id})
    }
