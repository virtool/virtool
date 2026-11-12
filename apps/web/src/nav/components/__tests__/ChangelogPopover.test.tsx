import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeBlogIndexPost, mockFetchBlogIndex } from "@tests/blogIndex";
import { createFakeAccount } from "@tests/fake/account";
import { mockMarkChangelogSeen } from "@tests/server-fn/changelog";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import ChangelogPopover from "../ChangelogPopover";

const watermark = new Date("2026-11-01T00:00:00.000Z");
const before = new Date("2026-10-01T00:00:00.000Z");
const after = new Date("2026-11-05T00:00:00.000Z");

function mockAccount(lastSeenChangelogAt: Date = watermark) {
	return mockGetAccount(createFakeAccount({ lastSeenChangelogAt }));
}

describe("<ChangelogPopover />", () => {
	it("shows the indicator when a post is dated after the watermark", async () => {
		mockAccount();
		mockFetchBlogIndex([createFakeBlogIndexPost({ date: after })]);

		await renderWithRouter(<ChangelogPopover />);

		expect(
			await screen.findByRole("button", { name: "What's new (unread)" }),
		).toBeInTheDocument();
	});

	it("shows the tip in sentence case and names the button from its label", async () => {
		mockAccount();
		mockFetchBlogIndex([createFakeBlogIndexPost({ date: after })]);

		await renderWithRouter(<ChangelogPopover />);
		const button = await screen.findByRole("button", {
			name: "What's new (unread)",
		});
		await userEvent.hover(button);

		const tooltip = await screen.findByRole("tooltip");

		expect(tooltip).toHaveTextContent(/^What's new$/);
		expect(tooltip).not.toHaveClass("capitalize");
		expect(button).toHaveAttribute("aria-label", "What's new (unread)");
		expect(button).toHaveAccessibleName("What's new (unread)");
	});

	it("shows no indicator when every post is dated at or before the watermark", async () => {
		mockAccount();
		mockFetchBlogIndex([
			createFakeBlogIndexPost({ date: watermark, title: "Time format" }),
			createFakeBlogIndexPost({ date: before }),
		]);

		await renderWithRouter(<ChangelogPopover />);
		await userEvent.click(screen.getByRole("button", { name: "What's new" }));

		expect(
			await screen.findByRole("link", { name: "Time format" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "What's new (unread)" }),
		).not.toBeInTheDocument();
	});

	it("lists posts with their image, version, date, and links", async () => {
		mockAccount();
		mockFetchBlogIndex([
			createFakeBlogIndexPost({
				date: new Date("2026-11-10T00:00:00.000Z"),
				image: {
					alt: "The time on hover",
					url: "https://www.virtool.ca/_astro/tooltip.png",
				},
				slug: "time-format",
				summary: "Show the exact time.",
				title: "Time format",
				version: "0.0.1",
			}),
		]);

		await renderWithRouter(<ChangelogPopover />);
		await userEvent.click(
			await screen.findByRole("button", { name: "What's new (unread)" }),
		);

		expect(screen.getByRole("link", { name: "Time format" })).toHaveAttribute(
			"href",
			"https://www.virtool.ca/blog/time-format",
		);
		expect(
			screen.getByRole("img", { name: "The time on hover" }),
		).toHaveAttribute("src", "https://www.virtool.ca/_astro/tooltip.png");
		expect(screen.getByText("Show the exact time.")).toBeInTheDocument();
		expect(screen.getByText("0.0.1 · Nov 10, 2026")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Full change history" }),
		).toHaveAttribute("href", "https://www.virtool.ca/changelog");
	});

	it("leaves out posts from later or unreadable versions", async () => {
		mockAccount();
		mockFetchBlogIndex([
			createFakeBlogIndexPost({ title: "Later", version: "999.0.0" }),
			createFakeBlogIndexPost({ title: "Unreadable", version: "next" }),
			createFakeBlogIndexPost({ date: before, title: "Earlier" }),
		]);

		await renderWithRouter(<ChangelogPopover />);
		await userEvent.click(screen.getByRole("button", { name: "What's new" }));

		expect(
			await screen.findByRole("link", { name: "Earlier" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Later" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Unreadable" }),
		).not.toBeInTheDocument();
	});

	it("clears the indicator and sends the newest shown date when opened", async () => {
		mockAccount();
		mockFetchBlogIndex([
			createFakeBlogIndexPost({ date: before }),
			createFakeBlogIndexPost({ date: after }),
		]);
		const markSeen = mockMarkChangelogSeen();

		await renderWithRouter(<ChangelogPopover />);
		const button = await screen.findByRole("button", {
			name: "What's new (unread)",
		});
		mockAccount(after);
		await userEvent.click(button);

		expect(markSeen).toHaveBeenCalledWith({ data: { newestPostDate: after } });
		expect(
			await screen.findByRole("button", { name: "What's new" }),
		).toBeInTheDocument();
	});

	it("refetches the account after marking succeeds", async () => {
		const getAccount = mockAccount();
		mockFetchBlogIndex([createFakeBlogIndexPost({ date: after })]);
		mockMarkChangelogSeen();

		await renderWithRouter(<ChangelogPopover />);
		const button = await screen.findByRole("button", {
			name: "What's new (unread)",
		});
		const calls = getAccount.mock.calls.length;
		mockAccount(after);
		await userEvent.click(button);

		await vi.waitFor(() =>
			expect(getAccount.mock.calls.length).toBeGreaterThan(calls),
		);
		expect(
			await screen.findByRole("button", { name: "What's new" }),
		).toBeInTheDocument();
	});

	it("shows the indicator again when marking fails", async () => {
		mockAccount();
		mockFetchBlogIndex([createFakeBlogIndexPost({ date: after })]);
		const markSeen = mockMarkChangelogSeen().mockRejectedValue(
			new Error("Failed"),
		);

		await renderWithRouter(<ChangelogPopover />);
		await userEvent.click(
			await screen.findByRole("button", { name: "What's new (unread)" }),
		);

		expect(markSeen).toHaveBeenCalled();
		await vi.waitFor(() =>
			expect(
				screen.getByRole("button", { name: "What's new (unread)" }),
			).toBeInTheDocument(),
		);
	});

	it("does not mark the posts seen when none is unread", async () => {
		mockAccount(after);
		mockFetchBlogIndex([createFakeBlogIndexPost({ date: after, title: "A" })]);
		const markSeen = mockMarkChangelogSeen();

		await renderWithRouter(<ChangelogPopover />);
		await userEvent.click(screen.getByRole("button", { name: "What's new" }));

		expect(await screen.findByRole("link", { name: "A" })).toBeInTheDocument();
		expect(markSeen).not.toHaveBeenCalled();
	});

	it("shows no posts and no indicator when the index fails to load", async () => {
		mockAccount();
		const fetchIndex = mockFetchBlogIndex([]).mockRejectedValue(
			new Error("Invalid index"),
		);

		await renderWithRouter(<ChangelogPopover />);
		await vi.waitFor(() => expect(fetchIndex).toHaveBeenCalled());
		await userEvent.click(screen.getByRole("button", { name: "What's new" }));

		expect(
			await screen.findByText("There are no posts for this version."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Full change history" }),
		).toBeInTheDocument();
	});
});
