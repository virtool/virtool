// Runs `knope prepare-release` on branch `knope/release`, then force-pushes
// the branch and opens or updates the "Release" pull request. The pull request
// body lists the released versions and each change file once.
//
// `GITHUB_TOKEN` must belong to the `virtool-releaser` GitHub App, and
// `APP_SLUG` must be its slug. Workflows do not start for a push or pull
// request made with the workflow's own token, and the release pull request
// needs CI.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseChangeFile } from "./change-files.mjs";
import { readKnopeConfig } from "./knope.mjs";
import { getReleaseBody } from "./release-body.mjs";

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

// Reads the change files before `knope prepare-release` deletes them. Like
// Knope, it asks GitHub for the pull request of the commit that added the file.
function readChanges(names, repository) {
	const directory = ".changeset";

	return readdirSync(directory)
		.filter((file) => file.endsWith(".md"))
		.toSorted()
		.map((file) => {
			const path = `${directory}/${file}`;
			const { summary, details, packages, maintenance } = parseChangeFile(
				readFileSync(path, "utf8"),
				names,
			);
			const [sha] = getLines(
				run("git", "log", "--diff-filter=A", "--format=%H", "--", path),
			).toReversed();
			const number = sha
				? run(
						"gh",
						"api",
						`/repos/${repository}/commits/${sha}/pulls`,
						"--jq",
						".[0].number // empty",
					).trim()
				: "";

			return {
				file,
				summary,
				details,
				packages,
				maintenance,
				number: number || undefined,
			};
		});
}

function readVersion(ref, file) {
	return JSON.parse(run("git", "show", `${ref}${file}`)).version;
}

// Compares the first versioned file of each package at `HEAD` and in the
// index.
function readVersions(config) {
	return config.flatMap(({ name, files: [file] }) => {
		const from = readVersion("HEAD:", file);
		const to = readVersion(":", file);

		return from === to ? [] : [{ name, from, to }];
	});
}

function main() {
	const { APP_SLUG, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_TOKEN } = process.env;

	if (!APP_SLUG || !GITHUB_REPOSITORY || !GITHUB_SHA || !GITHUB_TOKEN) {
		throw new Error(
			"APP_SLUG, GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN must be set.",
		);
	}

	runInherit("git", "switch", "-C", branch);

	const config = readKnopeConfig(".");
	const changes = readChanges(
		new Set(config.map(({ name }) => name)),
		GITHUB_REPOSITORY,
	);

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
	writeFileSync(
		bodyFile,
		getReleaseBody({ versions: readVersions(config), changes }),
	);

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
