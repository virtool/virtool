import type { OtuV2Change } from "@virtool/contracts";

function formatIsolateName(
	change: Extract<OtuV2Change, { command: "CreateIsolate" }>,
): string | null {
	const name = change.payload.isolate.name;
	if (!name) {
		return null;
	}

	return `${name.type[0]?.toUpperCase()}${name.type.slice(1)} ${name.value}`;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled OTU history change: ${JSON.stringify(value)}`);
}

/** Get the human-readable action and subject for a v2 OTU history change. */
export function getOtuV2ChangeDescription(change: OtuV2Change) {
	switch (change.command) {
		case "CreateOTU":
			return {
				action: "created OTU",
				subject: change.payload.taxonomy.name,
			};
		case "CreateIsolate": {
			const isolateName = formatIsolateName(change);
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
