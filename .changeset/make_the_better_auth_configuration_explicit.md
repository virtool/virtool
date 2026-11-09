---
virtool: patch
---

Configure authentication only from Virtool's own variables

The web server does not start when `BETTER_AUTH_SECRETS` or
`BETTER_AUTH_TRUSTED_ORIGINS` is set, because Better Auth would use them in
place of, or in addition to, `VT_AUTH_SECRET` and `VT_PUBLIC_ORIGIN`. Unset them
before you upgrade. The setup and login device cookies are now `Secure` when
`VT_PUBLIC_ORIGIN` uses `https`, the same as the session cookies.
