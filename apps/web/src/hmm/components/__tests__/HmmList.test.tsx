import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeTask } from "@tests/fake/tasks";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { at, renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<HmmList />", () => {
	let fakeHMMData: ReturnType<typeof createFakeHmmSearchResults>;
	let path: string;

	beforeEach(() => {
		fakeHMMData = createFakeHmmSearchResults();
		path = "/hmms";
	});

	it("should render correctly", async () => {
		mockFindHmms(fakeHMMData);
		await renderRoute(path);

		expect(await screen.findByPlaceholderText("Name")).toBeInTheDocument();

		const document = at(fakeHMMData.items, 0);
		const name = at(document.names, 0);

		expect(screen.getByText(document.cluster)).toBeInTheDocument();
		expect(screen.getByText(name)).toBeInTheDocument();
	});

	it("should render correctly when no items exist", async () => {
		const fakeHMMData = createFakeHmmSearchResults({ items: [] });
		mockFindHmms(fakeHMMData);
		await renderRoute(path);

		expect(await screen.findByText("No HMMs found")).toBeInTheDocument();
	});

	describe("<HmmInstall />", () => {
		it("should render correctly when installed = false and user has permission to install", async () => {
			const fakeHMMData = createFakeHmmSearchResults({
				items: [],
				totalCount: 0,
			});
			mockFindHmms(fakeHMMData);
			const account = createFakeAccount({
				administratorRole: "full",
			});
			await renderRoute(path, { account });

			expect(
				await screen.findByText("HMM profiles not installed."),
			).toBeInTheDocument();
			expect(
				screen.getByText(/HMM profiles are required for NuVs analysis/),
			).toBeInTheDocument();

			expect(
				screen.getByRole("button", { name: "Install" }),
			).toBeInTheDocument();
		});

		it("should render correctly when installed = false and user does not have permission to install", async () => {
			const fakeHMMData = createFakeHmmSearchResults({
				items: [],
				totalCount: 0,
			});
			mockFindHmms(fakeHMMData);
			const account = createFakeAccount({ administratorRole: null });
			await renderRoute(path, { account });

			expect(
				await screen.findByText("Contact an administrator to install HMMs."),
			).toBeInTheDocument();

			expect(
				screen.queryByRole("button", { name: "Install" }),
			).not.toBeInTheDocument();
		});

		it("should render correctly when installed = false, user has permission to install and task !== undefined", async () => {
			const fakeHMMData = createFakeHmmSearchResults({
				items: [],
				totalCount: 0,
				status: {
					errors: [],
					installed: null,
					task: createFakeTask({
						complete: false,
						id: 21,
						progress: 33,
						step: "decompress",
					}),
				},
			});
			mockFindHmms(fakeHMMData);
			const account = createFakeAccount({
				administratorRole: "full",
			});
			await renderRoute(path, { account });

			expect(await screen.findByText("Installing")).toBeInTheDocument();
			expect(screen.getByText("decompress")).toBeInTheDocument();

			expect(
				screen.queryByText("HMM profiles not installed."),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Install" }),
			).not.toBeInTheDocument();
		});
	});
});
