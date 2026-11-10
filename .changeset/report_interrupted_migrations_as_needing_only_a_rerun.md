---
virtool: patch
---

Report interrupted migrations as needing only a rerun

When SIGTERM or SIGINT stopped `migrate`, it told the operator to inspect findings and remediate data, or it failed with `failed to apply migrations`. It now logs that the run was interrupted and that the operator must rerun `migrate`, and it exits non-zero. An interrupted data migration is recorded as `errored`, with the error `interrupted before the data migration finished`. It isn't reported to Sentry.
