-- Backfill analyses.workflow_version from the finalizing job's claim.
--
-- The column landed after analyses were already being finalized, so a finalized
-- analysis from before it — or one whose worker sent no version — carries a null
-- version even though the job that ran it recorded one in `jobs.claim`. That
-- claim's `workflow_version` is the executing version, minted when the runner
-- picked the job up, and is the truthful provenance to copy across.
--
-- Only finalized (`ready`) analyses with a still-null version and a claim that
-- carries a non-empty version are touched. An analysis whose job has no claim,
-- or whose claim omits the version, stays null — its version is unrecoverable,
-- not merely unknown. An analysis that already recorded a version keeps it: the
-- executing claim is never allowed to overwrite the finalizing stamp.
--
-- Data-only and idempotent: the null predicate skips every row a prior run
-- filled, so a re-run updates nothing.
UPDATE analyses AS a
SET workflow_version = j.claim ->> 'workflow_version'
FROM jobs AS j
WHERE a.job_id = j.id
	AND a.ready = true
	AND a.workflow_version IS NULL
	AND nullif(j.claim ->> 'workflow_version', '') IS NOT NULL;
