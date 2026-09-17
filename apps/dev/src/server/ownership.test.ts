import { expect, it } from "vitest";
import { validateOwnership } from "./ownership.ts";

it("rejects cleanup of a resource owned by another generation", () => {
	expect(() =>
		validateOwnership(
			{
				"ca.virtool.dev.environment": "env",
				"ca.virtool.dev.generation": "1",
				"ca.virtool.dev.repository": "repo",
			},
			{ environmentId: "env", generation: 2, repositoryId: "repo" },
		),
	).toThrow(/ownership labels/);
});
