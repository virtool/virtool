import { screen } from "@testing-library/react";
import { createFakeSampleRead } from "@tests/fake/samples";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import SampleFileSizeWarning from "../SampleFileSizeWarning";

describe("<SampleFileSizeWarning />", () => {
	let props: ComponentProps<typeof SampleFileSizeWarning>;

	beforeEach(() => {
		props = {
			sampleId: 1,
			reads: [],
		};
	});

	it("should not warn when every read is at least 10 MB", async () => {
		props.reads = [createFakeSampleRead({ size: 10000000 })];
		await renderWithRouter(<SampleFileSizeWarning {...props} />);

		expect(
			screen.queryByText(
				"The read files in this sample are smaller than expected.",
			),
		).toBeNull();
	});

	it("should warn with a link to the files when a read is smaller than 10 MB", async () => {
		props.reads = [createFakeSampleRead({ size: 5 })];
		await renderWithRouter(<SampleFileSizeWarning {...props} />);

		expect(
			screen.getByText(
				"The read files in this sample are smaller than expected.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("and ensure they are correct."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Check the file sizes" }),
		).toHaveAttribute("href", "/samples/1/files");
		expect(
			screen.queryByText("Check the file sizes and ensure they are correct."),
		).toBeNull();
	});

	it("should not link to the files on the uploads page", async () => {
		props.reads = [createFakeSampleRead({ size: 5 })];
		await renderWithRouter(
			<SampleFileSizeWarning {...props} />,
			"/samples/test/uploads",
		);

		expect(
			screen.getByText(
				"The read files in this sample are smaller than expected.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("Check the file sizes and ensure they are correct."),
		).toBeInTheDocument();
		expect(screen.queryByRole("link")).toBeNull();
	});
});
