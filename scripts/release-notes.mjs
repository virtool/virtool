const maintenanceHeading = "### Maintenance";

function collapse(text) {
	return `<details>\n<summary>Maintenance</summary>\n\n${text}\n\n</details>`;
}

// Returns the GitHub Release body for a version: its changelog section with
// the headings one level up, as Knope makes it. The Maintenance section moves
// into a collapsed block at the end, so the notes that users read come first.
export function getReleaseNotes(changelog, version) {
	const lines = changelog.split("\n");
	const start = lines.findIndex(
		(line) => line === `## ${version}` || line.startsWith(`## ${version} `),
	);

	if (start === -1) {
		return undefined;
	}

	const notes = [];
	const maintenance = [];
	let section = notes;
	let fenced = false;

	for (const line of lines.slice(start + 1)) {
		if (/^(```|~~~)/.test(line)) {
			fenced = !fenced;
		}

		if (!fenced && line.startsWith("## ")) {
			break;
		}

		if (!fenced && line.startsWith("### ")) {
			section = line === maintenanceHeading ? maintenance : notes;

			if (section === maintenance) {
				continue;
			}
		}

		section.push(!fenced && /^#{3,} /.test(line) ? line.slice(1) : line);
	}

	const collapsed = maintenance.join("\n").trim();

	return [notes.join("\n").trim(), collapsed ? collapse(collapsed) : ""]
		.filter(Boolean)
		.join("\n\n");
}
