import type {
	CreateLocalOtuCommand,
	CreateLocalOtuIsolateCommand,
	GenbankIsolateDraft,
	GenbankOtuDraft,
	LocalOtuV2,
	OtuV2IsolateNameType,
	OtuV2LineageTaxon,
} from "@virtool/contracts";
import {
	getSpecies,
	type NcbiGenbank,
	type NcbiSource,
	type NcbiTaxonomy,
} from "@virtool/ncbi/models";

/** Thrown when accessions passed together belong to different organisms. */
export class GenbankOtuMixedTaxidError extends Error {}

/** Thrown when records describe different named isolates. */
export class GenbankMixedIsolateError extends Error {}

/** Thrown when no GenBank records are available to build a draft from. */
export class GenbankOtuEmptyError extends Error {}

/** Thrown when NCBI cannot establish a species-level match. */
export class GenbankTaxonomyError extends Error {}

/** Thrown when a record cannot be assigned to the OTU plan. */
export class GenbankSegmentError extends Error {}

/** Thrown when a saved sequence differs from its accession record. */
export class GenbankProvenanceError extends Error {}

function parseSegmentName(
	value: string | null,
	moltype: string,
): { prefix: string; key: string } | null {
	if (!value) {
		return null;
	}
	const name = value.trim();
	const separated = /^([A-Za-z]+)[-_ ]+(\S+)$/.exec(name);
	if (separated?.[1] && separated[2]) {
		return { prefix: separated[1], key: separated[2] };
	}
	const undelimited = /^([DR]NA)(\S+)$/i.exec(name);
	if (undelimited?.[1] && undelimited[2]) {
		return { prefix: undelimited[1].toUpperCase(), key: undelimited[2] };
	}
	if (/^[A-Za-z0-9]+$/.test(name)) {
		return { prefix: moltype, key: name };
	}
	return null;
}

function matchesSegmentName(
	planName: { prefix: string; key: string } | null,
	recordName: { prefix: string; key: string },
): boolean {
	const normalizedPlanName =
		planName?.prefix.toLowerCase() === "segment"
			? parseSegmentName(planName.key, recordName.prefix)
			: planName;
	return (
		normalizedPlanName?.prefix.toLowerCase() ===
			recordName.prefix.toLowerCase() &&
		normalizedPlanName.key.toLowerCase() === recordName.key.toLowerCase()
	);
}

/** Validate that records describe one organism and that taxonomy describes it. */
export function validateGenbankRecords(
	records: NcbiGenbank[],
	taxonomy: NcbiTaxonomy | null,
): NcbiTaxonomy {
	const [first] = records;
	if (!first) {
		throw new GenbankOtuEmptyError();
	}
	if (
		records.some(
			(record) =>
				record.source.taxid !== first.source.taxid ||
				record.organism !== first.organism,
		)
	) {
		throw new GenbankOtuMixedTaxidError();
	}
	const known = new Map<"isolate" | "strain" | "clone", string>();
	for (const record of records) {
		const identities = (["isolate", "strain", "clone"] as const).flatMap(
			(type) => {
				const value = record.source[type];
				return value ? [{ type, value }] : [];
			},
		);
		if (
			identities.length > 0 &&
			known.size > 0 &&
			!identities.some(({ type, value }) => known.get(type) === value)
		) {
			throw new GenbankMixedIsolateError();
		}
		for (const { type, value } of identities) {
			const previous = known.get(type);
			if (previous && previous !== value) {
				throw new GenbankMixedIsolateError();
			}
			known.set(type, value);
		}
	}
	if (
		!taxonomy ||
		taxonomy.id !== first.source.taxid ||
		!getSpecies(taxonomy)
	) {
		throw new GenbankTaxonomyError();
	}
	return taxonomy;
}

/** Match validated records to an existing OTU at the species level. */
export function buildGenbankIsolateDraft(
	records: NcbiGenbank[],
	taxonomy: NcbiTaxonomy | null,
	otu: Pick<LocalOtuV2, "taxonomy" | "plan">,
): GenbankIsolateDraft {
	const verifiedTaxonomy = validateGenbankRecords(records, taxonomy);
	const [first] = records;
	if (!first) {
		throw new GenbankOtuEmptyError();
	}
	const species = getSpecies(verifiedTaxonomy);
	const otuSpecies = otu.taxonomy.lineage.find(
		(taxon) => taxon.rank === "species",
	);
	if (!species || !otuSpecies || species.id !== otuSpecies.id) {
		throw new GenbankTaxonomyError();
	}
	const used = new Set<string>();
	const sequences = records.map((record) => {
		const name = parseSegmentName(record.source.segment, record.moltype);
		const matches = otu.plan.segments.filter((candidate) => {
			const withinTolerance =
				Math.abs(candidate.length - record.sequence.length) <=
				candidate.length * candidate.lengthTolerance;
			if (!withinTolerance) {
				return false;
			}
			if (!record.source.segment) {
				return true;
			}
			return name && matchesSegmentName(candidate.name, name);
		});
		const [segment] = matches;
		if (matches.length !== 1 || !segment || used.has(segment.id)) {
			throw new GenbankSegmentError(record.accession_version);
		}
		used.add(segment.id);
		return {
			name: segment.name,
			definition: record.definition,
			sequence: record.sequence,
			length: record.sequence.length,
			accession: record.accession_version,
			segmentId: segment.id,
		};
	});
	return { name: deriveIsolateName(first.source), sequences };
}

/** Verify a versioned save against freshly resolved accession records. */
export function validateGenbankIsolateSave(
	command: CreateLocalOtuIsolateCommand,
	records: NcbiGenbank[],
	taxonomy: NcbiTaxonomy | null,
	otu: Pick<LocalOtuV2, "taxonomy" | "plan">,
): void {
	const provenance = command.payload.genbank;
	if (
		!provenance ||
		provenance.sequences.length !== command.payload.isolate.sequences.length
	) {
		throw new GenbankProvenanceError();
	}
	const draft = buildGenbankIsolateDraft(records, taxonomy, otu);
	const byAccession = new Map(
		draft.sequences.map((sequence) => [
			sequence.accession.toLowerCase(),
			sequence,
		]),
	);
	const seen = new Set<string>();
	for (const item of provenance.sequences) {
		const sequence = command.payload.isolate.sequences.find(
			(candidate) => candidate.id === item.sequenceId,
		);
		const record = byAccession.get(item.accession.toLowerCase());
		if (
			!sequence ||
			!record ||
			seen.has(item.sequenceId) ||
			sequence.sequence !== record.sequence ||
			sequence.definition !== record.definition ||
			sequence.segmentId !== record.segmentId
		) {
			throw new GenbankProvenanceError();
		}
		seen.add(item.sequenceId);
	}
}

/** Verify a GenBank-derived OTU command against fresh accession records. */
export function validateGenbankOtuSave(
	command: CreateLocalOtuCommand,
	records: NcbiGenbank[],
	taxonomy: NcbiTaxonomy | null,
): void {
	const provenance = command.payload.genbank;
	if (
		!provenance ||
		provenance.sequences.length !== command.payload.isolate.sequences.length ||
		provenance.sequences.length !== command.payload.plan.segments.length
	) {
		throw new GenbankProvenanceError();
	}
	const draft = buildGenbankOtuDraft(records, taxonomy);
	const species = taxonomy ? getSpecies(taxonomy) : null;
	const savedSpecies = command.payload.taxonomy.lineage.find(
		(taxon) => taxon.rank === "species",
	);
	if (
		!species ||
		!savedSpecies ||
		species.id !== savedSpecies.id ||
		JSON.stringify(draft.taxonomy) !==
			JSON.stringify({
				name: command.payload.taxonomy.name,
				acronym: command.payload.taxonomy.acronym,
				lineage: command.payload.taxonomy.lineage,
			}) ||
		JSON.stringify(draft.isolate) !==
			JSON.stringify(command.payload.isolate.name) ||
		draft.molecule.type !== command.payload.molecule.type ||
		draft.molecule.strandedness !== command.payload.molecule.strandedness ||
		draft.molecule.topology !== command.payload.molecule.topology
	) {
		throw new GenbankProvenanceError();
	}
	const byAccession = new Map(
		draft.segments.map((segment) => [segment.accession.toLowerCase(), segment]),
	);
	const seen = new Set<string>();
	for (const item of provenance.sequences) {
		const sequence = command.payload.isolate.sequences.find(
			(candidate) => candidate.id === item.sequenceId,
		);
		const record = byAccession.get(item.accession.toLowerCase());
		const segment = command.payload.plan.segments.find(
			(candidate) => candidate.id === sequence?.segmentId,
		);
		if (
			!sequence ||
			!record ||
			!segment ||
			seen.has(item.sequenceId) ||
			sequence.sequence !== record.sequence ||
			sequence.definition !== record.definition ||
			segment.length !== record.length ||
			JSON.stringify(segment.name) !== JSON.stringify(record.name)
		) {
			throw new GenbankProvenanceError();
		}
		seen.add(item.sequenceId);
	}
}

function deriveIsolateName(
	source: NcbiSource,
): { type: OtuV2IsolateNameType; value: string } | null {
	if (source.isolate) {
		return { type: "isolate", value: source.isolate };
	}
	if (source.strain) {
		return { type: "strain", value: source.strain };
	}
	if (source.clone) {
		return { type: "clone", value: source.clone };
	}
	return null;
}

function deriveTaxonomy(
	organism: string,
	taxonomy: NcbiTaxonomy | null,
): { name: string; acronym: string | null; lineage: OtuV2LineageTaxon[] } {
	if (!taxonomy) {
		return { name: organism, acronym: null, lineage: [] };
	}

	const species = getSpecies(taxonomy);
	const acronym =
		taxonomy.other_names.acronym[0] ??
		taxonomy.other_names.genbank_acronym[0] ??
		null;

	// NCBI's LineageEx lists the ancestors above the record's own taxon, so
	// append that taxon to complete the path down to the organism.
	const lineage = [
		...taxonomy.lineage,
		{ id: taxonomy.id, name: taxonomy.name, rank: taxonomy.rank },
	];

	return { name: species?.name ?? taxonomy.name, acronym, lineage };
}

/**
 * Reduce one or more GenBank records into a single OTU draft.
 *
 * Every record must share one organism, because the whole draft becomes one
 * OTU. Each record becomes one segment and one sequence, so a multipartite
 * genome is entered by giving every segment's accession at once. The molecule,
 * isolate name, and organism come from the first record; the taxonomy record,
 * when present, supplies the species name and acronym.
 */
export function buildGenbankOtuDraft(
	records: NcbiGenbank[],
	taxonomy: NcbiTaxonomy | null,
): GenbankOtuDraft {
	const [first] = records;
	if (!first) {
		throw new GenbankOtuEmptyError();
	}

	validateGenbankRecords(records, taxonomy);
	const segments = records.map((record) => ({
		name: parseSegmentName(record.source.segment, record.moltype),
		definition: record.definition,
		sequence: record.sequence,
		length: record.sequence.length,
		accession: record.accession_version,
	}));
	if (segments.length > 1) {
		const names = new Set<string>();
		for (const segment of segments) {
			if (!segment.name) {
				throw new GenbankSegmentError(segment.accession);
			}
			const key = `${segment.name.prefix.toLowerCase()}\0${segment.name.key.toLowerCase()}`;
			if (names.has(key)) {
				throw new GenbankSegmentError(segment.accession);
			}
			names.add(key);
		}
	}

	return {
		molecule: {
			type: first.moltype,
			strandedness: first.strandedness,
			topology: first.topology,
		},
		taxonomy: deriveTaxonomy(first.organism, taxonomy),
		isolate: deriveIsolateName(first.source),
		segments,
	};
}
