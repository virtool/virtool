import { screen } from "@testing-library/react";
import { createFakeReference } from "@tests/fake/references";
import { mockGetReference } from "@tests/server-fn/references";
import { renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<ReferenceManager />", () => {
	let reference: ReturnType<typeof createFakeReference>;
	let path: string;

	beforeEach(() => {
		reference = createFakeReference({
			clonedFrom: { id: 62, name: "Source Reference Name" },
		});
		path = `/refs/${reference.id}/manage`;
		mockGetReference(reference);
	});

	it("should render the general information, clone source, build, and contributors", async () => {
		await renderRoute(path);

		expect(await screen.findByText("General")).toBeInTheDocument();

		// The general table is captioned and its row labels are row headers.
		expect(
			screen.getByRole("table", { name: "Reference general information" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("rowheader", { name: "Description" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("rowheader", { name: "Organism" }),
		).toBeInTheDocument();
		expect(screen.getByText("Latest Index Build")).toBeInTheDocument();
		expect(screen.getByText("No index builds found")).toBeInTheDocument();
		expect(screen.getByText("Contributors")).toBeInTheDocument();
		expect(screen.getByText("No contributors found")).toBeInTheDocument();

		expect(screen.getByText("Clone Reference")).toBeInTheDocument();
		expect(screen.getByText("Source Reference")).toBeInTheDocument();
		expect(screen.getByText("Source Reference Name")).toBeInTheDocument();
	});
});
