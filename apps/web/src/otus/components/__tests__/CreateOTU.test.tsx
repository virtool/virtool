import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { createFakeReference } from "@tests/fake/references";
import { mockCreateOtu } from "@tests/server-fn/otus";
import { mockGetReference } from "@tests/server-fn/references";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OtuCreate from "../OtuCreate";

describe("<OtuCreate />", () => {
	let reference: ReturnType<typeof createFakeReference>;

	beforeEach(() => {
		reference = createFakeReference();
		mockGetReference(reference);
	});

	it("should render", () => {
		renderWithProviders(
			<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
		);

		expect(screen.getByText("Create OTU")).toBeInTheDocument();
		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByLabelText("Abbreviation")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});

	it("should render error once submitted with no name", async () => {
		renderWithProviders(
			<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
		);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Name required")).toBeInTheDocument();
	});

	it("should create OTU without abbreviation", async () => {
		const createOtu = mockCreateOtu(
			createFakeOtu({ name: "TestName", abbreviation: "" }),
		);

		renderWithProviders(
			<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
		);

		await userEvent.type(screen.getByLabelText("Name"), "TestName");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(createOtu).toHaveBeenCalledWith({
				data: {
					referenceId: reference.id,
					name: "TestName",
					abbreviation: "",
					schema: [],
				},
			}),
		);
	});

	it("should create OTU with abbreviation", async () => {
		const createOtu = mockCreateOtu(
			createFakeOtu({ name: "TestName", abbreviation: "TestAbbreviation" }),
		);

		renderWithProviders(
			<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
		);

		await userEvent.type(screen.getByLabelText("Name"), "TestName");
		await userEvent.type(
			screen.getByLabelText("Abbreviation"),
			"TestAbbreviation",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(createOtu).toHaveBeenCalledWith({
				data: {
					referenceId: reference.id,
					name: "TestName",
					abbreviation: "TestAbbreviation",
					schema: [],
				},
			}),
		);
	});
});
