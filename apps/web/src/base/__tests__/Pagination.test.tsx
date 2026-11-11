import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup.js";
import { beforeEach, describe, expect, it } from "vitest";
import Pagination from "../Pagination";

type PaginationTestProps = {
	currentPage: number;
	pageCount: number;
	storedPage: number;
};

describe("<Pagination />", () => {
	let props: PaginationTestProps;

	beforeEach(() => {
		props = {
			pageCount: 6,
			currentPage: 1,
			storedPage: 1,
		};
	});

	it("should render the controls and the page range", async () => {
		renderWithProviders(<Pagination {...props} />);
		expect(
			screen.getByRole("button", { name: "Go to previous page" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Go to next page" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "5" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "6" })).not.toBeInTheDocument();
	});

	it("should render no pagination controls when pageCount=0", async () => {
		props.pageCount = 0;
		renderWithProviders(
			<Pagination {...props}>
				<p>Rows</p>
			</Pagination>,
		);
		expect(screen.getByText("Rows")).toBeInTheDocument();
		expect(
			screen.queryByRole("navigation", { name: "pagination" }),
		).not.toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});
