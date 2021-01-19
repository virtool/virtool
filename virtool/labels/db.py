async def attach_sample_count(db, document, label_id):
    document.update({"count": await db.samples.count_documents({"labels": {"$in": [label_id]}})})
