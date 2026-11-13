---
virtool: minor
---

Use username as the only name for a user

Virtool now says **Username** everywhere it said **Handle**, for example on the
account page and on the user administration screens. A username is always kept
and shown in lowercase. You can type it in any case to sign in, to accept an
invitation, or to change it, and Virtool changes it to lowercase.

A user whose handle had uppercase letters now sees it in lowercase. Sign-in and
API keys continue to work for these users. A bookmarked user list that sorts by
handle must be sorted again.

The database migration changes each handle to a lowercase username. If a user
has a handle that is not a valid username, the migration stops before it changes
data and reports the user.
