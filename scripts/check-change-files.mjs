// Fails a pull request when a change file is malformed, or when an image app
// changed since the base ref and no change file names its Knope package. A
// change to tests, test data, Markdown, or only dependencies that ship nothing
// does not count. The `no-release` label waives the coverage rule, not the
// format rule.
//
// Knope ignores a change file with a quoted or unknown package name, and
// accepts one with no summary, so this check rejects them itself. Knope ends
// the summary at the first line break, so a wrapped summary becomes a cut-off
// heading.
//
// The workspace graph is coarse: a change to any module of a shared package
// marks every app that depends on the package, even when the app bundles none
// of the changed code. A bundled app that only the graph marks is built at the
// merge base and at `HEAD`, and it needs a change file only when the bundles
// differ.

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseChangeFile } from "./change-files.mjs";
import { readKnopePackages } from "./knope.mjs";
import {
	getAffectedDirs,
	getChangedFiles,
	git,
	isShippedFile,
	lines,
} from "./workspaces.mjs";

const ref = process.argv[2] ?? "origin/main";
const waiver = "no-release";

function getChangeFiles(root, base) {
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

function listWorkspaces(root, filter) {
	return JSON.parse(
		execFileSync(
			"pnpm",
			["--filter", filter, "list", "--depth", "-1", "--json"],
			{
				cwd: root,
				encoding: "utf8",
			},
		),
	).map((workspace) => relative(root, workspace.path));
}

// Maps each affected Knope package name to the app directories that make it
// affected.
function getAffectedPackages(root, base, knopePackages, changed) {
	const affected = new Map();

	for (const dir of getAffectedDirs(root, base, changed)) {
		const name = knopePackages.get(join(dir, "package.json"));

		if (name) {
			affected.set(name, [...(affected.get(name) ?? []), dir]);
		}
	}

	return affected;
}

function isInside(file, dir) {
	return file.startsWith(`${dir}/`);
}

// An image build input, such as `@virtool/image-build` or a Rust crate, ships
// only its manifest, and its changes never show in a bundle.
function isImageInput(root, dir) {
	const { files } = JSON.parse(
		readFileSync(join(root, dir, "package.json"), "utf8"),
	);

	return files?.length === 1 && files[0] === "package.json";
}

// Whether the bundle is the only part of the app's image that the changed
// files can reach: the app itself, a dependency manifest, and an image build
// input all change the image in ways that a bundle comparison cannot see.
function isBundleOnlyChange(root, app, changed) {
	if (!existsSync(join(root, app, "tsdown.config.ts"))) {
		return false;
	}

	const dependencies = listWorkspaces(root, `./${app}...`).filter(
		(dir) => dir !== app,
	);

	return changed.every((file) => {
		if (isInside(file, app)) {
			return false;
		}

		const dir = dependencies.find((dependency) => isInside(file, dependency));

		if (!dir) {
			return true;
		}

		return !file.endsWith("/package.json") && !isImageInput(root, dir);
	});
}

function listFiles(dir, prefix = "") {
	return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(
		(entry) => {
			const path = join(prefix, entry.name);

			return entry.isDirectory() ? listFiles(dir, path) : [path];
		},
	);
}

// Source maps are left out. They embed each bundled module and map code to its
// line numbers, so a deleted comment or type changes them when the code does
// not.
function listCode(dir) {
	return listFiles(dir)
		.filter((file) => !file.endsWith(".map"))
		.toSorted();
}

function isSameOutput(a, b) {
	const files = listCode(a);
	const other = listCode(b);

	return (
		files.length === other.length &&
		files.every(
			(file, index) =>
				file === other[index] &&
				readFileSync(join(a, file)).equals(readFileSync(join(b, file))),
		)
	);
}

function pruneDependencies(dependencies = {}) {
	return Object.entries(dependencies)
		.toSorted(([a], [b]) => a.localeCompare(b))
		.map(([name, { version, dependencies }]) => [
			name,
			version,
			pruneDependencies(dependencies),
		]);
}

// Lists the production dependencies that the image installs beside the
// bundle, by name and resolved version, so a lockfile change that the bundle
// cannot show still counts.
function getDependencyTree(root, app) {
	const [workspace] = JSON.parse(
		execFileSync(
			"pnpm",
			[
				"--filter",
				`./${app}`,
				"list",
				"--prod",
				"--depth",
				"Infinity",
				"--json",
			],
			{ cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
		),
	);

	return JSON.stringify(pruneDependencies(workspace.dependencies));
}

function build(root, app) {
	rmSync(join(root, app, "dist"), { force: true, recursive: true });
	execFileSync("pnpm", ["--filter", `./${app}`, "build"], {
		cwd: root,
		stdio: ["ignore", "ignore", "inherit"],
	});
}

// Returns the apps whose bundles and production dependencies are the same at
// the merge base and at `HEAD`.
function getUnchangedApps(root, base, apps) {
	if (apps.length === 0) {
		return new Set();
	}

	const worktree = mkdtempSync(join(tmpdir(), "check-change-files-"));

	try {
		git("worktree", "add", "--detach", worktree, base);
		execFileSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], {
			cwd: worktree,
			stdio: ["ignore", "ignore", "inherit"],
		});

		return new Set(
			apps.filter((app) => {
				build(root, app);
				build(worktree, app);

				return (
					getDependencyTree(root, app) === getDependencyTree(worktree, app) &&
					isSameOutput(join(root, app, "dist"), join(worktree, app, "dist"))
				);
			}),
		);
	} finally {
		git("worktree", "remove", "--force", worktree);
	}
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
	const base = git("merge-base", ref, "HEAD");
	const knopePackages = readKnopePackages(root);
	const names = new Set(knopePackages.values());
	const named = new Set();
	const invalid = [];

	for (const { file, text } of getChangeFiles(root, base)) {
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

	const changed = getChangedFiles(base);
	const affected = getAffectedPackages(root, base, knopePackages, changed);
	const pending = [...affected].filter(([name]) => !named.has(name));
	const shipped = changed.filter(isShippedFile);
	const unchanged = getUnchangedApps(
		root,
		base,
		pending
			.flatMap(([, apps]) => apps)
			.filter((app) => isBundleOnlyChange(root, app, shipped)),
	);
	const unnamed = pending
		.filter(([, apps]) => !apps.every((app) => unchanged.has(app)))
		.map(([name]) => name)
		.toSorted();

	for (const app of [...unchanged].toSorted()) {
		process.stdout.write(
			`${app} builds the same bundle and installs the same dependencies, so it needs no change file.\n`,
		);
	}

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
