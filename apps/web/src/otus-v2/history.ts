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
		case "DeleteIsolate":
			return { action: "deleted isolate", subject: null };
		case "DeleteOTU":
			return { action: "deleted OTU", subject: null };
		default:
			return assertNever(change);
	}
}
