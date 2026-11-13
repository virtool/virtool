import type { BlogIndexPost } from "@virtool/contracts/blog";

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): number[] | undefined {
	return version.match(VERSION)?.slice(1).map(Number);
}

function compareVersions(a: number[], b: number[]): number {
	for (const [index, part] of a.entries()) {
		const difference = part - (b[index] ?? 0);

		if (difference !== 0) {
			return difference;
		}
	}

	return 0;
}

/**
 * Get the posts that shipped in `version` or an earlier release.
 *
 * Releases are linear, so a lower version is an earlier release. A post whose
 * version is not a plain `major.minor.patch` is left out, and so is every post
 * if `version` is not one.
 */
export function getShownPosts(
	posts: BlogIndexPost[],
	version: string,
): BlogIndexPost[] {
	const current = parseVersion(version);

	if (!current) {
		return [];
	}

	return posts.filter((post) => {
		const parsed = parseVersion(post.version);

		return parsed !== undefined && compareVersions(parsed, current) <= 0;
	});
}

/** Get the date of the newest post, or `undefined` if there are no posts. */
export function getNewestPostDate(posts: BlogIndexPost[]): Date | undefined {
	return posts.reduce<Date | undefined>(
		(newest, { date }) => (newest && newest >= date ? newest : date),
		undefined,
	);
}

/** Whether a post is dated strictly after the watermark. */
export function hasUnreadPost(
	posts: BlogIndexPost[],
	lastSeenAt: Date,
): boolean {
	return posts.some(({ date }) => date > lastSeenAt);
}
