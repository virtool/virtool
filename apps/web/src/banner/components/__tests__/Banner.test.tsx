import { screen } from "@testing-library/react";
import { createFakeBanner } from "@tests/fake/banner";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFetchBanner } from "../../queries";
import Banner from "../Banner";

vi.mock("../../queries", () => ({
	useFetchBanner: vi.fn(),
}));

const useFetchBannerMock = vi.mocked(useFetchBanner);

beforeEach(() => {
	useFetchBannerMock.mockReset();
});

describe("Banner", () => {
	it("shows an active banner in its configured color", () => {
		useFetchBannerMock.mockReturnValue({
			data: createFakeBanner({
				active: true,
				color: "blue",
				message: "Maintenance tonight",
			}),
			isPending: false,
		} as ReturnType<typeof useFetchBanner>);

		renderWithProviders(<Banner />);

		expect(screen.getByText("Maintenance tonight")).toHaveClass("bg-blue-500");
	});

	it("hides the banner when it is inactive", () => {
		useFetchBannerMock.mockReturnValue({
			data: createFakeBanner({
				active: false,
				message: "Maintenance tonight",
			}),
			isPending: false,
		} as ReturnType<typeof useFetchBanner>);

		renderWithProviders(<Banner />);

		expect(screen.queryByText("Maintenance tonight")).not.toBeInTheDocument();
	});
});
