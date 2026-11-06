---
virtool: patch
---

Lock identity checks after repeated failures and refuse reused authenticator codes

Ten failed password or authenticator code attempts at an identity check now
block those two methods for 15 minutes. A correct password or code resets the
count, and a passkey still works during the block. An authenticator code that an
identity check already accepted is now refused.
