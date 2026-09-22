import type { OtuV2Change } from "@virtool/contracts";
import { formatV2IsolateName } from "./isolateName";

function assertNever(value: never): never {
	throw new Error(`Unhandled OTU history change: ${JSON.stringify(value)}`);
}

/** Get the human-readable action and subject for a v2 OTU history change. */
export function getOtuV2ChangeDescription(change: OtuV2Change) {
	switch (change.command) {
		case "CreateOTU":
			return {
				action: "created OTU",
				subject: change.name,
			};
		case "CreateIsolate": {
			const isolateName = change.name ? formatV2IsolateName(change.name) : null;
			return {
				action: isolateName ? "created isolate" : "created an unnamed isolate",
				subject: isolateName,
			};
		}
		case "UpdateTaxonomy":
			return { action: "updated taxonomy", subject: change.name };
		case "UpdatePlan":
			return { action: "updated molecule and segment plan", subject: null };
		case "UpdateIsolate":
			return {
				action: change.name ? "updated isolate" : "cleared isolate name",
				subject: change.name ? formatV2IsolateName(change.name) : null,
			};
		case "UpdateSequence":
			return {
				action:
					change.sequenceSource === "genbank"
						? "updated GenBank sequence metadata"
						: change.previousSource === "genbank"
							? "converted GenBank sequence to manual"
							: "updated manual sequence",
				subject: change.accessionVersion ?? change.previousAccessionVersion,
			};
		case "DeleteIsolate":
			return { action: "deleted isolate", subject: null };
		case "DeleteOTU":
			return { action: "deleted OTU", subject: null };
		default:
			return assertNever(change);
	}
}
