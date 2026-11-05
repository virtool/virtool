// Builds a small monorepo in a temporary git repository, and runs a script
// against it. The scripts under test read the repository of the working
// directory, so each test runs them as a child process.

import { execFileSync, spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const knopeToml = `[packages.virtool]
versioned_files = ["apps/web/package.json", "apps/internal/package.json"]
changelog = "apps/web/CHANGELOG.md"
extra_changelog_sections = [{ name = "Maintenance", types = ["maintenance"] }]

[packages.nuvs]
versioned_files = ["apps/nuvs/package.json"]
changelog = "apps/nuvs/CHANGELOG.md"
extra_changelog_sections = [{ name = "Maintenance", types = ["maintenance"] }]

[packages.pathoscope]
versioned_files = ["apps/pathoscope/package.json"]
changelog = "apps/pathoscope/CHANGELOG.md"
extra_changelog_sections = [{ name = "Maintenance", types = ["maintenance"] }]

[changes]
ignore_conventional_commits = true
`;

const manifests = {
	"package.json": {
		name: "fixture",
		private: true,
		devDependencies: { typescript: "1.0.0" },
	},
	"apps/web/package.json": {
		name: "@virtool/web",
		version: "1.0.0",
		dependencies: { react: "1.0.0" },
		devDependencies: { vite: "1.0.0", vitest: "1.0.0", "@types/node": "1.0.0" },
	},
	"apps/internal/package.json": {
		name: "@virtool/internal",
		version: "1.0.0",
		dependencies: { "@virtool/data": "workspace:*", react: "1.0.0" },
		devDependencies: { vitest: "1.0.0" },
	},
	"apps/nuvs/package.json": {
		name: "@virtool/nuvs",
		version: "1.0.0",
		dependencies: { "@virtool/workflow": "workspace:*", zod: "3.0.0" },
		devDependencies: { vitest: "1.0.0" },
	},
	"apps/pathoscope/package.json": {
		name: "@virtool/pathoscope",
		version: "1.0.0",
		dependencies: { "@virtool/workflow": "workspace:*" },
		devDependencies: { vitest: "1.0.0" },
	},
	"apps/site/package.json": {
		name: "@virtool/site",
		version: "1.0.0",
		dependencies: { astro: "1.0.0" },
		devDependencies: { vite: "1.0.0" },
	},
	"packages/workflow/package.json": {
		name: "@virtool/workflow",
		dependencies: { zod: "3.0.0", pino: "1.0.0" },
		devDependencies: { vitest: "1.0.0" },
	},
	"packages/data/package.json": {
		name: "@virtool/data",
		dependencies: { zod: "3.0.0" },
		devDependencies: { vite: "1.0.0", vitest: "1.0.0" },
	},
};

function git(root, ...args) {
	return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

/** Creates the fixture repository on `main` and returns helpers for it. */
export function createFixture() {
	const root = mkdtempSync(join(tmpdir(), "virtool-scripts-"));

	function write(file, text) {
		mkdirSync(dirname(join(root, file)), { recursive: true });
		writeFileSync(join(root, file), text);
	}

	function writeJson(file, json) {
		write(file, `${JSON.stringify(json, null, "\t")}\n`);
	}

	for (const [file, json] of Object.entries(manifests)) {
		writeJson(file, json);
	}

	write("knope.toml", knopeToml);
	write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");

	git(root, "init", "--quiet", "--initial-branch", "main");
	git(root, "config", "user.name", "Test");
	git(root, "config", "user.email", "test@example.com");
	git(root, "config", "commit.gpgsign", "false");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "--message", "Initial commit");

	return {
		root,
		write,
		read(file) {
			return readFileSync(join(root, file), "utf8");
		},
		list(directory) {
			try {
				return readdirSync(join(root, directory)).toSorted();
			} catch {
				return [];
			}
		},
		/** Sets a dependency version in a manifest, in the working tree. */
		bump(file, field, name, version) {
			const json = JSON.parse(readFileSync(join(root, file), "utf8"));
			json[field][name] = version;
			writeJson(file, json);
		},
		checkout(branch) {
			git(root, "checkout", "--quiet", "-b", branch);
		},
		commitAll(message) {
			git(root, "add", "--all");
			git(root, "commit", "--quiet", "--message", message);
		},
		/** Runs a script of this directory in the fixture. */
		run(script, args = [], env = {}) {
			const { GITHUB_EVENT_PATH: _, ...inherited } = process.env;
			const result = spawnSync(
				process.execPath,
				[join(import.meta.dirname, script), ...args],
				{
					cwd: root,
					encoding: "utf8",
					env: { ...inherited, ...env },
				},
			);

			return {
				status: result.status,
				stdout: result.stdout,
				stderr: result.stderr,
			};
		},
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}
