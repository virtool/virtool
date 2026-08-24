/*
 Drizzle Kit cannot convert populated serial columns safely. Lock each table,
 then start its identity sequence after both the old sequence's next value and
 the largest stored id.
*/
DO $$
DECLARE
	tbl text;
	seq text;
	next_id bigint;
BEGIN
	FOREACH tbl IN ARRAY ARRAY[
		'analysis_files',
		'api_keys',
		'caches',
		'groups',
		'index_files',
		'instance_messages',
		'jobs',
		'labels',
		'legacy_history_diff',
		'nuvs_blast',
		'sample_reads',
		'sessions',
		'subtraction_files',
		'tasks',
		'uploads',
		'users'
	] LOOP
		EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', tbl);

		seq := pg_get_serial_sequence(quote_ident(tbl), 'id');

		IF seq IS NULL THEN
			RAISE EXCEPTION 'table % has no sequence on id', tbl;
		END IF;

		EXECUTE format(
			'SELECT GREATEST(nextval(%L), COALESCE(max(id), 0) + 1) FROM %I',
			seq,
			tbl
		) INTO next_id;

		EXECUTE format('ALTER TABLE %I ALTER COLUMN id DROP DEFAULT', tbl);
		EXECUTE format('DROP SEQUENCE %s', seq);
		EXECUTE format(
			'ALTER TABLE %I ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME %I INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH %s CACHE 1)',
			tbl,
			tbl || '_id_seq',
			next_id
		);
	END LOOP;
END $$;
