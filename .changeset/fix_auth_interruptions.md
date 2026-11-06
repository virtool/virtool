---
virtool: patch
---

Fix sign-in interruptions

- A malformed browser cookie no longer causes a server error when the user is
  signed out.
- When an administrator requires MFA during a session, Virtool now sends the
  user to MFA enrollment. Email remediation works the same way.
- Confirming your identity no longer signs you out when another request is in
  progress.
