// Creates the tag and GitHub Release for each released Knope package. The
// `RELEASES` environment variable holds a JSON array of
// `{ name, version, tag, ref, changelog }`.
//
// Knope's `Release` step adds a `v` to each tag, and our tags have no `v`, so
// this script does that step instead. The Release body is the version's
// changelog section with its headings one level up, as Knope makes it.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const latest = "virtool";

function run(command, ...args) {
	return execFileSync(command, args, { encoding: "utf8" });
}

function getReleaseNotes(changelog, version) {
	const lines = changelog.split("\n");
	const start = lines.findIndex(
		(line) => line === `## ${version}` || line.startsWith(`## ${version} `),
	);

	if (start === -1) {
		return undefined;
	}

	const section = [];
	let fenced = false;

	for (const line of lines.slice(start + 1)) {
		if (/^(```|~~~)/.test(line)) {
			fenced = !fenced;
		}

		if (!fenced && line.startsWith("## ")) {
			break;
		}

		section.push(!fenced && /^#{3,} /.test(line) ? line.slice(1) : line);
	}

	return section.join("\n").trim();
}

function hasTag(tag) {
	return (
		run("git", "ls-remote", "--tags", "--refs", "origin", `refs/tags/${tag}`)
			.length > 0
	);
}

function main() {
	const releases = JSON.parse(process.env.RELEASES ?? "[]");
	const dir = mkdtempSync(join(tmpdir(), "releases-"));
	const missing = [];

	// Read every section first, so a missing one stops the job before it
	// creates any Release.
	const pending = releases.map((release) => {
		const notes = getReleaseNotes(
			run("git", "show", `${release.ref}:${release.changelog}`),
			release.version,
		);

		if (!notes) {
			missing.push(release);
		}

		return { ...release, notes };
	});

	if (missing.length > 0) {
		for (const { changelog, ref, version } of missing) {
			process.stderr.write(
				`::error::${changelog} at ${ref} has no section for ${version}.\n`,
			);
		}

		process.exit(1);
	}

	for (const { name, notes, ref, tag } of pending) {
		if (hasTag(tag)) {
			process.stdout.write(`Skip ${tag}: the tag exists\n`);
			continue;
		}

		const file = join(dir, `${name}.md`);
		writeFileSync(file, `${notes}\n`);

		run(
			"gh",
			"release",
			"create",
			tag,
			"--target",
			ref,
			"--title",
			tag,
			"--notes-file",
			file,
			name === latest ? "--latest" : "--latest=false",
		);

		process.stdout.write(`Released ${tag} at ${ref}\n`);
	}
}

main();
