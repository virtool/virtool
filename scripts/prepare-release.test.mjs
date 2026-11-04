import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseChangeFile } from "./change-files.mjs";
import { getReleaseBody } from "./release-body.mjs";

const versions = [
	{ name: "nuvs", from: "1.0.0", to: "1.0.1" },
	{ name: "virtool", from: "42.61.2", to: "42.62.0" },
	{ name: "create-sample", from: "2.0.0", to: "2.0.1" },
];

const changes = [
	{
		file: "z-renovate-deps-1234abcd.md",
		summary: "Update production dependencies",
		details:
			"- Bump `zod` from 3.0.0 to 4.0.0.\n- Bump `pino` from 1.0.0 to 2.0.0.",
		packages: ["virtool"],
		number: "30",
	},
	{
		file: "z-renovate-deps-1234abcd-images.md",
		summary: "Update production dependencies",
		details: "The `virtool` release lists each bump.",
		packages: ["nuvs", "create-sample"],
		number: "30",
	},
	{
		file: "renovate-postgres.md",
		summary: "Bump `postgres` from 3.0.0 to 4.0.0",
		details: "",
		packages: ["virtool"],
		number: "31",
	},
	{
		file: "build-images.md",
		summary: "Build each image inside its Dockerfile",
		details: "",
		packages: ["virtool", "nuvs", "create-sample"],
		number: "12",
	},
	{
		file: "recovery-links.md",
		summary: "Administrators send recovery links",
		details:
			"Administrators can send a link.\n\n**Action required:** Send each\nuser a link.",
		packages: ["virtool"],
		number: "14",
	},
	{
		file: "a-fix-redirect.md",
		summary: "Fix the redirect",
		details: "The redirect works.",
		packages: ["virtool", "nuvs", "create-sample"],
		number: undefined,
	},
];

describe("getReleaseBody", () => {
	const body = getReleaseBody({ versions, changes });

	test("starts with the intro", () => {
		assert.ok(
			body.startsWith(
				"Merge this pull request to publish the images and GitHub Releases below.\n",
			),
		);
	});

	test("lists only released packages in a table, virtool first", () => {
		assert.ok(
			body.includes(
				[
					"| Package | Change |",
					"| --- | --- |",
					"| virtool | 42.61.2 → 42.62.0 |",
					"| create-sample | 2.0.0 → 2.0.1 |",
					"| nuvs | 1.0.0 → 1.0.1 |",
				].join("\n"),
			),
		);
		assert.ok(!body.includes("pathoscope"));
	});

	test("copies action paragraphs to the top as one line", () => {
		assert.ok(
			body.includes("## Action required\n\n- Send each user a link. (#14)"),
		);
		assert.ok(body.includes("**Action required:** Send each\nuser a link."));
	});

	test("puts the link in the heading and names packages only when some are left out", () => {
		assert.ok(body.includes("### Fix the redirect\n\nThe redirect works."));
		assert.ok(
			body.includes(
				"### Administrators send recovery links (#14)\n\n*virtool*\n\nAdministrators",
			),
		);
		assert.ok(
			body.includes("- Build each image inside its Dockerfile (#12)\n"),
		);
	});

	test("orders sections by kind, not by file name", () => {
		const order = [
			"## Action required",
			"## Changes",
			"### Fix the redirect",
			"### Administrators send",
			"### Other changes",
			"- Build each image",
			"<summary>Dependency updates (3)</summary>",
			"- Bump `postgres`",
			"- Update production dependencies",
		].map((text) => body.indexOf(text));

		assert.ok(order.every((index) => index > -1));
		assert.deepEqual(
			order,
			order.toSorted((a, b) => a - b),
		);
	});

	test("lists a Renovate pull request once with its bumps", () => {
		assert.equal(body.split("Update production dependencies").length, 2);
		assert.ok(
			body.includes(
				"- Update production dependencies (#30)\n  - Bump `zod` from 3.0.0 to 4.0.0.\n  - Bump `pino`",
			),
		);
		assert.ok(!body.includes("lists each bump"));
		assert.ok(
			body.includes("- Bump `postgres` from 3.0.0 to 4.0.0 (#31) — *virtool*"),
		);
	});
});

describe("parseChangeFile", () => {
	const text = `---
virtool: patch
nuvs: patch
---

Build each image

The image does not change.

It builds faster.
`;

	test("reads the packages, summary, and details", () => {
		assert.deepEqual(parseChangeFile(text, new Set(["virtool", "nuvs"])), {
			errors: [],
			packages: ["virtool", "nuvs"],
			summary: "Build each image",
			details: "The image does not change.\n\nIt builds faster.",
		});
	});
});
