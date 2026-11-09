---
virtool: minor
---

Let administrators revoke all of a user's access

A **Revoke** action in the Danger Zone of the user page signs a compromised user
out everywhere and removes their password, API keys, passkeys, two-factor
authentication, and outstanding links. It also marks their email address as not
verified, so the user can't recover the account by themselves and Virtool doesn't
email them. To restore access, issue a recovery link and give it to the user
through a channel you trust. Revoking an administrator requires the full
administrator role.
