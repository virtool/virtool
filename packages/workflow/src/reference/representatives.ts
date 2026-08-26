import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { RunSubprocess } from "../subprocess/types";
import { matchToolVersion } from "../subprocess/version";

/** The CD-HIT-EST executable used for reference representative selection. */
export const CD_HIT_EST_TOOL = "cd-hit-est";

/** The fixed representative-selection policy shared by workflow consumers. */
export const REFERENCE_REPRESENTATIVE_POLICY = {
	coverage: "none",
	identity: "0.80",
	minimumLength: "9",
	tool: CD_HIT_EST_TOOL,
	version: "otu-segment-v1",
	wordSize: "5",
} as const;

/** A sequence accepted by the representative selector. */
export type RepresentativeInputSequence = {
	id: string;
	segment: string | null;
	sequence: string;
};

/** An OTU accepted by the representative selector. */
export type RepresentativeInputOtu<
	TSequence extends RepresentativeInputSequence = RepresentativeInputSequence,
> = {
	id: string;
	isolates: readonly { sequences: readonly TSequence[] }[];
	schema: readonly { name: string }[];
};

/** An original source sequence selected as a CD-HIT-EST representative. */
export type ReferenceRepresentative<
	TSequence extends RepresentativeInputSequence = RepresentativeInputSequence,
> = TSequence & {
	groupSegment: string | null;
	otuId: string;
};

/** Options for streaming reference representative selection. */
export type SelectReferenceRepresentativesOptions<
	TSequence extends RepresentativeInputSequence,
> = {
	concurrency: number;
	otus: AsyncIterable<RepresentativeInputOtu<TSequence>>;
	runSubprocess: RunSubprocess;
	scratchPath: string;
};

type SequenceGroup<TSequence extends RepresentativeInputSequence> = {
	index: number;
	otuId: string;
	segment: string | null;
	sequences: TSequence[];
};

type ParsedClusters = {
	members: Set<string>;
	representatives: string[];
};

function getSafeFilenamePart(value: string, fallback: string): string {
	const part = value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);

	return part === "" ? fallback : part;
}

function getGroupStem<TSequence extends RepresentativeInputSequence>(
	group: SequenceGroup<TSequence>,
): string {
	const otu = getSafeFilenamePart(group.otuId, "otu");
	const segment =
		group.segment === null
			? "unsegmented"
			: getSafeFilenamePart(group.segment, "segment");
	const index = String(group.index).padStart(8, "0");

	return `${otu}_${segment}_${index}`;
}

/** Read `cd-hit-est`'s version from its non-zero help invocation. */
export async function getCdHitEstVersion(
	runSubprocess: RunSubprocess,
): Promise<string> {
	const lines: string[] = [];

	function collect(line: string): void {
		lines.push(line);
	}

	try {
		await runSubprocess({
			command: [CD_HIT_EST_TOOL, "-h"],
			stderr: collect,
			stdout: collect,
		});
	} catch {
		// cd-hit-est prints its version banner from `-h` and exits non-zero.
	}

	return matchToolVersion(
		/\bCD-HIT\s+version\s+(\S+)/,
		lines,
		"Could not parse cd-hit-est version",
	);
}

function groupOtu<TSequence extends RepresentativeInputSequence>(
	otu: RepresentativeInputOtu<TSequence>,
): Array<Omit<SequenceGroup<TSequence>, "index">> {
	const sequences = otu.isolates.flatMap((isolate) => isolate.sequences);

	if (otu.schema.length === 0) {
		if (sequences.length === 0) {
			throw new Error(`Unsegmented OTU ${otu.id} has no sequences`);
		}

		for (const sequence of sequences) {
			if (sequence.segment !== null && sequence.segment !== "") {
				throw new Error(
					`Sequence ${sequence.id} of unsegmented OTU ${otu.id} declares segment ${sequence.segment}`,
				);
			}
		}

		return [{ otuId: otu.id, segment: null, sequences }];
	}

	const segments = otu.schema.map(({ name }) => name);
	const groups = new Map<string, TSequence[]>();

	for (const segment of segments) {
		if (segment === "" || groups.has(segment)) {
			throw new Error(`OTU ${otu.id} has an invalid segment schema`);
		}

		groups.set(segment, []);
	}

	for (const sequence of sequences) {
		const group = groups.get(sequence.segment ?? "");

		if (group === undefined) {
			throw new Error(
				`Sequence ${sequence.id} of OTU ${otu.id} has undeclared segment ${String(sequence.segment)}`,
			);
		}

		group.push(sequence);
	}

	return [...groups].map(([segment, groupedSequences]) => {
		if (groupedSequences.length === 0) {
			throw new Error(`OTU ${otu.id} segment ${segment} has no sequences`);
		}

		return { otuId: otu.id, segment, sequences: groupedSequences };
	});
}

async function* iterateGroups<TSequence extends RepresentativeInputSequence>(
	otus: AsyncIterable<RepresentativeInputOtu<TSequence>>,
): AsyncGenerator<SequenceGroup<TSequence>> {
	let index = 0;

	for await (const otu of otus) {
		for (const group of groupOtu(otu)) {
			yield { ...group, index };
			index += 1;
		}
	}
}

function flushCluster(
	members: string[],
	representative: string | null,
	parsed: ParsedClusters,
): void {
	if (members.length === 0 || representative === null) {
		throw new Error("CD-HIT cluster is incomplete");
	}

	parsed.representatives.push(representative);

	for (const member of members) {
		if (parsed.members.has(member)) {
			throw new Error(`CD-HIT output repeats sequence ${member}`);
		}

		parsed.members.add(member);
	}
}

async function parseClusters(path: string): Promise<ParsedClusters> {
	const parsed: ParsedClusters = {
		members: new Set(),
		representatives: [],
	};

	let hasCluster = false;
	let members: string[] = [];
	let representative: string | null = null;

	const lines = createInterface({
		crlfDelay: Number.POSITIVE_INFINITY,
		input: createReadStream(path),
	});

	for await (const rawLine of lines) {
		const line = rawLine.trim();

		if (line === "") {
			continue;
		}

		const header = /^>Cluster\s+\d+$/.exec(line);

		if (header !== null) {
			if (hasCluster) {
				flushCluster(members, representative, parsed);
			}

			hasCluster = true;
			members = [];
			representative = null;
			continue;
		}

		const member = /^\d+\s+\d+nt,\s+>(.+)\.\.\.\s+(.+)$/.exec(line);

		if (!hasCluster || member === null) {
			throw new Error(`Could not parse CD-HIT cluster line: ${rawLine}`);
		}

		const sequenceId = member[1] ?? "";
		const suffix = member[2] ?? "";

		if (sequenceId === "" || (suffix !== "*" && !suffix.startsWith("at "))) {
			throw new Error(`Could not parse CD-HIT cluster line: ${rawLine}`);
		}

		members.push(sequenceId);

		if (suffix === "*") {
			if (representative !== null) {
				throw new Error("CD-HIT cluster has two representatives");
			}

			representative = sequenceId;
		}
	}

	if (hasCluster) {
		flushCluster(members, representative, parsed);
	}

	if (parsed.representatives.length === 0) {
		throw new Error("CD-HIT output contains no clusters");
	}

	return parsed;
}

async function selectGroup<TSequence extends RepresentativeInputSequence>(
	group: SequenceGroup<TSequence>,
	tempPath: string,
	runSubprocess: RunSubprocess,
): Promise<Array<ReferenceRepresentative<TSequence>>> {
	const stem = getGroupStem(group);
	const inputPath = join(tempPath, `${stem}.fa`);
	const outputPath = join(tempPath, `${stem}.cdhit`);
	const clusterPath = `${outputPath}.clstr`;
	const sequencesById = new Map<string, TSequence>();

	for (const sequence of group.sequences) {
		if (sequence.id === "" || /\s/.test(sequence.id)) {
			throw new Error(
				`Sequence id ${JSON.stringify(sequence.id)} is not FASTA-safe`,
			);
		}

		if (sequencesById.has(sequence.id)) {
			throw new Error(`OTU ${group.otuId} repeats sequence id ${sequence.id}`);
		}

		sequencesById.set(sequence.id, sequence);
	}

	try {
		await writeFile(
			inputPath,
			group.sequences
				.map((sequence) => `>${sequence.id}\n${sequence.sequence}\n`)
				.join(""),
		);

		await runSubprocess({
			command: [
				REFERENCE_REPRESENTATIVE_POLICY.tool,
				"-i",
				inputPath,
				"-o",
				outputPath,
				"-c",
				REFERENCE_REPRESENTATIVE_POLICY.identity,
				"-n",
				REFERENCE_REPRESENTATIVE_POLICY.wordSize,
				"-l",
				REFERENCE_REPRESENTATIVE_POLICY.minimumLength,
				"-T",
				"1",
				"-M",
				"0",
				"-d",
				"0",
			],
		});

		const parsed = await parseClusters(clusterPath);

		for (const member of parsed.members) {
			if (!sequencesById.has(member)) {
				throw new Error(`CD-HIT output contains unknown sequence ${member}`);
			}
		}

		for (const sequenceId of sequencesById.keys()) {
			if (!parsed.members.has(sequenceId)) {
				throw new Error(`CD-HIT output omits sequence ${sequenceId}`);
			}
		}

		return parsed.representatives.map((sequenceId) => {
			const sequence = sequencesById.get(sequenceId);

			if (sequence === undefined) {
				throw new Error(
					`CD-HIT representative ${sequenceId} is absent from the source group`,
				);
			}

			return {
				...sequence,
				groupSegment: group.segment,
				otuId: group.otuId,
			};
		});
	} finally {
		await Promise.all([
			rm(inputPath, { force: true }),
			rm(outputPath, { force: true }),
			rm(clusterPath, { force: true }),
		]);
	}
}

async function selectRepresentativesForBatch<
	TSequence extends RepresentativeInputSequence,
>(
	batch: readonly SequenceGroup<TSequence>[],
	tempPath: string,
	runSubprocess: RunSubprocess,
): Promise<Array<Array<ReferenceRepresentative<TSequence>>>> {
	const settled = await Promise.allSettled(
		batch.map((group) => selectGroup(group, tempPath, runSubprocess)),
	);

	return settled.map((result) => {
		if (result.status === "rejected") {
			throw result.reason;
		}

		return result.value;
	});
}

/** Stream one original representative sequence from every CD-HIT-EST cluster. */
export async function* selectReferenceRepresentatives<
	TSequence extends RepresentativeInputSequence,
>({
	concurrency,
	otus,
	runSubprocess,
	scratchPath,
}: SelectReferenceRepresentativesOptions<TSequence>): AsyncGenerator<
	ReferenceRepresentative<TSequence>
> {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new Error("Representative selection concurrency must be positive");
	}

	const tempPath = await mkdtemp(join(scratchPath, "representatives-"));

	try {
		let batch: SequenceGroup<TSequence>[] = [];
		let groupCount = 0;

		for await (const group of iterateGroups(otus)) {
			groupCount += 1;
			batch.push(group);

			if (batch.length === concurrency) {
				for (const representatives of await selectRepresentativesForBatch(
					batch,
					tempPath,
					runSubprocess,
				)) {
					yield* representatives;
				}

				batch = [];
			}
		}

		if (batch.length > 0) {
			for (const representatives of await selectRepresentativesForBatch(
				batch,
				tempPath,
				runSubprocess,
			)) {
				yield* representatives;
			}
		}

		if (groupCount === 0) {
			throw new Error("Reference contains no OTU/segment groups");
		}
	} finally {
		await rm(tempPath, { force: true, recursive: true });
	}
}
