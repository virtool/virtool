// Creates the tag and GitHub Release for each released Knope package. The
// `RELEASES` environment variable holds a JSON array of
// `{ name, version, tag, ref, changelog }`.
//
// Knope's `Release` step adds a `v` to each tag, and our tags have no `v`, so
// this script does that step instead.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getReleaseNotes } from "./release-notes.mjs";

const latest = "virtool";

function run(command, ...args) {
	return execFileSync(command, args, { encoding: "utf8" });
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
