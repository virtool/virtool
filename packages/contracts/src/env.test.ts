import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveFileBacked } from "./env";

function writeSecret(contents: string): string {
	const path = join(mkdtempSync(join(tmpdir(), "vt-env-")), "secret");
	writeFileSync(path, contents);
	return path;
}

describe("resolveFileBacked", () => {
	it("leaves a plain variable alone", () => {
		const resolved = resolveFileBacked(["VT_TOKEN"], { VT_TOKEN: "plain" });

		expect(resolved.VT_TOKEN).toBe("plain");
	});

	it("reads the value from the file named by the _FILE variant", () => {
		const resolved = resolveFileBacked(["VT_TOKEN"], {
			VT_TOKEN_FILE: writeSecret("from-file"),
		});

		expect(resolved.VT_TOKEN).toBe("from-file");
	});

	// A rollout moving to a secrets-store mount can still carry the stale env var
	// from the `Secret` it replaces. Erroring on the overlap would crashloop the
	// very rollout that fixes it, so the file wins instead.
	it("prefers the file over a plain variable of the same name", () => {
		const resolved = resolveFileBacked(["VT_TOKEN"], {
			VT_TOKEN: "stale",
			VT_TOKEN_FILE: writeSecret("current"),
		});

		expect(resolved.VT_TOKEN).toBe("current");
	});

	// Kubernetes mounts routinely end in a newline; a token compared byte for
	// byte would never match if it survived.
	it("trims surrounding whitespace", () => {
		const resolved = resolveFileBacked(["VT_TOKEN"], {
			VT_TOKEN_FILE: writeSecret("  padded\n"),
		});

		expect(resolved.VT_TOKEN).toBe("padded");
	});

	it("treats an empty file as an unset value", () => {
		const resolved = resolveFileBacked(["VT_TOKEN"], {
			VT_TOKEN_FILE: writeSecret("   "),
		});

		expect(resolved.VT_TOKEN).toBe("");
	});

	// Failing at startup beats silently falling back to a plain variable that may
	// not be there, which would surface later as an unrelated-looking error.
	it("throws when the path cannot be read", () => {
		expect(() =>
			resolveFileBacked(["VT_TOKEN"], {
				VT_TOKEN_FILE: "/nonexistent/secret",
			}),
		).toThrow(/VT_TOKEN_FILE points at \/nonexistent\/secret/);
	});

	// The caller names the keys, so a key left off the list keeps its plain value
	// and silently loses the file variant.
	it("ignores a _FILE variant for a key it was not given", () => {
		const resolved = resolveFileBacked([], {
			VT_TOKEN_FILE: writeSecret("ignored"),
		});

		expect(resolved.VT_TOKEN).toBeUndefined();
	});

	it("does not mutate the environment it was given", () => {
		const env = { VT_TOKEN_FILE: writeSecret("from-file") };

		resolveFileBacked(["VT_TOKEN"], env);

		expect(env).not.toHaveProperty("VT_TOKEN");
	});
});
