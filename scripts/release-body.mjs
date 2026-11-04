const intro =
	"Merge this pull request to publish the images and GitHub Releases below.";

const actionMarker = "**Action required:**";

function sortPackages(names) {
	return [...names].toSorted((a, b) => {
		if (a === "virtool" || b === "virtool") {
			return a === "virtool" ? -1 : 1;
		}

		return a.localeCompare(b);
	});
}

function isRenovate({ file }) {
	return /^(z-)?renovate-/.test(file);
}

function getLink({ number }) {
	return number ? ` (#${number})` : "";
}

function getVersionTable(versions) {
	const rows = sortPackages(versions.map(({ name }) => name)).map((name) => {
		const { from, to } = versions.find((version) => version.name === name);

		return `| ${name} | ${from} → ${to} |`;
	});

	return ["| Package | Change |", "| --- | --- |", ...rows].join("\n");
}

function getParagraphs(details) {
	return details ? details.split(/\n\s*\n/).map((text) => text.trim()) : [];
}

function getActions(changes) {
	const items = changes.flatMap((change) =>
		getParagraphs(change.details)
			.filter((paragraph) => paragraph.startsWith(actionMarker))
			.map(
				(paragraph) =>
					`- ${paragraph.slice(actionMarker.length).replace(/\s+/g, " ").trim()}${getLink(change)}`,
			),
	);

	return items.length > 0 ? `## Action required\n\n${items.join("\n")}` : "";
}

// Package names are shown only when a change leaves out a released package.
function getPackageNames(change, released) {
	if (released.every((name) => change.packages.includes(name))) {
		return "";
	}

	return sortPackages(change.packages).join(", ");
}

function formatDetailed(change, released) {
	const names = getPackageNames(change, released);

	return [
		`### ${change.summary}${getLink(change)}`,
		...(names ? [`*${names}*`] : []),
		change.details,
	].join("\n\n");
}

function formatBullet(change, released) {
	const names = getPackageNames(change, released);

	return `- ${change.summary}${getLink(change)}${names ? ` — *${names}*` : ""}`;
}

function getChanges(changes, released) {
	const detailed = changes.filter((change) => change.details);
	const simple = changes.filter((change) => !change.details);

	if (detailed.length === 0 && simple.length === 0) {
		return "";
	}

	const bullets = simple.map((change) => formatBullet(change, released));

	return [
		"## Changes",
		...detailed.map((change) => formatDetailed(change, released)),
		...(bullets.length > 0 && detailed.length > 0 ? ["### Other changes"] : []),
		...(bullets.length > 0 ? [bullets.join("\n")] : []),
	].join("\n\n");
}

// The Renovate script writes one file for `virtool` with the bumps, and one
// `-images` file for the other packages that only refers to it. Both files
// come from the same pull request, so they are listed as one update.
function groupUpdates(changes) {
	const groups = new Map();

	for (const change of changes) {
		const key = change.number ?? change.file.replace(/-images\.md$/, ".md");
		const group = groups.get(key);
		const details = change.file.endsWith("-images.md") ? "" : change.details;

		if (group) {
			group.packages = [...new Set([...group.packages, ...change.packages])];
			group.details ||= details;
		} else {
			groups.set(key, { ...change, details });
		}
	}

	return [...groups.values()];
}

function getUpdates(changes, released) {
	if (changes.length === 0) {
		return "";
	}

	const updates = groupUpdates(changes);
	const count = updates.reduce(
		(total, { details }) =>
			total +
			Math.max(
				1,
				details.split("\n").filter((line) => line.startsWith("- ")).length,
			),
		0,
	);
	const items = updates.map((update) =>
		[
			formatBullet(update, released),
			...(update.details
				? update.details.split("\n").map((line) => `  ${line}`)
				: []),
		].join("\n"),
	);

	return [
		"<details>",
		`<summary>Dependency updates (${count})</summary>`,
		items.join("\n"),
		"</details>",
	].join("\n\n");
}

// Builds the release pull request body. `versions` holds `{ name, from, to }`
// for each released package. `changes` holds
// `{ file, summary, details, packages, number }` for each change file. Human
// changes come first, then Renovate updates in a collapsed section, so the
// order does not depend on file names. Paragraphs that start with the action
// marker are also copied to the top.
export function getReleaseBody({ versions, changes }) {
	const released = versions.map(({ name }) => name);
	const ordered = changes.toSorted((a, b) => a.file.localeCompare(b.file));
	const human = ordered.filter((change) => !isRenovate(change));

	return `${[
		intro,
		getVersionTable(versions),
		getActions(human),
		getChanges(human, released),
		getUpdates(ordered.filter(isRenovate), released),
	]
		.filter(Boolean)
		.join("\n\n")}\n`;
}
