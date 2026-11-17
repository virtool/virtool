import { createFakeBlogIndexPost } from "@tests/blogIndex";
import { describe, expect, it } from "vitest";
import { getNewestPostDate, getShownPosts, hasUnreadPost } from "../posts";

describe("getShownPosts", () => {
	const posts = ["1.9.0", "1.10.0", "2.0.0", "1.10.0-rc.1", "next"].map(
		(version) => createFakeBlogIndexPost({ slug: version, version }),
	);

	it("keeps posts up to and including the version", () => {
		expect(getShownPosts(posts, "1.10.0").map(({ slug }) => slug)).toEqual([
			"1.9.0",
			"1.10.0",
		]);
	});

	it("shows no posts when the version cannot be compared", () => {
		expect(getShownPosts(posts, "0.0.0-dev")).toEqual([]);
	});
});

describe("getNewestPostDate", () => {
	it("returns the newest date in any order", () => {
		const newest = new Date("2026-02-01T00:00:00.000Z");

		expect(
			getNewestPostDate([
				createFakeBlogIndexPost({ date: new Date("2026-01-01T00:00:00.000Z") }),
				createFakeBlogIndexPost({ date: newest }),
			]),
		).toEqual(newest);
	});

	it("returns undefined when there are no posts", () => {
		expect(getNewestPostDate([])).toBeUndefined();
	});
});

describe("hasUnreadPost", () => {
	const watermark = new Date("2026-01-01T00:00:00.000Z");

	it("is true only for a post dated strictly after the watermark", () => {
		expect(
			hasUnreadPost([createFakeBlogIndexPost({ date: watermark })], watermark),
		).toBe(false);
		expect(
			hasUnreadPost(
				[
					createFakeBlogIndexPost({
						date: new Date("2026-01-02T00:00:00.000Z"),
					}),
				],
				watermark,
			),
		).toBe(true);
	});
});
