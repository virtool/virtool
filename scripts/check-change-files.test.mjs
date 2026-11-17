import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createFixture } from "./testing.mjs";

function valid(...names) {
	return `---\n${names.map((name) => `${name}: patch`).join("\n")}\n---\n\nFix a bug.\n\nThe bug is gone.\n`;
}

describe("check-change-files", () => {
	let fixture;

	beforeEach(() => {
		fixture = createFixture();
	});

	afterEach(() => {
		fixture.cleanup();
	});

	function check(env) {
		return fixture.run("check-change-files.mjs", ["main"], env);
	}

	function assertFails(result, ...names) {
		assert.notEqual(result.status, 0);

		for (const name of names) {
			assert.match(result.stderr, new RegExp(`^ {2}- ${name}$`, "m"));
		}
	}

	function writeEvent(labels) {
		fixture.write(
			".git/event.json",
			JSON.stringify({
				pull_request: { labels: labels.map((name) => ({ name })) },
			}),
		);

		return `${fixture.root}/.git/event.json`;
	}

	test("fails a source edit with no change file", () => {
		fixture.write("apps/web/src/x.ts", "export const x = 1;\n");

		assertFails(check(), "virtool");
	});

	test("passes a source edit with a valid change file", () => {
		fixture.write("apps/web/src/x.ts", "export const x = 1;\n");
		fixture.write(".changeset/fix.md", valid("virtool"));

		assert.equal(check().status, 0);
	});

	test("passes edits to tests, test data, test config, and Markdown", () => {
		fixture.write("apps/web/src/x.test.ts", "export {};\n");
		fixture.write("apps/web/src/fixtures/a.json", "{}\n");
		fixture.write("apps/web/tests/b.ts", "export {};\n");
		fixture.write("apps/web/vitest.config.ts", "export default {};\n");
		fixture.write("apps/web/README.md", "# Web\n");

		assert.equal(check().status, 0);
	});

	test("passes a manifest change that only bumps test tools", () => {
		fixture.bump("apps/web/package.json", "devDependencies", "vitest", "2.0.0");
		fixture.bump(
			"apps/web/package.json",
			"devDependencies",
			"@types/node",
			"2.0.0",
		);

		assert.equal(check().status, 0);
	});

	test("fails when an app bumps a build tool", () => {
		fixture.bump("apps/web/package.json", "devDependencies", "vite", "2.0.0");

		assertFails(check(), "virtool");
	});

	test("passes a development dependency bump in a package", () => {
		fixture.bump(
			"packages/data/package.json",
			"devDependencies",
			"vite",
			"2.0.0",
		);

		assert.equal(check().status, 0);
	});

	test("fails a dependency bump in a package, naming its apps", () => {
		fixture.bump("packages/data/package.json", "dependencies", "zod", "4.0.0");

		const result = check();

		assertFails(result, "virtool");
		assert.doesNotMatch(result.stderr, /^ {2}- nuvs$/m);
	});

	test("names every app that depends on an edited package", () => {
		fixture.write("packages/workflow/src/x.ts", "export const x = 1;\n");

		assertFails(check(), "nuvs", "pathoscope");
	});

	test("passes an edit in an app with no Knope package", () => {
		fixture.write("apps/site/src/x.ts", "export const x = 1;\n");

		assert.equal(check().status, 0);
	});

	test("rejects a malformed change file even with the waiver", () => {
		fixture.write("apps/web/src/x.ts", "export const x = 1;\n");
		fixture.write(".changeset/bad.md", '---\n"virtool": patch\n---\n\nFix.\n');

		const result = check({ GITHUB_EVENT_PATH: writeEvent(["no-release"]) });

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /bad\.md/);
		assert.match(result.stderr, /quoted name/);
	});

	test("rejects an unknown package, a repeat, and an empty summary", () => {
		fixture.write(
			".changeset/bad.md",
			"---\nvirtool: patch\nvirtool: minor\nother: patch\n---\n\n",
		);

		const result = check();

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /named more than once/);
		assert.match(result.stderr, /`other` is not a Knope package/);
		assert.match(result.stderr, /summary is empty/);
	});

	test("rejects a summary that wraps onto a second line", () => {
		fixture.write(
			".changeset/bad.md",
			"---\nvirtool: patch\n---\n\nA long summary that\nwraps.\n",
		);

		const result = check();

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /summary must be one line/);
	});

	test("rejects a summary with no details, even with the waiver", () => {
		fixture.write(".changeset/bad.md", "---\nvirtool: patch\n---\n\nFix.\n");

		const result = check({ GITHUB_EVENT_PATH: writeEvent(["no-release"]) });

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /bad\.md/);
		assert.match(result.stderr, /needs details/);
	});

	test("rejects a mix of types with no details", () => {
		fixture.write(
			".changeset/bad.md",
			"---\nvirtool: maintenance\nnuvs: patch\n---\n\nFix.\n",
		);

		const result = check();

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /needs details/);
	});

	test("passes a maintenance change with only a summary", () => {
		fixture.write(
			".changeset/fix.md",
			"---\nvirtool: maintenance\n---\n\nPrepare the schema\n",
		);

		assert.equal(check().status, 0);
	});

	test("passes a maintenance change and a mix of types", () => {
		fixture.write("apps/web/src/x.ts", "export const x = 1;\n");
		fixture.write("apps/nuvs/src/x.ts", "export const x = 1;\n");
		fixture.write(
			".changeset/fix.md",
			"---\nvirtool: maintenance\nnuvs: minor\n---\n\nPrepare the schema\n\nDetails.\n",
		);

		assert.equal(check().status, 0);
	});

	test("rejects an unknown change type", () => {
		fixture.write(".changeset/bad.md", "---\nvirtool: chore\n---\n\nFix.\n");

		const result = check();

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /name: major\|minor\|patch\|maintenance/);
	});

	test("rejects an action paragraph in a maintenance change", () => {
		fixture.write(
			".changeset/bad.md",
			"---\nvirtool: maintenance\nnuvs: patch\n---\n\nFix.\n\n**Action required:** Act.\n",
		);

		const result = check({ GITHUB_EVENT_PATH: writeEvent(["no-release"]) });

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /bad\.md/);
		assert.match(result.stderr, /must not contain/);
	});

	test("passes an action paragraph in a change with a bump level", () => {
		fixture.write(
			".changeset/fix.md",
			"---\nvirtool: patch\n---\n\nFix.\n\n**Action required:** Act.\n",
		);

		assert.equal(check().status, 0);
	});

	test("waives a coverage gap with the label", () => {
		fixture.write("apps/web/src/x.ts", "export const x = 1;\n");

		assert.equal(
			check({ GITHUB_EVENT_PATH: writeEvent(["no-release"]) }).status,
			0,
		);
		assert.notEqual(
			check({ GITHUB_EVENT_PATH: writeEvent(["other"]) }).status,
			0,
		);
	});
});
