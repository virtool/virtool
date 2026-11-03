const intro =
	"Merge this pull request to publish the images and GitHub Releases below.";

function sortPackages(names) {
	return [...names].toSorted((a, b) => {
		if (a === "virtool" || b === "virtool") {
			return a === "virtool" ? -1 : 1;
		}

		return a.localeCompare(b);
	});
}

function formatChange({ summary, details, packages, number }) {
	const names = sortPackages(packages).join(", ");
	const link = number ? `#${number}` : undefined;

	if (!details) {
		return `- ${summary} (${[names, link].filter(Boolean).join("; ")})`;
	}

	return [
		`### ${summary}`,
		"",
		`Packages: ${names}.${link ? ` Pull request: ${link}.` : ""}`,
		"",
		details,
	].join("\n");
}

// Builds the release pull request body. `versions` holds
// `{ name, from, to }` for each released package. `changes` holds
// `{ file, summary, details, packages, number }` for each change file. Like
// Knope, it lists summary-only changes first, then changes with details, each
// group in file name order.
export function getReleaseBody({ versions, changes }) {
	const ordered = changes.toSorted((a, b) => a.file.localeCompare(b.file));
	const simple = ordered.filter((change) => !change.details);
	const detailed = ordered.filter((change) => change.details);
	const releases = sortPackages(versions.map(({ name }) => name)).map(
		(name) => {
			const { from, to } = versions.find((version) => version.name === name);

			return `- ${name}: ${from} → ${to}`;
		},
	);

	return `${[
		intro,
		releases.join("\n"),
		"## Changes",
		simple.map(formatChange).join("\n"),
		...detailed.map(formatChange),
	]
		.filter(Boolean)
		.join("\n\n")}\n`;
}
