import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeBanner } from "@tests/fake/banner";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMessages = vi.fn();
const setActiveMessage = vi.fn();
const clearActiveMessage = vi.fn();
const createMessage = vi.fn();
const updateMessage = vi.fn();
const deleteMessage = vi.fn();

vi.mock("@server/messages/functions", () => ({
	findMessageFn: vi.fn(),
	findMessagesFn: (...args: unknown[]) => findMessages(...args),
	setActiveMessageFn: (...args: unknown[]) => setActiveMessage(...args),
	clearActiveMessageFn: (...args: unknown[]) => clearActiveMessage(...args),
	createMessageFn: (...args: unknown[]) => createMessage(...args),
	updateMessageFn: (...args: unknown[]) => updateMessage(...args),
	deleteMessageFn: (...args: unknown[]) => deleteMessage(...args),
}));

const { default: Banners } = await import("../Banners");

beforeEach(() => {
	findMessages.mockReset();
	setActiveMessage.mockReset();
	clearActiveMessage.mockReset();
	createMessage.mockReset();
	updateMessage.mockReset();
	deleteMessage.mockReset();
});

describe("<Banners>", () => {
	it("renders the empty state when there are no banners", async () => {
		findMessages.mockResolvedValueOnce([]);
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
		findMessages.mockResolvedValueOnce(banners);

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
		findMessages.mockResolvedValueOnce(banners);

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
		findMessages.mockResolvedValueOnce(banners);
		setActiveMessage.mockResolvedValueOnce(undefined);
		findMessages.mockResolvedValue(banners);

		renderWithProviders(<Banners />);

		await screen.findByText("First");
		await userEvent.click(screen.getByLabelText(/First/));

		await waitFor(() =>
			expect(setActiveMessage).toHaveBeenCalledWith({ data: { id: 1 } }),
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
		findMessages.mockResolvedValueOnce(banners);
		clearActiveMessage.mockResolvedValueOnce(null);
		findMessages.mockResolvedValue(banners);

		renderWithProviders(<Banners />);

		await screen.findByText("First");
		await userEvent.click(screen.getByLabelText(/Off/));

		await waitFor(() => expect(clearActiveMessage).toHaveBeenCalled());
	});
});
