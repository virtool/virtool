import SampleRights from "@samples/components/Detail/SampleRights";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakeSample } from "@tests/fake/samples";
import { mockListGroups } from "@tests/server-fn/groups";
import {
	mockGetSample,
	mockUpdateSampleRights,
} from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<SampleRights />", () => {
	let sample: ReturnType<typeof createFakeSample>;
	let group: ReturnType<typeof createFakeGroup>;

	beforeEach(() => {
		sample = createFakeSample({
			allRead: false,
			allWrite: false,
			groupRead: false,
			groupWrite: false,
		});
		group = createFakeGroup();
		mockGetSample(sample);
		mockListGroups([group]);
	});

	async function renderRights() {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		const updateSampleRights = mockUpdateSampleRights(sample);
		renderWithProviders(<SampleRights sampleId={sample.id} />);

		expect(await screen.findByText("Sample Rights")).toBeInTheDocument();

		return updateSampleRights;
	}

	it("should render and save a group change", async () => {
		const updateSampleRights = await renderRights();

		expect(screen.getByText("Group Rights")).toBeInTheDocument();
		expect(screen.getByText("All Users' Rights")).toBeInTheDocument();

		await userEvent.click(screen.getByLabelText("Group"));
		await userEvent.click(screen.getByRole("option", { name: group.name }));

		await waitFor(() =>
			expect(updateSampleRights).toHaveBeenCalledWith({
				data: expect.objectContaining({ group: group.id }),
			}),
		);
	});

	it("should save the group and all users' rights", async () => {
		const updateSampleRights = await renderRights();

		await userEvent.click(screen.getByLabelText("Group Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		await waitFor(() =>
			expect(updateSampleRights).toHaveBeenLastCalledWith({
				data: expect.objectContaining({ groupRead: true, groupWrite: true }),
			}),
		);

		await userEvent.click(screen.getByLabelText("All Users' Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		await waitFor(() =>
			expect(updateSampleRights).toHaveBeenLastCalledWith({
				data: expect.objectContaining({ allRead: true, allWrite: true }),
			}),
		);
	});

	it("should return Not allowed panel when [canModifyRights=false]", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		renderWithProviders(<SampleRights sampleId={sample.id} />);

		expect(await screen.findByText("Not allowed")).toBeInTheDocument();
	});
});
