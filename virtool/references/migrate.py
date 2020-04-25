TARGETS_QUERY = {
    "data_type": "barcode",
    "targets": {
        "$exists": False
    }
}


async def migrate_references(app):
    db = app["db"].motor_client

    await add_targets_field(db)


async def add_targets_field(db):
    await db.references.update_many(TARGETS_QUERY, {
        "$set": {
            "targets": []
        }
    })



