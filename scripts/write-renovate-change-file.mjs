// Renovate runs this as a post-upgrade task, once for each branch, before it
// commits. It writes the change file that the `Knope / Check` job requires, so
// that a Renovate bump releases the images that it changes.
//
// - A bump that changes the `package.json` or Dockerfile of a workspace
//   releases a patch of each Knope package that the workspace reaches through
//   the workspace graph, which is what the check counts as affected.
// - A bump that reaches only the root `package.json` or workspaces that ship
//   no image ships nothing, so no change file is written.
// - A bump that changes only the lockfile, such as a transitive security
//   update, names no workspace, so it releases every Knope package.
//
// The Renovate image has no `pnpm` and no installed dependencies when this
// runs, so the script uses only Node built-ins and `git`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { readKnopePackages } from "./knope.mjs";

const directory = ".changeset";
const prefix = `${directory}/renovate-`;

function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lines(output) {
	return output.split("\n").filter(Boolean);
}

function readData() {
	const path = process.env.RENOVATE_POST_UPGRADE_COMMAND_DATA_FILE;

	if (!path) {
		throw new Error("RENOVATE_POST_UPGRADE_COMMAND_DATA_FILE is not set");
	}

	return JSON.parse(readFileSync(path, "utf8"));
}

function getMergeBase(baseBranch) {
	for (const ref of [`origin/${baseBranch}`, baseBranch]) {
		try {
			return git("merge-base", ref, "HEAD");
		} catch {}
	}

	throw new Error(`no merge base with ${baseBranch}`);
}

// Renovate commits files that the tasks leave in the working tree, so the
// branch changes are the working tree compared with the merge base.
function getChangedFiles(base) {
	return [
		...new Set([
			...lines(git("diff", "--name-only", "--no-relative", base)),
			...lines(git("ls-files", "--others", "--exclude-standard")),
		]),
	];
}

function readWorkspaces(root) {
	const workspaces = [];

	for (const parent of ["apps", "packages"]) {
		for (const entry of readdirSync(join(root, parent), {
			withFileTypes: true,
		})) {
			const dir = join(parent, entry.name);
			const manifest = join(root, dir, "package.json");

			if (!entry.isDirectory() || !existsSync(manifest)) {
				continue;
			}

			const json = JSON.parse(readFileSync(manifest, "utf8"));

			workspaces.push({
				name: json.name,
				dir,
				deps: [
					json.dependencies,
					json.devDependencies,
					json.optionalDependencies,
					json.peerDependencies,
				].flatMap((deps) => Object.keys(deps ?? {})),
			});
		}
	}

	return workspaces;
}

// The changed workspaces and every workspace that depends on them, as
// `pnpm --filter "...[ref]"` finds.
function getReachedDirs(workspaces, changedDirs) {
	const names = new Set(
		workspaces.filter((w) => changedDirs.has(w.dir)).map((w) => w.name),
	);
	let size;

	do {
		size = names.size;

		for (const workspace of workspaces) {
			if (workspace.deps.some((dep) => names.has(dep))) {
				names.add(workspace.name);
			}
		}
	} while (names.size !== size);

	return workspaces.filter((w) => names.has(w.name)).map((w) => w.dir);
}

function getPackages(root, changed) {
	const knopePackages = readKnopePackages(root);
	const manifests = changed.filter((file) =>
		/(^|\/)(package\.json|Dockerfile)$/.test(file),
	);

	if (manifests.length === 0) {
		return changed.includes("pnpm-lock.yaml")
			? new Set(knopePackages.values())
			: new Set();
	}

	const dirs = getReachedDirs(
		readWorkspaces(root),
		new Set(manifests.map((file) => dirname(file))),
	);

	return new Set(
		dirs
			.map((dir) => knopePackages.get(join(dir, "package.json")))
			.filter(Boolean),
	);
}

function describe({ depName, currentValue, newValue }) {
	if (currentValue === newValue) {
		return `Update the \`${depName}\` digest`;
	}

	return `Bump \`${depName}\` from ${currentValue} to ${newValue}`;
}

// A group lists one upgrade for each file that it changes, so the same bump
// can appear several times.
function getBumps({ upgrades }) {
	return [...new Set(upgrades.map(describe))].toSorted();
}

function getSummary({ groupName }, bumps) {
	return `Update ${groupName || "dependencies"}.\n\n${bumps.map((bump) => `- ${bump}.`).join("\n")}`;
}

// Build tools change no user-visible behavior, and the `no-release` label
// waives the check for them, so they stay out of the changelog.
function isDevelopmentOnly({ upgrades }) {
	return upgrades.every(({ depType }) =>
		["devDependencies", "packageManager"].includes(depType),
	);
}

function main() {
	const root = git("rev-parse", "--show-toplevel");
	const data = readData();
	const base = getMergeBase(data.baseBranch);
	const changed = getChangedFiles(base);

	// A branch that Renovate updates in place keeps the change file of its
	// last run, which can name packages that the branch no longer changes.
	for (const file of changed) {
		if (file.startsWith(prefix)) {
			rmSync(join(root, file), { force: true });
		}
	}

	const packages = [...getPackages(root, changed)].toSorted();

	if (packages.length === 0 || isDevelopmentOnly(data)) {
		return;
	}

	// Each change file needs its own name, because a branch name comes back
	// while the change file of its last merge waits on `main` for a release.
	// The upgrades include digests, because a digest update keeps its tag.
	const hash = createHash("sha256")
		.update(JSON.stringify(data.upgrades))
		.digest("hex")
		.slice(0, 8);
	const slug = data.branchName.replace(/^renovate\//, "").replace(/\W+/g, "-");

	// A group lists its bumps once, in the `virtool` changelog. The other
	// packages get a bullet that links to the same pull request.
	const bumps = getBumps(data);
	const files =
		bumps.length === 1
			? [{ names: packages, body: `${bumps[0]}.` }]
			: [
					{
						names: packages.filter((name) => name === "virtool"),
						body: getSummary(data, bumps),
					},
					{
						names: packages.filter((name) => name !== "virtool"),
						body: `Update ${data.groupName || "dependencies"}.`,
					},
				];

	// Git keeps no empty directory, so a release leaves none on `main`.
	mkdirSync(join(root, directory), { recursive: true });

	for (const { names, body } of files) {
		if (names.length === 0) {
			continue;
		}

		const suffix = names.includes("virtool") ? "" : "-images";

		writeFileSync(
			join(root, `${prefix}${slug}-${hash}${suffix}.md`),
			[
				"---",
				...names.map((name) => `${name}: patch`),
				"---",
				"",
				body,
				"",
			].join("\n"),
		);
	}
}

main();
