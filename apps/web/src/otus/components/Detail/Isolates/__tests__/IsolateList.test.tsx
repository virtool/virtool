import { formatIsolateName } from "@app/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu, createFakeOtuIsolate } from "@tests/fake/otus";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import type { Otu, OtuIsolate } from "@virtool/contracts";
import { describe, expect, it, vi } from "vitest";

const currentOtu = vi.hoisted(() => ({ value: null as Otu | null }));

vi.mock("@otus/components/CurrentOtuContext", async () => {
	const { createFakeReference } = await import("@tests/fake/references");
	const reference = createFakeReference();

	return {
		useCurrentOtuContext: () => ({ otu: currentOtu.value, reference }),
	};
});

vi.mock("@references/hooks", () => ({
	useCheckReferenceRight: () => ({ hasPermission: false }),
	useReferenceIsArchived: () => false,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	getRouteApi: () => ({
		useParams: () => ({ refId: "1", otuId: "otu-1" }),
	}),
}));

// jsdom has no layout, so the virtualizer would render no rows.
vi.mock("@tanstack/react-virtual", () => ({
	useVirtualizer: ({ count }: { count: number }) => ({
		getTotalSize: () => count * 48,
		getVirtualItems: () =>
			Array.from({ length: count }, (_, index) => ({
				index,
				size: 48,
				start: index * 48,
			})),
	}),
}));

import IsolateList from "../IsolateList";

function createIsolates() {
	const [alpha, bravo, charlie, delta, echo] = [
		"Alpha",
		"Bravo",
		"Charlie",
		"Delta",
		"Echo",
	].map((sourceName) =>
		createFakeOtuIsolate({ sourceName, sourceType: "isolate" }),
	) as [OtuIsolate, OtuIsolate, OtuIsolate, OtuIsolate, OtuIsolate];

	return {
		alpha,
		bravo,
		charlie,
		isolates: [alpha, bravo, charlie, delta, echo],
	};
}

function renderList(otu: Otu) {
	currentOtu.value = otu;
	return <IsolateList />;
}

describe("<IsolateList />", () => {
	it("keeps the selection when the isolate list changes", async () => {
		const { alpha, bravo, charlie, isolates } = createIsolates();
		const otu = createFakeOtu({ isolates });

		const { rerender } = renderWithProviders(
			<MemoryRouter>{renderList(otu)}</MemoryRouter>,
		);

		const first = await screen.findByRole("checkbox", {
			name: `Select ${formatIsolateName(alpha)}`,
		});
		const second = screen.getByRole("checkbox", {
			name: `Select ${formatIsolateName(bravo)}`,
		});

		await userEvent.click(first);
		await userEvent.click(second);

		expect(screen.getByText("2 selected · 5 isolates")).toBeInTheDocument();

		rerender(
			<MemoryRouter>
				{renderList({
					...otu,
					isolates: [
						...isolates,
						createFakeOtuIsolate({
							sourceName: "Foxtrot",
							sourceType: "isolate",
						}),
					],
				})}
			</MemoryRouter>,
		);

		expect(
			await screen.findByText("2 selected · 6 isolates"),
		).toBeInTheDocument();
		expect(first).toBeChecked();
		expect(second).toBeChecked();
		expect(
			screen.getByRole("checkbox", {
				name: `Select ${formatIsolateName(charlie)}`,
			}),
		).not.toBeChecked();
	});

	it("clears the selection when the search term changes", async () => {
		const { alpha, bravo, isolates } = createIsolates();

		renderWithProviders(
			<MemoryRouter>{renderList(createFakeOtu({ isolates }))}</MemoryRouter>,
		);

		await userEvent.click(
			await screen.findByRole("checkbox", {
				name: `Select ${formatIsolateName(alpha)}`,
			}),
		);
		await userEvent.click(
			screen.getByRole("checkbox", {
				name: `Select ${formatIsolateName(bravo)}`,
			}),
		);

		expect(screen.getByText("2 selected · 5 isolates")).toBeInTheDocument();

		await userEvent.type(
			screen.getByRole("textbox", { name: "Search sequences" }),
			"Alpha",
		);

		expect(await screen.findByText("1 of 5 isolates")).toBeInTheDocument();
		expect(screen.queryByText(/selected/)).toBeNull();
		expect(
			screen.getByRole("checkbox", {
				name: `Select ${formatIsolateName(alpha)}`,
			}),
		).not.toBeChecked();
	});
});
