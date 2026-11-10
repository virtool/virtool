import type { Release } from "@utils/changelog";

/** The frontmatter of a post about a release, which names its pull request. */
export type ReleasePostFrontmatter = {
  type: "release";
  title: string;
  summary: string;
  pr: number;
};

/** The frontmatter of a research post, which has no release. */
export type ResearchPostFrontmatter = {
  type: "research";
  title: string;
  summary: string;
  date: string;
};

/** The frontmatter that an author writes for a post. */
export type PostFrontmatter = ReleasePostFrontmatter | ResearchPostFrontmatter;

/** A post with the slug that its URL uses. */
export type Post = PostFrontmatter & { slug: string };

/** A release post with the version and date of the release that shipped it. */
export type ReleasedPost = ReleasePostFrontmatter & {
  slug: string;
  version: string;
  date: string;
};

/** A release post that no release contains yet. */
export type UnreleasedPost = ReleasePostFrontmatter & { slug: string };

/** A post that the site shows. */
export type PublishedPost =
  | ReleasedPost
  | (ResearchPostFrontmatter & { slug: string });

// The changelog lists the newest release first, so the last match is the
// release that first shipped the pull request.
function findRelease(pr: number, releases: Release[]): Release | undefined {
  return releases.findLast(({ pullRequests }) => pullRequests.includes(pr));
}

function compareNewestFirst(a: { date: string }, b: { date: string }): number {
  return b.date.localeCompare(a.date);
}

export function getReleasedPosts(
  posts: Post[],
  releases: Release[],
): ReleasedPost[] {
  return posts
    .flatMap((post) => {
      if (post.type !== "release") {
        return [];
      }

      const release = findRelease(post.pr, releases);

      return release
        ? [{ ...post, version: release.version, date: release.date }]
        : [];
    })
    .sort(compareNewestFirst);
}

export function getHiddenPosts(
  posts: Post[],
  releases: Release[],
): UnreleasedPost[] {
  return posts.flatMap((post) =>
    post.type === "release" && !findRelease(post.pr, releases) ? [post] : [],
  );
}

export function getPublishedPosts(
  posts: Post[],
  releases: Release[],
): PublishedPost[] {
  const research = posts.flatMap((post) =>
    post.type === "research" ? [post] : [],
  );

  return [...getReleasedPosts(posts, releases), ...research].sort(
    compareNewestFirst,
  );
}
