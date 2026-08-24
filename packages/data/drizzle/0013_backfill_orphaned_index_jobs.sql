-- Reconstruct a job for every orphaned legacy index build.
--
-- An orphaned build is an `indexes` row with neither `job_id` nor `task_id`: a
-- legacy `build_index` run whose job row was deleted before the Mongo->Postgres
-- jobs migration. The `ck_indexes_job_or_task` CHECK makes "both set"
-- impossible, so "neither set" is the exact predicate for these rows.
--
-- Each orphan gets its own minimal `build_index` job, marked `succeeded`
-- because these builds are live and ready. The real key, steps, and state
-- history are lost, but the workflow category is truthful, and `args` reads
-- back as `{ index_id }` from the restored `indexes.job_id` back-reference. Once
-- a build points at a job, `generateTaskIndex` treats it as job-backed and
-- refuses to rebuild it, which is the intended outcome.
--
-- Data-only and idempotent: the predicate skips any row already repaired, so a
-- re-run inserts nothing.
DO $$
DECLARE
	orphan RECORD;
	new_job_id integer;
BEGIN
	FOR orphan IN
		SELECT id, user_id, created_at
		FROM indexes
		WHERE job_id IS NULL AND task_id IS NULL
	LOOP
		INSERT INTO jobs (acquired, created_at, finished_at, state, user_id, workflow)
		VALUES (false, orphan.created_at, orphan.created_at, 'succeeded', orphan.user_id, 'build_index')
		RETURNING id INTO new_job_id;

		UPDATE indexes SET job_id = new_job_id WHERE id = orphan.id;
	END LOOP;
END $$;
