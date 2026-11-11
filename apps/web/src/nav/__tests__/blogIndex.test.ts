import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@nav/blogIndex");

const { fetchBlogIndex } = await import("@nav/blogIndex");

const post = {
	date: "2026-11-10T00:00:00.000Z",
	image: { alt: "A tooltip", url: "https://www.virtool.ca/_astro/a.png" },
	slug: "time-format",
	summary: "Show the exact time.",
	title: "Time format",
	version: "42.65.0",
};

function stubFetch(response: Response) {
	const fetch = vi.fn().mockResolvedValue(response);
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchBlogIndex", () => {
	it("fetches the index from the website and reads dates", async () => {
		const fetch = stubFetch(Response.json({ posts: [post] }));

		expect(await fetchBlogIndex()).toEqual({
			posts: [{ ...post, date: new Date("2026-11-10T00:00:00.000Z") }],
		});
		expect(fetch).toHaveBeenCalledWith(
			"https://www.virtool.ca/blog/index.json",
		);
	});

	it("rejects an index that does not match the schema", async () => {
		stubFetch(
			Response.json({
				posts: [
					{ ...post, image: { ...post.image, url: "javascript:alert(1)" } },
				],
			}),
		);

		await expect(fetchBlogIndex()).rejects.toThrow();
	});

	it("rejects a failed request", async () => {
		stubFetch(new Response(null, { status: 503 }));

		await expect(fetchBlogIndex()).rejects.toThrow(
			"The blog index request failed with 503",
		);
	});
});
