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
		file: "z-renovate-deps.md",
		summary: "Update dependencies.",
		details: "- Bump `zod` from 3.0.0 to 4.0.0.",
		packages: ["virtool"],
		number: "30",
	},
	{
		file: "build-images.md",
		summary: "Build each image from source inside its Dockerfile",
		details: "The image contents do not change.",
		packages: ["virtool", "nuvs", "create-sample"],
		number: "12",
	},
	{
		file: "fix-redirect.md",
		summary: "Fix the redirect",
		details: "",
		packages: ["nuvs"],
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

	test("lists virtool first, then the others by name", () => {
		const lines = body.split("\n").filter((line) => line.includes(" → "));

		assert.deepEqual(lines, [
			"- virtool: 42.61.2 → 42.62.0",
			"- create-sample: 2.0.0 → 2.0.1",
			"- nuvs: 1.0.0 → 1.0.1",
		]);
	});

	test("lists a change that names several packages once", () => {
		assert.equal(body.split("Build each image").length, 2);
		assert.ok(
			body.includes(
				"Packages: virtool, create-sample, nuvs. Pull request: #12.",
			),
		);
	});

	test("writes a summary-only change as a bullet without a missing link", () => {
		assert.ok(body.includes("\n- Fix the redirect (nuvs)\n"));
	});

	test("puts bullets first, then detailed changes in file name order", () => {
		const order = [
			"- Fix the redirect",
			"### Build each image",
			"### Update dependencies.",
		].map((text) => body.indexOf(text));

		assert.deepEqual(
			order,
			order.toSorted((a, b) => a - b),
		);
		assert.ok(order.every((index) => index > -1));
		assert.ok(
			body.includes(
				"### Update dependencies.\n\nPackages: virtool. Pull request: #30.\n\n- Bump",
			),
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
