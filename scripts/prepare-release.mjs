// Runs `knope prepare-release` on branch `knope/release`, then force-pushes
// the branch and opens or updates the "Release" pull request. The pull request
// body lists the new changelog section of each released package.
//
// `GITHUB_TOKEN` must belong to the `virtool-releaser` GitHub App, and
// `APP_SLUG` must be its slug. Workflows do not start for a push or pull
// request made with the workflow's own token, and the release pull request
// needs CI.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const branch = "knope/release";

function run(command, ...args) {
	return execFileSync(command, args, { encoding: "utf8" });
}

function runInherit(command, ...args) {
	execFileSync(command, args, { stdio: "inherit" });
}

function getLines(output) {
	return output.split("\n").filter(Boolean);
}

function hasStagedChanges() {
	try {
		execFileSync("git", ["diff", "--cached", "--quiet"]);
		return false;
	} catch (error) {
		if (error.status === 1) {
			return true;
		}

		throw error;
	}
}

// Takes the lines that a `--unified=0` diff adds and moves each heading one
// level down, so the package name is the only `##` heading of its section.
function getAddedSection(diff) {
	const lines = [];
	let inHunk = false;

	for (const line of diff.split("\n")) {
		if (line.startsWith("@@")) {
			inHunk = true;
			continue;
		}

		if (inHunk && line.startsWith("+")) {
			const added = line.slice(1);
			lines.push(added.startsWith("#") ? `#${added}` : added);
		}
	}

	return lines;
}

function getBody() {
	const sections = [
		"Merge this pull request to publish the images and GitHub Releases below.",
	];

	for (const changelog of getLines(
		run(
			"git",
			"diff",
			"--cached",
			"--name-only",
			"--",
			"CHANGELOG.md",
			"apps/*/CHANGELOG.md",
		),
	)) {
		const name =
			changelog === "CHANGELOG.md" ? "virtool" : basename(dirname(changelog));
		const diff = run(
			"git",
			"diff",
			"--cached",
			"--no-color",
			"--unified=0",
			"--",
			changelog,
		);

		sections.push("", `## ${name}`, "", ...getAddedSection(diff));
	}

	return `${sections.join("\n")}\n`;
}

function main() {
	const { APP_SLUG, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_TOKEN } = process.env;

	if (!APP_SLUG || !GITHUB_REPOSITORY || !GITHUB_SHA || !GITHUB_TOKEN) {
		throw new Error(
			"APP_SLUG, GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN must be set.",
		);
	}

	runInherit("git", "switch", "-C", branch);
	runInherit("knope", "prepare-release", "--verbose");

	if (!hasStagedChanges()) {
		return;
	}

	// Knope writes package.json with spaces and no final newline.
	const manifests = getLines(
		run(
			"git",
			"diff",
			"--cached",
			"--name-only",
			"--diff-filter=AM",
			"--",
			"*package.json",
		),
	);

	if (manifests.length > 0) {
		runInherit("pnpm", "exec", "biome", "format", "--write", ...manifests);
		runInherit("git", "add", "--", ...manifests);
	}

	const bodyFile = join(mkdtempSync(join(tmpdir(), "release-")), "body.md");
	writeFileSync(bodyFile, getBody());

	const bot = `${APP_SLUG}[bot]`;
	const userId = run("gh", "api", `/users/${bot}`, "--jq", ".id").trim();
	runInherit("git", "config", "user.name", bot);
	runInherit(
		"git",
		"config",
		"user.email",
		`${userId}+${bot}@users.noreply.github.com`,
	);
	runInherit("git", "commit", "-m", "Release");

	// A run that started before a newer push, such as the merge of the release
	// pull request, has stale change files. The run for the newer push prepares
	// the release.
	const mainSha = run("git", "ls-remote", "origin", "refs/heads/main").split(
		"\t",
	)[0];

	if (mainSha !== GITHUB_SHA) {
		process.stdout.write(
			`main moved past ${GITHUB_SHA}; skipping release preparation\n`,
		);
		return;
	}

	runInherit(
		"git",
		"push",
		"--force",
		`https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`,
		branch,
	);

	const number = run(
		"gh",
		"pr",
		"list",
		"--head",
		branch,
		"--base",
		"main",
		"--state",
		"open",
		"--json",
		"number",
		"--jq",
		".[0].number // empty",
	).trim();

	if (number) {
		runInherit(
			"gh",
			"pr",
			"edit",
			number,
			"--title",
			"Release",
			"--body-file",
			bodyFile,
		);
	} else {
		runInherit(
			"gh",
			"pr",
			"create",
			"--head",
			branch,
			"--base",
			"main",
			"--title",
			"Release",
			"--body-file",
			bodyFile,
		);
	}
}

main();
