---
virtool: patch
---

Remove the unused job permissions

Groups and API keys no longer show the `cancel_job` and `remove_job` permissions. These permissions did not give access to any action. The database migration removes them from all groups and API keys.
