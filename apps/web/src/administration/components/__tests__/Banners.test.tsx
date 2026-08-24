import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeBanner } from "@tests/fake/banner";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findBanners = vi.fn();
const setActiveBanner = vi.fn();
const clearActiveBanner = vi.fn();
const createBanner = vi.fn();
const updateBanner = vi.fn();
const deleteBanner = vi.fn();

vi.mock("@server/banners/functions", () => ({
	findBannerFn: vi.fn(),
	findBannersFn: (...args: unknown[]) => findBanners(...args),
	setActiveBannerFn: (...args: unknown[]) => setActiveBanner(...args),
	clearActiveBannerFn: (...args: unknown[]) => clearActiveBanner(...args),
	createBannerFn: (...args: unknown[]) => createBanner(...args),
	updateBannerFn: (...args: unknown[]) => updateBanner(...args),
	deleteBannerFn: (...args: unknown[]) => deleteBanner(...args),
}));

const { default: Banners } = await import("../Banners");

beforeEach(() => {
	findBanners.mockReset();
	setActiveBanner.mockReset();
	clearActiveBanner.mockReset();
	createBanner.mockReset();
	updateBanner.mockReset();
	deleteBanner.mockReset();
});

describe("<Banners>", () => {
	it("renders the empty state when there are no banners", async () => {
		findBanners.mockResolvedValueOnce([]);
		renderWithProviders(<Banners />);

		expect(await screen.findByText(/no banners found/i)).toBeInTheDocument();
	});

	it("renders all banners with the active one selected", async () => {
		const banners = [
			createFakeBanner({
				id: 1,
				active: true,
				color: "blue",
				message: "Active one",
			}),
			createFakeBanner({
				id: 2,
				active: false,
				color: "red",
				message: "Inactive one",
			}),
		];
		findBanners.mockResolvedValueOnce(banners);

		renderWithProviders(<Banners />);

		expect(await screen.findByText("Active one")).toBeInTheDocument();
		expect(screen.getByText("Inactive one")).toBeInTheDocument();

		const radios = screen.getAllByRole("radio");
		// Off, banner 1, banner 2
		expect(radios).toHaveLength(3);
		expect(radios[0]).not.toBeChecked();
		expect(radios[1]).toBeChecked();
		expect(radios[2]).not.toBeChecked();
	});

	it("selects the Off option when no banner is active", async () => {
		const banners = [
			createFakeBanner({
				id: 1,
				active: false,
				color: "blue",
				message: "First",
			}),
		];
		findBanners.mockResolvedValueOnce(banners);

		renderWithProviders(<Banners />);

		await screen.findByText("First");

		const radios = screen.getAllByRole("radio");
		expect(radios[0]).toBeChecked();
		expect(radios[1]).not.toBeChecked();
	});

	it("activates a banner by selecting its radio", async () => {
		const banners = [
			createFakeBanner({
				id: 1,
				active: false,
				color: "blue",
				message: "First",
			}),
		];
		findBanners.mockResolvedValueOnce(banners);
		setActiveBanner.mockResolvedValueOnce(undefined);
		findBanners.mockResolvedValue(banners);

		renderWithProviders(<Banners />);

		await screen.findByText("First");
		await userEvent.click(screen.getByLabelText(/First/));

		await waitFor(() =>
			expect(setActiveBanner).toHaveBeenCalledWith({ data: { id: 1 } }),
		);
	});

	it("deactivates the active banner by selecting Off", async () => {
		const banners = [
			createFakeBanner({
				id: 1,
				active: true,
				color: "blue",
				message: "First",
			}),
		];
		findBanners.mockResolvedValueOnce(banners);
		clearActiveBanner.mockResolvedValueOnce(null);
		findBanners.mockResolvedValue(banners);

		renderWithProviders(<Banners />);

		await screen.findByText("First");
		await userEvent.click(screen.getByLabelText(/Off/));

		await waitFor(() => expect(clearActiveBanner).toHaveBeenCalled());
	});
});
