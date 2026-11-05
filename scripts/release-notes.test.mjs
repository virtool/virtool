import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getReleaseNotes } from "./release-notes.mjs";

const changelog = `## 1.3.0 (2026-11-05)

### Features

- Add a page

### Maintenance

- Prepare the schema

#### Update dependencies

- Bump \`zod\` from 3.0.0 to 4.0.0.

### Notes

#### Upgrade the database

**Action required:** Run the migration.

## 1.2.0 (2026-11-01)

### Maintenance

- Build faster

## 1.1.0 (2026-10-01)

### Fixes

#### Maintenance

The word is a change summary here.

\`\`\`md
### Maintenance
\`\`\`
`;

describe("getReleaseNotes", () => {
	test("returns undefined for a version with no section", () => {
		assert.equal(getReleaseNotes(changelog, "9.9.9"), undefined);
	});

	test("moves the Maintenance section to a collapsed block at the end", () => {
		assert.equal(
			getReleaseNotes(changelog, "1.3.0"),
			[
				"## Features",
				"",
				"- Add a page",
				"",
				"## Notes",
				"",
				"### Upgrade the database",
				"",
				"**Action required:** Run the migration.",
				"",
				"<details>",
				"<summary>Maintenance</summary>",
				"",
				"- Prepare the schema",
				"",
				"### Update dependencies",
				"",
				"- Bump `zod` from 3.0.0 to 4.0.0.",
				"",
				"</details>",
			].join("\n"),
		);
	});

	test("collapses a release with only maintenance changes", () => {
		assert.equal(
			getReleaseNotes(changelog, "1.2.0"),
			"<details>\n<summary>Maintenance</summary>\n\n- Build faster\n\n</details>",
		);
	});

	test("keeps a change named Maintenance and fenced text in the notes", () => {
		const notes = getReleaseNotes(changelog, "1.1.0");

		assert.ok(!notes.includes("<details>"));
		assert.ok(notes.includes("### Maintenance\n\nThe word is"));
		assert.ok(notes.includes("```md\n### Maintenance\n```"));
	});
});
