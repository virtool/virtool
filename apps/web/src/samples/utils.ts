import { stripMateToken } from "@uploads/pairing";
import type { JobNested, LibraryType, Upload } from "@virtool/contracts";
import type { CreateSampleRequest } from "./types";

/** The workflows that samples can be filtered by. */
export const filterableWorkflows = ["pathoscope", "nuvs"];

/** The state of a single workflow, as accepted by the sample filter API. */
export type WorkflowFilterState = "none" | "pending" | "ready";

const workflowFilterStateDisplayNames: Record<WorkflowFilterState, string> = {
	none: "Not analyzed",
	pending: "In progress",
	ready: "Complete",
};

export const workflowFilterStates = Object.keys(
	workflowFilterStateDisplayNames,
) as WorkflowFilterState[];

/**
 * Get the human-readable name of a workflow filter state.
 */
export function getWorkflowFilterStateDisplayName(
	state: WorkflowFilterState,
): string {
	return workflowFilterStateDisplayNames[state];
}

/** A sample filter selecting one state of one workflow. */
export type WorkflowFilter = {
	state: WorkflowFilterState;
	workflow: string;
};

function isWorkflowFilterState(value: string): value is WorkflowFilterState {
	return Object.hasOwn(workflowFilterStateDisplayNames, value);
}

/**
 * Encode a workflow filter as the ``workflow:state`` value used in the URL.
 */
export function formatWorkflowFilter({ state, workflow }: WorkflowFilter) {
	return `${workflow}:${state}`;
}

/**
 * Parse ``workflow:state`` filter values, discarding any that aren't recognized.
 */
export function parseWorkflowFilters(values: string[]): WorkflowFilter[] {
	return values.flatMap((value) => {
		const [workflow, state] = value.split(":");

		if (
			!workflow ||
			!state ||
			!filterableWorkflows.includes(workflow) ||
			!isWorkflowFilterState(state)
		) {
			return [];
		}

		return [{ state, workflow }];
	});
}

const libraryTypes: Record<string, string> = {
	normal: "Normal",
	srna: "sRNA",
	amplicon: "Amplicon",
};

export function getLibraryTypeDisplayName(libraryType: LibraryType) {
	return libraryTypes[libraryType];
}

const extensionRegex = /^(.*)\.(fq|fastq|fa|fasta)(\.gz)?$/i;

/**
 * Derives a sample name from the read files it will be created from. The read
 * extension is dropped, and for a pair the mate token (eg. ``_R1``) is dropped
 * too, so both mates yield the same name. Returns an empty string when the
 * first file doesn't look like a read file.
 *
 * @param reads - the read files, in [LEFT, RIGHT] order
 */
export function getSampleNameFromReads(reads: Upload[]): string {
	const first = reads[0]?.name;

	if (first === undefined) {
		return "";
	}

	// The mate token goes before the extension does. The dotted convention
	// (``sample.1.fastq.gz``) is recognised by the dot that follows the digit,
	// and dropping the extension first would take that dot away.
	const name = reads.length > 1 ? stripMateToken(first) : first;

	return name.match(extensionRegex)?.[1] ?? "";
}

/**
 * The sample fields a create-sample form collects. The metadata fields are
 * optional because not every form offers them.
 */
export type CreateSampleFormValues = {
	group: string;
	host?: string;
	isolate?: string;
	labels: number[];
	libraryType: string;
	locale?: string;
	name: string;
	subtractionIds: number[];
};

/**
 * Builds the request for creating a sample from the values a create-sample form
 * collected and the read files the sample will be created from. Metadata a form
 * doesn't offer is sent empty, and an unset group is sent as ``null``.
 *
 * @param values - the collected form values
 * @param files - the ids of the read files, in [LEFT, RIGHT] order
 */
export function getCreateSampleRequest(
	values: CreateSampleFormValues,
	files: number[],
): CreateSampleRequest {
	return {
		files,
		group: values.group || null,
		host: values.host ?? "",
		isolate: values.isolate ?? "",
		labels: values.labels,
		libraryType: values.libraryType,
		locale: values.locale ?? "",
		name: values.name,
		subtractions: values.subtractionIds,
	};
}

/**
 * Check if a sample can be deleted based on its state
 */
export function checkCanDeleteSample(ready: boolean, job?: JobNested): boolean {
	if (ready) {
		return true;
	}
	return job?.state === "failed" || job?.state === "cancelled";
}
