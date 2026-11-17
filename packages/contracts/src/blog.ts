// A subpath, not the root entry, holds these schemas: module-level zod schemas
// are not tree-shaken, and the workflow apps bundle the root entry.

import { z } from "zod";
import { Timestamp } from "./timestamps";

/** The origin of the Virtool website. */
export const SITE_ORIGIN = "https://www.virtool.ca";

/** The URL of the website's index of released blog posts. */
export const BLOG_INDEX_URL = `${SITE_ORIGIN}/blog/index.json`;

/**
 * A released post in the website's blog index.
 *
 * `date` is the release date at UTC midnight, and `version` is the `virtool`
 * release that first shipped the post's change. `image.url` is absolute.
 */
export const blogIndexPostSchema = z.object({
	slug: z.string().min(1),
	version: z.string(),
	date: Timestamp,
	title: z.string(),
	summary: z.string(),
	image: z.object({
		url: z.url({ protocol: /^https?$/ }),
		alt: z.string(),
	}),
});

/** A released post in the website's blog index. */
export type BlogIndexPost = z.infer<typeof blogIndexPostSchema>;

/**
 * The website's index of released blog posts, newest first.
 *
 * The website publishes it and the web app reads it, so each side can run a
 * different release. Add fields only as optional ones.
 */
export const blogIndexSchema = z.object({
	posts: z.array(blogIndexPostSchema),
});

/** The website's index of released blog posts, newest first. */
export type BlogIndex = z.infer<typeof blogIndexSchema>;
