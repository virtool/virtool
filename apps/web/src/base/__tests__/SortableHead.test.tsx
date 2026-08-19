import SortableHead from "@base/SortableHead";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import type { SortDirection } from "@virtool/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

type Field = "name" | "size";

type HeadersProps = {
	direction?: SortDirection;
	onSort?: (field: Field) => void;
	sort: Field | undefined;
};

function Headers({
	direction = "ascending",
	onSort = vi.fn(),
	sort,
}: HeadersProps) {
	return (
		<table>
			<thead>
				<tr>
					<SortableHead
						direction={direction}
						field="name"
						onSort={onSort}
						sort={sort}
					>
						Name
					</SortableHead>
					<SortableHead
						direction={direction}
						field="size"
						onSort={onSort}
						sort={sort}
					>
						Size
					</SortableHead>
				</tr>
			</thead>
		</table>
	);
}

/** A table whose sort state responds to its headers, as a caller's would. */
function HeadersEnvironment() {
	const [sort, setSort] = useState<Field | undefined>(undefined);
	const [direction, setDirection] = useState<SortDirection>("descending");

	function handleSort(field: Field) {
		setDirection(
			sort === field && direction === "ascending" ? "descending" : "ascending",
		);
		setSort(field);
	}

	return <Headers direction={direction} onSort={handleSort} sort={sort} />;
}

describe("<SortableHead />", () => {
	it("marks only the active column as sorted", () => {
		renderWithProviders(<Headers direction="ascending" sort="name" />);

		expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
			"aria-sort",
			"ascending",
		);
		expect(screen.getByRole("columnheader", { name: "Size" })).toHaveAttribute(
			"aria-sort",
			"none",
		);
	});

	it("carries the direction of the active column", () => {
		renderWithProviders(<Headers direction="descending" sort="size" />);

		expect(screen.getByRole("columnheader", { name: "Size" })).toHaveAttribute(
			"aria-sort",
			"descending",
		);
	});

	it("leaves every column unsorted when there is no active column", () => {
		renderWithProviders(<Headers sort={undefined} />);

		for (const name of ["Name", "Size"]) {
			expect(screen.getByRole("columnheader", { name })).toHaveAttribute(
				"aria-sort",
				"none",
			);
		}
	});

	it("reports its own field when clicked", async () => {
		const onSort = vi.fn();

		renderWithProviders(<Headers onSort={onSort} sort="name" />);

		await userEvent.click(screen.getByRole("button", { name: "Size" }));

		expect(onSort).toHaveBeenCalledWith("size");
	});

	it("sorts by a new column, then reverses it on the next click", async () => {
		renderWithProviders(<HeadersEnvironment />);

		const name = () => screen.getByRole("columnheader", { name: "Name" });

		expect(name()).toHaveAttribute("aria-sort", "none");

		await userEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(name()).toHaveAttribute("aria-sort", "ascending");

		await userEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(name()).toHaveAttribute("aria-sort", "descending");
	});

	// The arrow only ever describes the column it sits in, and `aria-sort`
	// already announces that, so it must not reach the accessible name.
	it("keeps the direction arrow out of the header's accessible name", () => {
		renderWithProviders(<Headers direction="ascending" sort="name" />);

		expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
	});
});
