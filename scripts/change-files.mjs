export const actionMarker = "**Action required:**";

// Parses a Knope change file: front matter of `name: type` lines, a one-line
// summary, and optional details. `packages` holds every name, and `maintenance`
// holds the names with the `maintenance` type.
export function parseChangeFile(text, names) {
	const [first, ...rest] = text.replace(/\r\n/g, "\n").split("\n");
	const errors = [];
	const packages = [];
	const maintenance = [];

	if (first !== "---") {
		return { errors: ["the first line must be `---`"], packages, maintenance };
	}

	const end = rest.indexOf("---");

	if (end === -1) {
		return {
			errors: ["the front matter has no closing `---`"],
			packages,
			maintenance,
		};
	}

	for (const line of rest.slice(0, end)) {
		const match = line.match(
			/^([a-z0-9-]+): (major|minor|patch|maintenance)\s*$/,
		);

		if (!match) {
			if (/^["']/.test(line)) {
				errors.push(`\`${line}\` has a quoted name; write it without quotes`);
			} else {
				errors.push(
					`\`${line}\` is not a \`name: major|minor|patch|maintenance\` line`,
				);
			}
			continue;
		}

		const [, name, type] = match;

		if (!names.has(name)) {
			errors.push(`\`${name}\` is not a Knope package`);
		} else if (packages.includes(name)) {
			errors.push(`\`${name}\` is named more than once`);
		} else {
			packages.push(name);

			if (type === "maintenance") {
				maintenance.push(name);
			}
		}
	}

	if (end === 0) {
		errors.push("the front matter names no package");
	}

	const body = rest.slice(end + 1);
	const start = body.findIndex((line) => line.trim() !== "");
	let summary = "";
	let details = "";

	if (start === -1) {
		errors.push("the summary is empty");
	} else {
		summary = body[start].trim();
		details = body
			.slice(start + 1)
			.join("\n")
			.trim();

		if (body[start + 1]?.trim()) {
			errors.push(
				"the summary must be one line, followed by a blank line before any details",
			);
		}
	}

	// Only `maintenance` entries are bullets. Every other entry is a heading with
	// text below it, so a reader learns what changed.
	if (summary && !details && maintenance.length < packages.length) {
		errors.push(
			"a change without `maintenance` needs details after the summary",
		);
	}

	// Release notes collapse maintenance entries, and administrators must not
	// miss an action.
	if (maintenance.length > 0 && body.join("\n").includes(actionMarker)) {
		errors.push(
			`a \`maintenance\` change must not contain \`${actionMarker}\`; use a bump level`,
		);
	}

	return { errors, packages, maintenance, summary, details };
}
