// Fails a pull request when a change file is malformed, or when an image app
// changed since the base ref and no change file names its Knope package. The
// `no-release` label waives the coverage rule, not the format rule.
//
// Knope ignores a change file with a quoted or unknown package name, and
// accepts one with no summary, so this check rejects them itself.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ref = process.argv[2] ?? "origin/main";
const waiver = "no-release";

function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lines(output) {
	return output.split("\n").filter(Boolean);
}

function readKnopePackages(root) {
	const packages = new Map();
	let name;

	for (const line of readFileSync(join(root, "knope.toml"), "utf8").split(
		"\n",
	)) {
		const header = line.match(/^\[(.+)\]\s*$/);

		if (header) {
			name = header[1].match(/^packages\.([\w-]+)$/)?.[1];
			continue;
		}

		const files = line.match(/^versioned_files\s*=\s*\[(.*)\]/);

		if (name && files) {
			for (const [, file] of files[1].matchAll(/"([^"]+)"/g)) {
				packages.set(file, name);
			}
		}
	}

	return packages;
}

function getChangeFiles(root) {
	const base = git("merge-base", ref, "HEAD");
	const pathspec = ".changeset/*.md";

	return [
		...new Set([
			...lines(
				git(
					"diff",
					"--name-only",
					"--no-relative",
					"--diff-filter=ACMR",
					base,
					"--",
					pathspec,
				),
			),
			...lines(git("ls-files", "--others", "--exclude-standard", pathspec)),
		]),
	]
		.toSorted()
		.map((file) => ({
			file,
			text: readFileSync(join(root, file), "utf8"),
		}));
}

function parseChangeFile(text, names) {
	const [first, ...rest] = text.replace(/\r\n/g, "\n").split("\n");
	const errors = [];
	const packages = [];

	if (first !== "---") {
		return { errors: ["the first line must be `---`"], packages };
	}

	const end = rest.indexOf("---");

	if (end === -1) {
		return { errors: ["the front matter has no closing `---`"], packages };
	}

	for (const line of rest.slice(0, end)) {
		const match = line.match(/^([a-z0-9-]+): (major|minor|patch)\s*$/);

		if (!match) {
			if (/^["']/.test(line)) {
				errors.push(`\`${line}\` has a quoted name; write it without quotes`);
			} else {
				errors.push(`\`${line}\` is not a \`name: major|minor|patch\` line`);
			}
			continue;
		}

		const [, name] = match;

		if (!names.has(name)) {
			errors.push(`\`${name}\` is not a Knope package`);
		} else if (packages.includes(name)) {
			errors.push(`\`${name}\` is named more than once`);
		} else {
			packages.push(name);
		}
	}

	if (end === 0) {
		errors.push("the front matter names no package");
	}

	if (
		rest
			.slice(end + 1)
			.join("\n")
			.trim() === ""
	) {
		errors.push("the summary is empty");
	}

	return { errors, packages };
}

function getAffectedPackages(root, knopePackages) {
	const listed = JSON.parse(
		execFileSync(
			"pnpm",
			["--filter", `...[${ref}]`, "list", "--depth", "-1", "--json"],
			{ encoding: "utf8" },
		),
	);
	const affected = new Set();

	for (const workspace of listed) {
		const name = knopePackages.get(
			join(relative(root, workspace.path), "package.json"),
		);

		if (name) {
			affected.add(name);
		}
	}

	return affected;
}

function getLabels() {
	const path = process.env.GITHUB_EVENT_PATH;

	if (!path) {
		return [];
	}

	const event = JSON.parse(readFileSync(path, "utf8"));

	return (event.pull_request?.labels ?? []).map((label) => label.name);
}

function main() {
	const root = git("rev-parse", "--show-toplevel");
	const knopePackages = readKnopePackages(root);
	const names = new Set(knopePackages.values());
	const named = new Set();
	const invalid = [];

	for (const { file, text } of getChangeFiles(root)) {
		const { errors, packages } = parseChangeFile(text, names);

		for (const name of packages) {
			named.add(name);
		}

		if (errors.length > 0) {
			invalid.push(`${file}:`, ...errors.map((error) => `  - ${error}`));
		}
	}

	if (invalid.length > 0) {
		process.stderr.write(
			[
				"These change files are not valid:",
				...invalid,
				"",
				`Package names are ${[...names].join(", ")}.`,
				"",
			].join("\n"),
		);
		return 1;
	}

	if (getLabels().includes(waiver)) {
		return 0;
	}

	const unnamed = [...getAffectedPackages(root, knopePackages)]
		.filter((name) => !named.has(name))
		.toSorted();

	if (unnamed.length > 0) {
		process.stderr.write(
			[
				"These packages changed, but no change file names them:",
				...unnamed.map((name) => `  - ${name}`),
				"",
				"Add a change file with `knope document-change`, or add the",
				`\`${waiver}\` label if the change ships nothing to users.`,
				"",
			].join("\n"),
		);
		return 1;
	}

	return 0;
}

process.exitCode = main();
