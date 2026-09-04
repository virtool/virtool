-- Move cache storage budgets equal to the old default from 100 GiB to 100 GB.
--
-- The budget is stored in bytes and reasoned about in gigabytes, but the
-- original default was a binary 100 GiB (107374182400). The administration
-- field now reads and writes decimal GB, matching `byteSize` in the web app, so
-- an instance that never touched the setting would otherwise present its
-- default as 107.3741824 GB.
--
-- A budget explicitly set to 107374182400 bytes is indistinguishable from the
-- old default and is deliberately converted too. All other budgets are preserved.
--
-- Data-only and idempotent: the equality predicate matches nothing once the row
-- has been converted, so a re-run updates nothing.
UPDATE settings
SET cache_storage_budget = 100000000000
WHERE cache_storage_budget = 107374182400;
