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

/** Render a v2 OTU history change as a human-readable message. */
export function formatOtuV2Change(change: OtuV2Change): string {
	switch (change.command) {
		case "CreateOTU":
			return `Created OTU '${change.payload.taxonomy.name}'.`;
		case "CreateIsolate": {
			const isolateName = formatIsolateName(change);
			return isolateName
				? `Created isolate '${isolateName}'.`
				: "Created an unnamed isolate.";
		}
		default:
			return assertNever(change);
	}
}
