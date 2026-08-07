import AnalysesList from "@analyses/components/AnalysisList";
import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeSample } from "@tests/fake/samples";
import { mockFindAnalyses } from "@tests/server-fn/analyses";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { at, MemoryRouter, renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<AnalysesToolbar />", () => {
	let sample: ReturnType<typeof createFakeSample>;

	beforeEach(() => {
		sample = createFakeSample();
		mockFindAnalyses([
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		]);
		mockFindHmms(createFakeHmmSearchResults());
	});

	function renderList() {
		renderWithProviders(
			<MemoryRouter>
				<AnalysesList onPageChange={() => {}} page={1} sampleId={sample.id} />
			</MemoryRouter>,
		);
	}

	it("should show analysis creation when user is full admin", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should show analysis creation when user is the owner of the sample", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.user.id = account.id;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should show analysis creation when user is in the correct group and write is enabled", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.group = at(account.groups, 0);
		sample.groupWrite = true;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should show analysis creation when all users editing a sample is permitted", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.allWrite = true;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should not render analysis creation option when user has no permissions", async () => {
		sample.allWrite = false;
		sample.groupWrite = false;
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Pathoscope")).toBeInTheDocument();
		expect(screen.queryByText("Create")).not.toBeInTheDocument();
	});
});
