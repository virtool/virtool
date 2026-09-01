import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeLocalOtuV2Summary } from "@tests/fake/otusV2";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import { mockGetLocalOtusV2 } from "@tests/server-fn/otusV2";
import { mockGetReferenceV2 } from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<LocalOtuV2List />", () => {
	it("renders OTUs with detail links", async () => {
		const reference = createFakeReferenceV2();
		mockGetReferenceV2(reference);
		const otu = createFakeLocalOtuV2Summary({
			name: "Tobacco mosaic virus",
			acronym: "TMV",
			version: 3,
			isolateCount: 2,
		});
		mockGetLocalOtusV2([otu]);

		await renderRoute(`/refs/beta/${reference.id}/otus`);

		expect(
			await screen.findByRole("link", { name: "Tobacco mosaic virus (TMV)" }),
		).toHaveAttribute("href", `/refs/beta/${reference.id}/otus/${otu.id}`);
		expect(screen.getByText("2 isolates")).toBeInTheDocument();
		expect(screen.getByText("Version 3")).toBeInTheDocument();
	});

	it("renders an empty state", async () => {
		const reference = createFakeReferenceV2();
		mockGetReferenceV2(reference);
		mockGetLocalOtusV2([]);

		await renderRoute(`/refs/beta/${reference.id}/otus`);

		expect(await screen.findByText("No OTUs found")).toBeInTheDocument();
	});

	it("filters OTUs by name and acronym", async () => {
		const reference = createFakeReferenceV2();
		mockGetReferenceV2(reference);
		const matchingOtu = createFakeLocalOtuV2Summary({
			name: "Tobacco mosaic virus",
			acronym: "TMV",
		});
		const otherOtu = createFakeLocalOtuV2Summary({
			name: "Tomato spotted wilt virus",
			acronym: "TSWV",
		});
		mockGetLocalOtusV2([matchingOtu, otherOtu]);

		await renderRoute(`/refs/beta/${reference.id}/otus`);

		const user = userEvent.setup();
		await user.type(
			screen.getByRole("textbox", { name: "Search OTUs" }),
			"TMV",
		);

		expect(
			screen.getByRole("link", { name: "Tobacco mosaic virus (TMV)" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Tomato spotted wilt virus (TSWV)" }),
		).not.toBeInTheDocument();
	});
});
