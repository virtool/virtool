import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createFixture } from "./testing.mjs";

function upgrade(packageFile, depName, extra = {}) {
	return {
		depName,
		depType: "dependencies",
		packageFile,
		currentValue: "1.0.0",
		newValue: "2.0.0",
		currentDigest: null,
		newDigest: null,
		...extra,
	};
}

describe("write-renovate-change-file", () => {
	let fixture;

	beforeEach(() => {
		fixture = createFixture();
	});

	afterEach(() => {
		fixture.cleanup();
	});

	function write(upgrades, groupName) {
		fixture.write(
			".git/data.json",
			JSON.stringify({
				branchName: "renovate/deps",
				baseBranch: "main",
				groupName,
				upgrades,
			}),
		);

		const result = fixture.run("write-renovate-change-file.mjs", [], {
			RENOVATE_POST_UPGRADE_COMMAND_DATA_FILE: `${fixture.root}/.git/data.json`,
		});

		assert.equal(result.status, 0, result.stderr);
	}

	function changeFiles() {
		return fixture
			.list(".changeset")
			.filter((name) => name.startsWith("z-renovate-"));
	}

	function content(names, body) {
		return `---\n${names.map((name) => `${name}: patch`).join("\n")}\n---\n\n${body}\n`;
	}

	test("writes no file for a test tool bump", () => {
		fixture.bump("apps/web/package.json", "devDependencies", "vitest", "2.0.0");
		write([
			upgrade("apps/web/package.json", "vitest", {
				depType: "devDependencies",
			}),
		]);

		assert.deepEqual(changeFiles(), []);
	});

	test("writes one file for one bump", () => {
		fixture.bump("apps/web/package.json", "devDependencies", "vite", "2.0.0");
		write([
			upgrade("apps/web/package.json", "vite", { depType: "devDependencies" }),
		]);

		const [name, ...rest] = changeFiles();

		assert.deepEqual(rest, []);
		assert.match(name, /^z-renovate-deps-[0-9a-f]{8}\.md$/);
		assert.equal(
			fixture.read(`.changeset/${name}`),
			content(
				["virtool"],
				"Update dependencies.\n\n- Bump `vite` from 1.0.0 to 2.0.0.",
			),
		);
	});

	test("lists a group once in the virtool file and links the images", () => {
		fixture.bump("apps/web/package.json", "dependencies", "react", "2.0.0");
		fixture.bump(
			"apps/internal/package.json",
			"dependencies",
			"react",
			"2.0.0",
		);
		fixture.bump("apps/nuvs/package.json", "dependencies", "zod", "2.0.0");
		write(
			[
				upgrade("apps/web/package.json", "react"),
				upgrade("apps/internal/package.json", "react"),
				upgrade("apps/nuvs/package.json", "zod", { currentValue: "3.0.0" }),
			],
			"production dependencies",
		);

		const files = changeFiles();

		assert.equal(files.length, 2);

		const main = files.find((name) => !name.endsWith("-images.md"));
		const images = files.find((name) => name.endsWith("-images.md"));

		assert.equal(
			fixture.read(`.changeset/${main}`),
			content(
				["virtool"],
				"Update production dependencies.\n\n- Bump `react` from 1.0.0 to 2.0.0.\n- Bump `zod` from 3.0.0 to 2.0.0.",
			),
		);
		assert.equal(
			fixture.read(`.changeset/${images}`),
			content(
				["nuvs"],
				"Update production dependencies.\n\nThe `virtool` release lists each bump.",
			),
		);
	});

	test("names all reached images with the full list when virtool is absent", () => {
		fixture.bump(
			"packages/workflow/package.json",
			"dependencies",
			"zod",
			"4.0.0",
		);
		fixture.bump(
			"packages/workflow/package.json",
			"dependencies",
			"pino",
			"2.0.0",
		);
		write(
			[
				upgrade("packages/workflow/package.json", "zod", {
					currentValue: "3.0.0",
					newValue: "4.0.0",
				}),
				upgrade("packages/workflow/package.json", "pino"),
			],
			"production dependencies",
		);

		const files = changeFiles();

		assert.equal(files.length, 1);
		assert.equal(
			fixture.read(`.changeset/${files[0]}`),
			content(
				["nuvs", "pathoscope"],
				"Update production dependencies.\n\n- Bump `pino` from 1.0.0 to 2.0.0.\n- Bump `zod` from 3.0.0 to 4.0.0.",
			),
		);
	});

	test("lists only the bumps that ship", () => {
		fixture.bump("apps/web/package.json", "dependencies", "react", "2.0.0");
		fixture.bump("apps/web/package.json", "devDependencies", "vitest", "2.0.0");
		fixture.bump("package.json", "devDependencies", "typescript", "2.0.0");
		fixture.bump("apps/site/package.json", "dependencies", "astro", "2.0.0");
		fixture.bump(
			"packages/data/package.json",
			"devDependencies",
			"vite",
			"2.0.0",
		);
		write(
			[
				upgrade("apps/web/package.json", "react"),
				upgrade("apps/web/package.json", "vitest", {
					depType: "devDependencies",
				}),
				upgrade("package.json", "typescript", { depType: "devDependencies" }),
				upgrade("apps/site/package.json", "astro"),
				upgrade("packages/data/package.json", "vite", {
					depType: "devDependencies",
				}),
			],
			"all dependencies",
		);

		const files = changeFiles();

		assert.equal(files.length, 1);
		assert.equal(
			fixture.read(`.changeset/${files[0]}`),
			content(
				["virtool"],
				"Update all dependencies.\n\n- Bump `react` from 1.0.0 to 2.0.0.",
			),
		);
	});

	test("names every Knope package for a lockfile-only change", () => {
		fixture.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n# changed\n");
		write([]);

		const files = changeFiles();

		assert.equal(files.length, 1);
		assert.equal(
			fixture.read(`.changeset/${files[0]}`),
			content(["nuvs", "pathoscope", "virtool"], "Update dependencies."),
		);
	});

	test("deletes the change file of an earlier run first", () => {
		fixture.checkout("renovate/deps");
		fixture.write(
			".changeset/z-renovate-deps-00000000.md",
			content(["nuvs"], "Old."),
		);
		fixture.commitAll("Earlier run");
		fixture.bump("apps/web/package.json", "devDependencies", "vite", "2.0.0");
		write([
			upgrade("apps/web/package.json", "vite", { depType: "devDependencies" }),
		]);

		const files = changeFiles();

		assert.equal(files.length, 1);
		assert.notEqual(files[0], "z-renovate-deps-00000000.md");
		assert.equal(
			fixture.read(`.changeset/${files[0]}`),
			content(
				["virtool"],
				"Update dependencies.\n\n- Bump `vite` from 1.0.0 to 2.0.0.",
			),
		);
	});

	test("deletes a change file with an old name that the branch added", () => {
		fixture.checkout("renovate/deps");
		fixture.write(".changeset/renovate-foo.md", content(["nuvs"], "Old name."));
		fixture.commitAll("Earlier run");
		fixture.bump("apps/web/package.json", "devDependencies", "vite", "2.0.0");
		write([
			upgrade("apps/web/package.json", "vite", { depType: "devDependencies" }),
		]);

		const files = fixture.list(".changeset");

		assert.equal(files.length, 1);
		assert.match(files[0], /^z-renovate-deps-[0-9a-f]{8}\.md$/);
	});

	test("keeps a change file that the base branch has", () => {
		fixture.write(".changeset/other.md", content(["nuvs"], "Pending."));
		fixture.commitAll("Pending change");
		fixture.checkout("renovate/deps");
		fixture.bump("apps/web/package.json", "devDependencies", "vite", "2.0.0");
		write([
			upgrade("apps/web/package.json", "vite", { depType: "devDependencies" }),
		]);

		const files = fixture.list(".changeset");

		assert.equal(files.length, 2);
		assert.equal(files[0], "other.md");
		assert.equal(
			fixture.read(".changeset/other.md"),
			content(["nuvs"], "Pending."),
		);
	});
});
