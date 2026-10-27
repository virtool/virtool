/**
 * Read a job argument naming a resource.
 *
 * **Every arg value is a stringified id** — `args` is recomposed by the jobs API
 * from the resources that reference the job rather than read from a column, and
 * `Job.args` types it `Record<string, string>`. So this parses rather than
 * type-checks, and rejects anything `Number` would quietly accept: an empty
 * string is `0`, and a trailing-garbage id would silently address a different
 * row.
 *
 * A job pointing at no resource cannot be run, and failing here names the
 * argument rather than producing a 404 from a metadata read.
 */
export function readIdArg(args: Record<string, string>, name: string): number {
	const raw = args[name];

	if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
		throw new Error(
			`Job argument ${name} must be a positive integer id, got ${JSON.stringify(raw)}`,
		);
	}

	return Number(raw);
}
