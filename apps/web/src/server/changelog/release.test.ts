import { describe, expect, it } from "vitest";
import { getReleaseDate } from "./release";

const changelog = `## 2.0.0 (2026-02-01)

### Features

- A feature.

## 1.0.0 (2026-01-01)

### Fixes

- A fix.
`;

describe("getReleaseDate", () => {
	it("returns the release date of the given version", () => {
		expect(getReleaseDate(changelog, "1.0.0")).toEqual(
			new Date("2026-01-01T00:00:00.000Z"),
		);
	});

	it("throws when the changelog has no release for the version", () => {
		expect(() => getReleaseDate(changelog, "3.0.0")).toThrow(
			"The changelog has no release for version 3.0.0",
		);
	});

	it("finds this build's version in the bundled changelog", () => {
		expect(getReleaseDate()).toBeInstanceOf(Date);
	});
});
