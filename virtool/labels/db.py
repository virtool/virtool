async def count_samples(db, label_id):
    return await db.samples.count_documents({"labels": {"$in": [label_id]}})
