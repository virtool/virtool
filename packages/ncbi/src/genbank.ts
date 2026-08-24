import { NcbiUnreadableError } from "./errors";
import { type NcbiGenbank, ncbiGenbankSchema } from "./models";
import { getChild, getText, parseXml, toArray } from "./xml";

/**
 * Reduce one `GBFeature` of kind `source` to the qualifier map the source
 * model reads.
 *
 * A qualifier with no `GBQualifier_value` is a flag written bare in the flat
 * file — `/proviral`, `/focus` — and becomes `true`. Repeated qualifiers keep
 * the first occurrence, matching what `Entrez.read()` hands Pydantic when it
 * builds a dict from the same feature.
 */
function readSourceQualifiers(feature: unknown): Record<string, unknown> {
	const qualifiers: Record<string, unknown> = {};

	for (const qualifier of toArray(
		getChild(getChild(feature, "GBFeature_quals"), "GBQualifier"),
	)) {
		const name = getText(qualifier, "GBQualifier_name");

		if (name === undefined || name in qualifiers) {
			continue;
		}

		qualifiers[name] = getText(qualifier, "GBQualifier_value") ?? true;
	}

	return qualifiers;
}

/** Find the `source` feature in a record's feature table. */
function readSource(seq: unknown): Record<string, unknown> {
	for (const feature of toArray(
		getChild(getChild(seq, "GBSeq_feature-table"), "GBFeature"),
	)) {
		if (getText(feature, "GBFeature_key") === "source") {
			return readSourceQualifiers(feature);
		}
	}

	throw new NcbiUnreadableError("Feature table contains no source table");
}

/** Project one `GBSeq` element onto the GenBank model. */
function readSeq(seq: unknown): NcbiGenbank {
	const parsed = ncbiGenbankSchema.safeParse({
		accession: getText(seq, "GBSeq_primary-accession"),
		accession_version: getText(seq, "GBSeq_accession-version"),
		strandedness: getText(seq, "GBSeq_strandedness"),
		moltype: getText(seq, "GBSeq_moltype"),
		topology: getText(seq, "GBSeq_topology"),
		definition: getText(seq, "GBSeq_definition"),
		organism: getText(seq, "GBSeq_organism"),
		sequence: getText(seq, "GBSeq_sequence"),
		source: readSource(seq),
		comment: getText(seq, "GBSeq_comment"),
	});

	if (!parsed.success) {
		throw new NcbiUnreadableError(
			`Could not read GenBank record ${getText(seq, "GBSeq_primary-accession") ?? "?"}: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "record"} ${issue.message}`)
				.join("; ")}`,
			{ cause: parsed.error },
		);
	}

	return parsed.data;
}

/**
 * Parse a `GBSet` document into GenBank records.
 *
 * **A record this side cannot read is dropped, not thrown on.** A fetch names
 * many accessions and NCBI answers with whatever it has, so one record with an
 * unexpected `mol_type` would otherwise lose the other four hundred in the
 * same batch. ref-builder does the same, logging the validation errors and
 * continuing. The rejection is reported through `onReject` so the caller can
 * log it.
 */
export function parseGenbankSet(
	text: string,
	onReject?: (err: NcbiUnreadableError) => void,
): NcbiGenbank[] {
	const document = parseXml(text);

	const set = getChild(document, "GBSet");

	if (set === undefined) {
		throw new NcbiUnreadableError("NCBI response carried no GBSet");
	}

	const records: NcbiGenbank[] = [];

	for (const seq of toArray(getChild(set, "GBSeq"))) {
		try {
			records.push(readSeq(seq));
		} catch (err) {
			if (err instanceof NcbiUnreadableError) {
				onReject?.(err);

				continue;
			}

			throw err;
		}
	}

	return records;
}
