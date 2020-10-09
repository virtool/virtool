import virtool.types
import virtool.users.utils


async def migrate_groups(app: virtool.types.App):
    """
    Ensure that the permissions object for each group matches the permissions defined in
    `virtool.users.utils.PERMISSIONS`.

    :param app: the application object

    """
    db = app["db"]

    async for group in db.groups.find():
        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.utils.PERMISSIONS}
            }
        }, silent=True)