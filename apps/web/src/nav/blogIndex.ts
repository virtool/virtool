import {
	BLOG_INDEX_URL,
	type BlogIndex,
	blogIndexSchema,
} from "@virtool/contracts";

/**
 * Fetch the website's index of released blog posts.
 *
 * @throws if the request fails or the index does not match the schema
 */
export async function fetchBlogIndex(): Promise<BlogIndex> {
	const response = await fetch(BLOG_INDEX_URL);

	if (!response.ok) {
		throw new Error(`The blog index request failed with ${response.status}`);
	}

	return blogIndexSchema.parse(await response.json());
}
