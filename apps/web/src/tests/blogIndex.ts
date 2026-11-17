import { faker } from "@faker-js/faker";
import type { BlogIndexPost } from "@virtool/contracts/blog";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@nav/blogIndex` module, which fetches from the website.
 * Wired in globally from `tests/setup.tsx` because every authenticated page
 * renders the nav, and an unmocked fetch would reach the real website.
 */
export const blogIndexMocks = {
	fetchBlogIndex: vi.fn(),
};

/** Sets up fetchBlogIndex to resolve with the given posts. */
export function mockFetchBlogIndex(posts: BlogIndexPost[]): Mock {
	blogIndexMocks.fetchBlogIndex.mockResolvedValue({ posts });
	return blogIndexMocks.fetchBlogIndex;
}

/** Create a fake post of the website's blog index. */
export function createFakeBlogIndexPost(
	overrides?: Partial<BlogIndexPost>,
): BlogIndexPost {
	return {
		date: new Date("2026-11-10T00:00:00.000Z"),
		image: {
			alt: faker.lorem.sentence(),
			url: "https://www.virtool.ca/_astro/image.png",
		},
		slug: faker.lorem.slug(),
		summary: faker.lorem.sentence(),
		title: faker.lorem.words(2),
		version: "1.0.0",
		...overrides,
	};
}
