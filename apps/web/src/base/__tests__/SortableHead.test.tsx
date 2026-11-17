import SortableHead from "@base/SortableHead";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import type { SortDirection } from "@virtool/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

type Field = "name" | "size";

type HeadersProps = {
	direction: SortDirection;
	onSort: (field: Field) => void;
	sort: Field | undefined;
};

function Headers({ direction, onSort, sort }: HeadersProps) {
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

function getHeader(name: string) {
	return screen.getByRole("columnheader", { name });
}

describe("<SortableHead />", () => {
	// The arrow only ever describes the column it sits in, and `aria-sort`
	// already announces that, so it must not reach the accessible name.
	it("marks only the active column with its direction", () => {
		renderWithProviders(
			<Headers direction="descending" onSort={vi.fn()} sort="size" />,
		);

		expect(getHeader("Size")).toHaveAttribute("aria-sort", "descending");
		expect(getHeader("Name")).toHaveAttribute("aria-sort", "none");
		expect(screen.getByRole("button", { name: "Size" })).toBeInTheDocument();
	});

	it("sorts by a clicked column, then reverses it on the next click", async () => {
		renderWithProviders(<HeadersEnvironment />);

		expect(getHeader("Name")).toHaveAttribute("aria-sort", "none");
		expect(getHeader("Size")).toHaveAttribute("aria-sort", "none");

		await userEvent.click(screen.getByRole("button", { name: "Name" }));

		expect(getHeader("Name")).toHaveAttribute("aria-sort", "ascending");
		expect(getHeader("Size")).toHaveAttribute("aria-sort", "none");

		await userEvent.click(screen.getByRole("button", { name: "Name" }));

		expect(getHeader("Name")).toHaveAttribute("aria-sort", "descending");

		await userEvent.click(screen.getByRole("button", { name: "Size" }));

		expect(getHeader("Size")).toHaveAttribute("aria-sort", "ascending");
		expect(getHeader("Name")).toHaveAttribute("aria-sort", "none");
	});
});
