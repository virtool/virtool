import {
	isJobStateUnsuccessful,
	type JobState,
	type SubtractionJobMinimal,
} from "@virtool/contracts";

/**
 * Derive a user-friendly FASTA filename from a subtraction name
 * (e.g. "Arabidopsis thaliana" -> "arabidopsis_thaliana.fa.gz").
 */
export function getSubtractionFastaName(name: string) {
	return `${name.toLowerCase().replace(/\s+/g, "_")}.fa.gz`;
}

/** How far a subtraction's create job has got. */
export type CreateJobStatus = {
	progress: number;
	state: JobState;
};

/**
 * Reconcile the two views a subtraction page holds of its create job.
 *
 * Neither is reliably the fresher one. The job query is updated by SSE frames
 * while it is mounted and skipped while it is not, so it can hold a `running`
 * state pinned fresh by its seed long after the job ended; the subtraction read
 * refetches on mount but no job event ever invalidates it. An unsuccessful
 * state is permanent, so whichever source reports one settles it.
 */
export function getCreateJobStatus(
	nested: SubtractionJobMinimal | null,
	fetched?: CreateJobStatus,
): CreateJobStatus | null {
	if (!nested) {
		return null;
	}

	if (!fetched || isJobStateUnsuccessful(nested.state)) {
		return { progress: nested.progress, state: nested.state };
	}

	return { progress: fetched.progress, state: fetched.state };
}
