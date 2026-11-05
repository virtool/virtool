---
virtool: patch
---

Encrypt links in queued email

Recovery, verification, and invitation links are now encrypted while they wait
in the email queue. Virtool removes them from the database when a message is
sent or fails.
