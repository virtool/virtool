/**
 * Composing the two `bash -c` pipelines this workflow runs.
 *
 * The runtime's subprocess runner never takes a shell string, so a pipeline is
 * spelled out here; both of the pieces below exist because getting a pipeline
 * wrong fails quietly rather than loudly.
 */

/**
 * Join commands into a pipeline that fails when any stage does.
 *
 * Without `pipefail` bash reports only the last command's status, and a
 * `bowtie2 | samtools view` whose bowtie2 is OOM-killed part way through has
 * already emitted a header and some alignments — so samtools writes a valid but
 * truncated BAM and exits 0, and the run finalizes an analysis from a partial
 * alignment set. Every pipeline this workflow runs must go through here.
 */
export function pipeline(...commands: readonly string[]): string {
	return `set -o pipefail; ${commands.join(" | ")}`;
}

/**
 * Quote a value for the shell.
 *
 * Read paths carry a name straight out of the sample's rows, so an unquoted
 * interpolation runs whatever that name spells. Every value interpolated into a
 * pipeline goes through this, including the paths composed from the work path —
 * which of the two a given path is is not visible at the call site.
 */
export function quote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}
