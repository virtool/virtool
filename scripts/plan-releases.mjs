// Finds each Knope package whose version has no tag and writes the
// `release-ghcr` image matrix and the `release-github` release list to
// `GITHUB_OUTPUT`.
//
// The `virtool` tag is the plain version, which continues the earlier
// semantic-release tags. Other tags are `<name>@<version>`. Each versioned file
// of a package is `apps/<image>/package.json`, and `<image>` is its Bake target.
//
// Each image is built from the commit that last changed the package's version,
// not the pushed commit. A later push that finds the version still untagged,
// such as after a failed run, then publishes what was released and not what
// came after it.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { readKnopeConfig } from "./knope.mjs";

const plainTag = "virtool";

function run(command, ...args) {
	return execFileSync(command, args, { encoding: "utf8" });
}

function getImage(file) {
	const image = file.match(/^apps\/([^/]+)\/package\.json$/)?.[1];

	if (!image) {
		throw new Error(`${file} is not an app package.json.`);
	}

	return image;
}

function main() {
	const registry = process.env.REGISTRY;
	const output = process.env.GITHUB_OUTPUT;

	if (!registry || !output) {
		throw new Error("REGISTRY and GITHUB_OUTPUT must be set.");
	}

	const tags = new Set(
		run("git", "ls-remote", "--tags", "--refs", "origin")
			.split("\n")
			.map((line) => line.split("\t")[1]),
	);

	const include = [];
	const releases = [];

	for (const { name, files, changelog } of readKnopeConfig(".")) {
		const [file] = files;
		const { version } = JSON.parse(readFileSync(file, "utf8"));
		const tag = name === plainTag ? version : `${name}@${version}`;

		if (tags.has(`refs/tags/${tag}`)) {
			continue;
		}

		const ref = run(
			"git",
			"log",
			"-1",
			"--first-parent",
			"--format=%H",
			'-G^[[:space:]]*"version":',
			"--",
			file,
		).trim();

		if (!ref) {
			process.stderr.write(`::error::No commit sets the version in ${file}.\n`);
			process.exit(1);
		}

		process.stdout.write(`Release ${tag} from ${ref}\n`);

		for (const image of files.map(getImage)) {
			include.push({
				image,
				version,
				ref,
				images: `${registry}/virtool/${image}`,
			});
		}

		releases.push({ name, version, tag, ref, changelog });
	}

	appendFileSync(
		output,
		[
			`include=${JSON.stringify(include)}`,
			`releases=${JSON.stringify(releases)}`,
			`any=${include.length > 0}`,
			"",
		].join("\n"),
	);
}

main();
