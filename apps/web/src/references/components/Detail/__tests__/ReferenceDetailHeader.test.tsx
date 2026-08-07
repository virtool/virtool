import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeReference } from "@tests/fake/references";
import { mockGetReference } from "@tests/server-fn/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import ReferenceDetailHeader from "../ReferenceDetailHeader";

describe("<ReferenceDetailHeaderIcon />", () => {
	let props: ComponentProps<typeof ReferenceDetailHeader>;
	let reference: ReturnType<typeof createFakeReference>;
	let path: string;

	beforeEach(() => {
		reference = createFakeReference();
		mockGetReference(reference);
		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		props = {
			createdAt: reference.createdAt,
			detail: reference,
			name: reference.name,
			userHandle: reference.user?.handle ?? "",
		};
		path = `/refs/${reference.id}/manage`;
	});

	it("should render", async () => {
		await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

		expect(screen.getByText(reference.name)).toBeInTheDocument();
		expect(
			screen.getByText(`${reference.user?.handle} created`),
		).toBeInTheDocument();
	});

	it("should render the modify button when [canModify=true]", async () => {
		await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

		expect(
			await screen.findByRole("button", { name: "modify" }),
		).toBeInTheDocument();
	});

	it("should render no actions when [canModify=false]", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

		expect(screen.queryByRole("button")).toBeNull();
	});

	it("should render the archive button when [canModify=true]", async () => {
		await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

		expect(
			await screen.findByRole("button", { name: "archive" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Archived")).toBeNull();
	});

	it("should not render the archive button when [canModify=false]", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

		expect(screen.queryByRole("button", { name: "archive" })).toBeNull();
	});

	describe("when archived", () => {
		beforeEach(() => {
			reference = createFakeReference({ archived: true });
			mockGetReference(reference);
			mockGetAccount(createFakeAccount({ administratorRole: "full" }));
			props = {
				createdAt: reference.createdAt,
				detail: reference,
				name: reference.name,
				userHandle: reference.user?.handle ?? "",
			};
			path = `/refs/${reference.id}/manage`;
		});

		it("should render the name, attribution, and Archived badge", async () => {
			await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

			expect(screen.getByText(reference.name)).toBeInTheDocument();
			expect(
				screen.getByText(`${reference.user?.handle} created`),
			).toBeInTheDocument();
			expect(screen.getByText("Archived")).toBeInTheDocument();
		});

		it("should render the unarchive button when [canModify=true]", async () => {
			await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

			expect(
				await screen.findByRole("button", { name: "unarchive" }),
			).toBeInTheDocument();
		});

		it("should not render the unarchive button when [canModify=false]", async () => {
			mockGetAccount(createFakeAccount({ administratorRole: null }));
			await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

			expect(screen.queryByRole("button", { name: "unarchive" })).toBeNull();
		});

		it("should not render the edit button", async () => {
			await renderWithRouter(<ReferenceDetailHeader {...props} />, path);

			await screen.findByRole("button", { name: "unarchive" });
			expect(screen.queryByRole("button", { name: "modify" })).toBeNull();
		});
	});
});
