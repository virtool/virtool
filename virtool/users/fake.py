from logging import getLogger

from virtool_core.models.user import User

from virtool.administrators.oas import UpdateUserRequest
from virtool.users.data import UsersData

logger = getLogger(__name__)


async def create_fake_bob_user(users_data: UsersData) -> User:
    """
    Create a fake user called Bob.

    :param users_data: the user data layer component
    :returns: the bob user

    """
    user = await users_data.create("bob", "hello_world", True)
    user = await users_data.update(
        user.id, UpdateUserRequest(administrator=True, force_reset=False)
    )
    return user
