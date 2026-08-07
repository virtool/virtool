import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeReferenceMinimal } from "@tests/fake/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceItem } from "../ReferenceItem";

describe("<ReferenceItem />", () => {
	let props: ComponentProps<typeof ReferenceItem>;

	beforeEach(() => {
		props = {
			onClone: vi.fn(),
			reference: createFakeReferenceMinimal(),
		};
	});

	it("should render when [organism='virus'] and [progress=32]", async () => {
		props.reference = createFakeReferenceMinimal({
			task: {
				complete: false,
				createdAt: new Date(),
				error: null,
				id: 1,
				progress: 32,
				step: "test step",
				type: "remote_reference",
			},
			organism: "virus",
		});
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(screen.getByRole("progressbar")).toHaveAttribute("data-value", "32");
	});

	it("should render when [progress=100]", async () => {
		props.reference = createFakeReferenceMinimal({
			task: {
				complete: true,
				createdAt: new Date(),
				error: null,
				id: 1,
				progress: 100,
				step: "test step",
				type: "remote_reference",
			},
		});
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("should render the Archived badge when [archived=true]", async () => {
		props.reference = createFakeReferenceMinimal({ archived: true });
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("should not render the Archived badge when [archived=false]", async () => {
		props.reference = createFakeReferenceMinimal({ archived: false });
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(screen.queryByText("Archived")).toBeNull();
	});

	it("should render the clone button when the user has create_ref and the reference is not archived", async () => {
		mockGetAccount(
			createFakeAccount({
				permissions: createFakePermissions({ create_ref: true }),
			}),
		);
		props.reference = createFakeReferenceMinimal({ archived: false });
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(
			await screen.findByRole("button", { name: "clone" }),
		).toBeInTheDocument();
	});

	it("should not render the clone button when [archived=true]", async () => {
		mockGetAccount(
			createFakeAccount({
				permissions: createFakePermissions({ create_ref: true }),
			}),
		);
		props.reference = createFakeReferenceMinimal({ archived: true });
		await renderWithRouter(<ReferenceItem {...props} />);

		expect(await screen.findByText("Archived")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "clone" })).toBeNull();
	});
});
