import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeReferenceMinimal } from "@tests/fake/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceItem } from "../ReferenceItem";

function createTask(progress: number) {
	return {
		complete: progress === 100,
		createdAt: new Date(),
		error: null,
		id: 1,
		progress,
		step: "test step",
		type: "remote_reference" as const,
	};
}

describe("<ReferenceItem />", () => {
	beforeEach(() => {
		mockGetAccount(
			createFakeAccount({
				permissions: createFakePermissions({ create_ref: true }),
			}),
		);
	});

	it("shows the progress of a running task", async () => {
		await renderWithRouter(
			<ReferenceItem
				onClone={vi.fn()}
				reference={createFakeReferenceMinimal({
					archived: false,
					organism: "virus",
					task: createTask(32),
				})}
			/>,
		);

		expect(screen.getByRole("progressbar")).toHaveAttribute("data-value", "32");
		expect(screen.queryByText("Archived")).toBeNull();
	});

	it("offers a clone of an active reference whose task is complete", async () => {
		await renderWithRouter(
			<ReferenceItem
				onClone={vi.fn()}
				reference={createFakeReferenceMinimal({
					archived: false,
					task: createTask(100),
				})}
			/>,
		);

		expect(
			await screen.findByRole("button", { name: "clone" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("marks an archived reference and offers no clone", async () => {
		await renderWithRouter(
			<ReferenceItem
				onClone={vi.fn()}
				reference={createFakeReferenceMinimal({ archived: true })}
			/>,
		);

		expect(await screen.findByText("Archived")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "clone" })).toBeNull();
	});
});
