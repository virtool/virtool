import type { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { mockFindReferences } from "@tests/server-fn/references";
import {
	mockGetReferencesV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { rootQueryKeys } from "@wall/keys";
import { describe, expect, it } from "vitest";

function betaOff(queryClient: QueryClient) {
	queryClient.setQueryData(rootQueryKeys.all(), {
		firstUser: false,
		referenceV2Beta: false,
	});
}

describe("Reference v2 beta routes", () => {
	it("hides the v2 index and descendants when disabled", async () => {
		await renderRoute("/refs/alpha", { seed: betaOff });
		expect(await screen.findByText("Not found")).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Alpha" }),
		).not.toBeInTheDocument();
		expect(referenceV2ServerFnMocks.getReferencesV2Fn).not.toHaveBeenCalled();
	});

	it("hides a direct v2 detail URL before loading Reference data", async () => {
		await renderRoute(
			"/refs/alpha/00000000-0000-4000-8000-000000000001/settings",
			{ seed: betaOff },
		);
		expect(await screen.findByText("Not found")).toBeInTheDocument();
		expect(referenceV2ServerFnMocks.getReferenceV2Fn).not.toHaveBeenCalled();
	});

	it("keeps v1 References available when disabled", async () => {
		mockFindReferences([]);
		await renderRoute("/refs", { seed: betaOff });
		expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute(
			"href",
			"/refs",
		);
		expect(
			screen.queryByRole("link", { name: "Alpha" }),
		).not.toBeInTheDocument();
	});

	it("shows the v2 route and navigation when enabled", async () => {
		mockGetReferencesV2([]);
		await renderRoute("/refs/alpha");
		expect(
			await screen.findByText("No alpha references found"),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
			"href",
			"/refs/alpha",
		);
	});
});
