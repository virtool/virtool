import {
	BLOG_INDEX_URL,
	type BlogIndex,
	type BlogIndexPost,
	blogIndexPostSchema,
} from "@virtool/contracts/blog";
import { z } from "zod";

// Each post is checked on its own, so one post that a newer site publishes in
// a shape this release can't read does not hide the others.
const blogIndexEnvelopeSchema = z.object({
	posts: z.array(z.unknown()),
});

/**
 * Fetch the website's index of released blog posts.
 *
 * Posts that do not match the schema are left out.
 *
 * @throws if the request fails or the index is not an object with a posts array
 */
export async function fetchBlogIndex(): Promise<BlogIndex> {
	const response = await fetch(BLOG_INDEX_URL);

	if (!response.ok) {
		throw new Error(`The blog index request failed with ${response.status}`);
	}

	const { posts } = blogIndexEnvelopeSchema.parse(await response.json());

	return {
		posts: posts.flatMap((post): BlogIndexPost[] => {
			const result = blogIndexPostSchema.safeParse(post);
			return result.success ? [result.data] : [];
		}),
	};
}
