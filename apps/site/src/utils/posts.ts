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

/** The first image in a post's MDX body. */
export type PostImage = { alt: string; src: string };

const IMAGE = /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/;

/** Get the first Markdown image in a post's MDX body. */
export function getFirstImage(body: string): PostImage | undefined {
  const match = body.match(IMAGE);

  if (!match) {
    return undefined;
  }

  const [, alt = "", src = ""] = match;

  return { alt, src };
}

/**
 * Get the path of an image that a post links to, from the path of the post
 * file. Both paths are relative to the site root, and the result starts with
 * `/` as `import.meta.glob` keys do.
 */
export function getImagePath(postPath: string, src: string): string {
  const directory = postPath.slice(0, postPath.lastIndexOf("/") + 1);

  return new URL(src.split("?")[0] ?? "", `file:///${directory}`).pathname;
}
