import { byteSize } from "@app/format";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexFileItem, type IndexFileItemProps } from "../IndexFileItem";

describe("<IndexFileItem />", () => {
	let props: IndexFileItemProps;

	beforeEach(() => {
		props = {
			downloadUrl: "/indexes/7/files/reference.fa.gz",
			name: "foo",
			size: 36461731,
		};
	});

	it("should render", () => {
		const { getByText } = renderWithProviders(<IndexFileItem {...props} />);

		expect(getByText(props.name)).toBeInTheDocument();
		expect(getByText(byteSize(props.size))).toBeInTheDocument();
	});
});
