import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeReference } from "@tests/fake/references";
import { mockGetReference } from "@tests/server-fn/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OtuToolbar from "../OtuToolbar";

describe("<OtuToolbar />", () => {
	let reference: ReturnType<typeof createFakeReference>;

	beforeEach(() => {
		reference = createFakeReference();
		mockGetReference(reference);
	});

	it("should render Create button when [canCreate=true]", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));

		renderWithProviders(
			<OtuToolbar
				term=""
				setTerm={vi.fn()}
				onCreate={vi.fn()}
				referenceId={reference.id}
			/>,
		);

		expect(
			await screen.findByRole("button", { name: "Create" }),
		).toBeInTheDocument();
	});

	it("should not render Create button when [canCreate=false]", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));

		renderWithProviders(
			<OtuToolbar
				term=""
				setTerm={vi.fn()}
				onCreate={vi.fn()}
				referenceId={reference.id}
			/>,
		);

		expect(await screen.findByRole("textbox")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
	});
});
