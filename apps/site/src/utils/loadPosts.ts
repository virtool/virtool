import { parseChangelog } from "@utils/changelog";
import {
  getHiddenPosts,
  getPublishedPosts,
  getReleasedPosts,
} from "@utils/posts";
import { getCollection } from "astro:content";
import changelog from "../../../web/CHANGELOG.md?raw";

export async function loadPosts() {
  const entries = await getCollection("posts");
  const releases = parseChangelog(changelog);
  // The slug is the file name. The web app links to posts by slug, so a
  // published post must keep its file name.
  const posts = entries.map(({ id, data }) => ({ ...data, slug: id }));

  return {
    entries,
    hidden: getHiddenPosts(posts, releases),
    published: getPublishedPosts(posts, releases),
    released: getReleasedPosts(posts, releases),
    releases,
  };
}
