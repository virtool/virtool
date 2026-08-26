import type { GenbankOtuDraft, OtuV2IsolateNameType } from "@virtool/contracts";
import {
	getSpecies,
	type NcbiGenbank,
	type NcbiSource,
	type NcbiTaxonomy,
} from "@virtool/ncbi/models";

/** Thrown when accessions passed together belong to different organisms. */
export class GenbankOtuMixedTaxidError extends Error {}

/** Thrown when no GenBank records are available to build a draft from. */
export class GenbankOtuEmptyError extends Error {}

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
): { name: string; acronym: string | null } {
	if (!taxonomy) {
		return { name: organism, acronym: null };
	}

	const species = getSpecies(taxonomy);
	const acronym =
		taxonomy.other_names.acronym[0] ??
		taxonomy.other_names.genbank_acronym[0] ??
		null;

	return { name: species?.name ?? taxonomy.name, acronym };
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

	if (records.some((record) => record.source.taxid !== first.source.taxid)) {
		throw new GenbankOtuMixedTaxidError();
	}

	return {
		molecule: {
			type: first.moltype,
			strandedness: first.strandedness,
			topology: first.topology,
		},
		taxonomy: deriveTaxonomy(first.organism, taxonomy),
		isolate: deriveIsolateName(first.source),
		segments: records.map((record) => ({
			name: record.source.segment
				? { prefix: "Segment", key: record.source.segment }
				: null,
			definition: record.definition,
			sequence: record.sequence,
			length: record.sequence.length,
			accession: record.accession_version,
		})),
	};
}
