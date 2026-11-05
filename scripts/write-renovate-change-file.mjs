// Renovate runs this as a post-upgrade task, once for each branch, before it
// commits. It writes the change file that the `Knope / Check` job requires, so
// that a Renovate bump releases the images that it changes.
//
// - A bump is a `maintenance` change, which releases a patch of each Knope
//   package that the check counts as affected by the branch.
// - A bump of only test tools, or of the root `package.json`, or of
//   workspaces that ship no image, ships nothing, so no change file is
//   written.
// - A bump that changes only the lockfile, such as a transitive security
//   update, names no workspace, so it releases every Knope package.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readKnopePackages } from "./knope.mjs";
import {
	getAffectedDirs,
	getChangedFiles,
	getReachedDirs,
	git,
	isShippedDependency,
	lines,
} from "./workspaces.mjs";

const directory = ".changeset";
// Knope lists entries with details by file name, so the prefix puts
// dependency updates last in a release.
const prefix = `${directory}/z-renovate-`;

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

function getAddedChangeFiles(base) {
	return [
		...new Set([
			...lines(
				git(
					"diff",
					"--name-only",
					"--no-relative",
					"--no-renames",
					"--diff-filter=A",
					base,
					"--",
					directory,
				),
			),
			...lines(
				git("ls-files", "--others", "--exclude-standard", "--", directory),
			),
		]),
	].filter((file) => file.endsWith(".md") && dirname(file) === directory);
}

// The affected workspaces, or `undefined` when the branch changes only the
// lockfile, which names no workspace and so affects them all.
function getAffectedWorkspaces(root, base, changed) {
	const manifests = changed.filter((file) =>
		/(^|\/)(package\.json|Dockerfile)$/.test(file),
	);

	if (manifests.length === 0) {
		return changed.includes("pnpm-lock.yaml") ? undefined : [];
	}

	return getAffectedDirs(root, base, changed);
}

function getPackages(root, dirs) {
	const knopePackages = readKnopePackages(root);

	if (!dirs) {
		return [...new Set(knopePackages.values())].toSorted();
	}

	return [
		...new Set(
			dirs
				.map((dir) => knopePackages.get(join(dir, "package.json")))
				.filter(Boolean),
		),
	].toSorted();
}

function describe({ depName, currentValue, newValue }) {
	if (currentValue === newValue) {
		return `Update the \`${depName}\` digest`;
	}

	return `Bump \`${depName}\` from ${currentValue} to ${newValue}`;
}

// A group lists one upgrade for each file that it changes, so the same bump
// can appear several times. An upgrade in the root, in a workspace that ships
// no image, or of a dependency that ships nothing stays out of the changelog,
// unless the branch bumps nothing else.
function getBumps(root, { upgrades }, dirs) {
	const imageDirs = new Set(
		[...readKnopePackages(root).keys()].map((file) => dirname(file)),
	);
	const shipped = upgrades.filter(({ depName, depType, packageFile }) => {
		const dir = dirname(packageFile);

		return (
			(!dirs || dirs.includes(dir)) &&
			isShippedDependency(dir, depType, depName) &&
			getReachedDirs(root, [dir]).some((reached) => imageDirs.has(reached))
		);
	});

	return [
		...new Set((shipped.length > 0 ? shipped : upgrades).map(describe)),
	].toSorted();
}

function getBody(title, bumps) {
	if (bumps.length === 0) {
		return title;
	}

	return [title, "", ...bumps.map((bump) => `- ${bump}.`)].join("\n");
}

// A group lists its bumps once, in the `virtool` changelog, and the other
// packages get a short entry that links to the same pull request. The entry
// has details so that Knope lists it after the other changes. Without
// `virtool`, every package gets the full list.
function getFiles(root, data, dirs, packages) {
	const title = `Update ${data.groupName || "dependencies"}`;
	const bumps = getBumps(root, data, dirs);
	const body = getBody(title, bumps);

	if (bumps.length <= 1 || !packages.includes("virtool")) {
		return [{ names: packages, suffix: "", body }];
	}

	const images = packages.filter((name) => name !== "virtool");

	return [
		{ names: ["virtool"], suffix: "", body },
		...(images.length > 0
			? [
					{
						names: images,
						suffix: "-images",
						body: `${title}\n\nThe \`virtool\` release lists each bump.`,
					},
				]
			: []),
	];
}

function main() {
	const root = git("rev-parse", "--show-toplevel");
	const data = readData();
	const base = getMergeBase(data.baseBranch);
	const changed = getChangedFiles(base);

	// A branch that Renovate updates in place keeps the change files of its
	// last run, which can name packages that the branch no longer changes, or
	// use an old file name. Change files that the base branch has stay.
	for (const file of getAddedChangeFiles(base)) {
		rmSync(join(root, file), { force: true });
	}

	const dirs = getAffectedWorkspaces(root, base, changed);
	const packages = getPackages(root, dirs);

	if (packages.length === 0) {
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

	// Git keeps no empty directory, so a release leaves none on `main`.
	mkdirSync(join(root, directory), { recursive: true });

	for (const { names, suffix, body } of getFiles(root, data, dirs, packages)) {
		writeFileSync(
			join(root, `${prefix}${slug}-${hash}${suffix}.md`),
			[
				"---",
				...names.map((name) => `${name}: maintenance`),
				"---",
				"",
				body,
				"",
			].join("\n"),
		);
	}
}

main();
