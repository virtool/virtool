import type { PublishedPost, UnreleasedPost } from "@virtool/changelog";

/** A group of posts in the blog sidebar, such as all posts of one year. */
export type PostSection = {
  title: string;
  posts: (PublishedPost | UnreleasedPost)[];
};

// Expects the posts newest first, as `loadPosts` lists them. A post with no
// date has no release yet, and only the dev server lists it.
export function getPostSections(
  posts: (PublishedPost | UnreleasedPost)[],
): PostSection[] {
  const sections: PostSection[] = [];

  for (const post of posts) {
    const title = "date" in post ? post.date.slice(0, 4) : "Unreleased";
    const section = sections.at(-1);

    if (section?.title === title) {
      section.posts.push(post);
    } else {
      sections.push({ title, posts: [post] });
    }
  }

  return sections;
}
