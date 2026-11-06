---
virtool: patch
---

Send web logs and browser errors to Sentry when the DSN comes from a file

When you set only `VT_SENTRY_DSN_FILE`, the web server did not forward logs to Sentry and the browser did not report errors. Both now use the value from the file.
