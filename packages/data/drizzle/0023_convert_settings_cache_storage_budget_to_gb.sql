-- Convert the old 100 GiB default to 100 GB so the decimal GB field does not
-- display it as 107.3741824 GB. Budgets remain stored in bytes.
--
-- Explicitly configured 100 GiB budgets are indistinguishable from the old
-- default and are converted too. All other budgets are preserved; reruns do nothing.
UPDATE settings
SET cache_storage_budget = 100000000000
WHERE cache_storage_budget = 107374182400;
