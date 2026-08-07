import { getSubtractionFastaName } from "@subtraction/utils";
import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { mockGetSubtraction } from "@tests/server-fn/subtractions";
import { renderRoute } from "@tests/setup";
import type { SubtractionMinimal } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

function formatSubtractionPath(subtraction: SubtractionMinimal) {
	return `/subtractions/${subtraction.id}`;
}

describe("<SubtractionDetail />", () => {
	let subtraction: ReturnType<typeof createFakeSubtraction>;
	let path: string;

	beforeEach(() => {
		// Pin count and linkedSamples so neither the sequence-count nor the
		// linked-samples cell can render the same number as the other.
		subtraction = createFakeSubtraction({
			count: 100,
			linkedSamples: [
				{ id: 1, name: "sample-a" },
				{ id: 2, name: "sample-b" },
				{ id: 3, name: "sample-c" },
			],
		});
		path = formatSubtractionPath(subtraction);
	});

	it("should render", async () => {
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path);

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(await screen.findByText(subtraction.nickname)).toBeInTheDocument();
		expect(
			await screen.findByText(subtraction.linkedSamples.length),
		).toBeInTheDocument();

		const fastaName = getSubtractionFastaName(subtraction.name);
		const download = await screen.findByRole("link", { name: fastaName });
		expect(download).toHaveAttribute("href", subtraction.files[0]?.downloadUrl);
		expect(download).toHaveAttribute("download", fastaName);

		expect(getSubtraction).toHaveBeenCalled();
	});

	it("should render loading when [detail=null]", async () => {
		await renderRoute(path);

		expect(screen.getByLabelText("loading")).toBeInTheDocument();
		expect(screen.queryByText(subtraction.name)).not.toBeInTheDocument();
	});

	it("should render pending message when subtraction is not ready", async () => {
		const unreadySubtraction = createFakeSubtraction({ ready: false });
		const getSubtraction = mockGetSubtraction(unreadySubtraction);
		await renderRoute(formatSubtractionPath(unreadySubtraction));

		expect(
			await screen.findByText("Subtraction is still being imported"),
		).toBeInTheDocument();

		expect(getSubtraction).toHaveBeenCalled();
	});

	it("should not render icons when [canModify=true]", async () => {
		const permissions = createFakePermissions({ modify_subtraction: true });
		const account = createFakeAccount({ permissions });
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path, { account });

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "modify" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "delete" })).toBeInTheDocument();

		expect(getSubtraction).toHaveBeenCalled();
	});

	it("should not render icons when [canModify=false]", async () => {
		const permissions = createFakePermissions({
			modify_subtraction: false,
		});
		const account = createFakeAccount({ permissions });
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path, { account });

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "modify" })).toBeNull();
		expect(screen.queryByRole("button", { name: "delete" })).toBeNull();

		expect(getSubtraction).toHaveBeenCalled();
	});
});
