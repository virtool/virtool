// Fails when a versioned workspace changed since the base ref is missing from
// the release plan of the changesets added since that ref. `changeset status`
// alone fails only when no changeset was added at all.
//
// An empty changeset declares that the change ships nothing, so it covers
// every changed workspace.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const ref = process.argv[2] ?? "origin/main";

function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readReleasePlan() {
	const dir = mkdtempSync(join(tmpdir(), "changesets-"));
	const output = join(dir, "plan.json");

	try {
		execFileSync(
			"pnpm",
			["changeset", "status", `--since=${ref}`, `--output=${output}`],
			{ stdio: "inherit" },
		);
		return JSON.parse(readFileSync(output, "utf8"));
	} catch (error) {
		// `changeset status` already printed why it failed.
		process.exit(error.status ?? 1);
	} finally {
		rmSync(dir, { force: true, recursive: true });
	}
}

function getVersionedWorkspaces(root) {
	const { ignore } = JSON.parse(
		readFileSync(join(root, ".changeset/config.json"), "utf8"),
	);
	const listed = JSON.parse(
		execFileSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], {
			encoding: "utf8",
		}),
	);

	return listed
		.filter((workspace) => workspace.path !== root)
		.map((workspace) => ({
			dir: relative(root, workspace.path),
			packageJson: JSON.parse(
				readFileSync(join(workspace.path, "package.json"), "utf8"),
			),
		}))
		.filter(
			({ packageJson }) =>
				packageJson.version && !ignore.includes(packageJson.name),
		);
}

function getChangedWorkspaces(root) {
	const workspaces = getVersionedWorkspaces(root);
	const files = git(
		"diff",
		"--name-only",
		"--no-relative",
		git("merge-base", ref, "HEAD"),
	)
		.split("\n")
		.filter(Boolean);
	const changed = new Set();

	for (const file of files) {
		const workspace = workspaces.find(({ dir }) => file.startsWith(`${dir}/`));

		if (workspace) {
			changed.add(workspace.packageJson.name);
		}
	}

	return changed;
}

const root = git("rev-parse", "--show-toplevel");
const plan = readReleasePlan();

if (plan.changesets.some((changeset) => changeset.releases.length === 0)) {
	process.exit(0);
}

const covered = new Set(plan.releases.map((release) => release.name));
const uncovered = [...getChangedWorkspaces(root)]
	.filter((name) => !covered.has(name))
	.toSorted();

if (uncovered.length > 0) {
	process.stderr.write(
		[
			"These workspaces changed, but no changeset releases them:",
			...uncovered.map((name) => `  - ${name}`),
			"",
			"Add them to a changeset with `pnpm changeset`. If the change ships",
			"nothing to users, add one with `pnpm changeset --empty`.",
			"",
		].join("\n"),
	);
	process.exit(1);
}
