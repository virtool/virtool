import { describe, expect, it } from "vitest";
import type { Release } from "./changelog";
import { getHiddenPosts, getPublishedPosts, getReleasedPosts } from "./posts";

function release(
  version: string,
  date: string,
  pullRequests: number[],
): Release {
  return { version, date, body: "", actions: [], pullRequests };
}

function post(slug: string, pr: number) {
  return {
    slug,
    pr,
    type: "release" as const,
    title: `Title of ${slug}`,
    summary: `About ${slug}`,
  };
}

function research(slug: string, date: string) {
  return {
    slug,
    date,
    type: "research" as const,
    title: `Title of ${slug}`,
    summary: `About ${slug}`,
  };
}

const releases = [
  release("2.0.0", "2026-11-04", [30, 31]),
  release("1.0.0", "2026-11-02", [20, 31]),
];

describe("getReleasedPosts", () => {
  it("should add the version and date of the matching release", () => {
    expect(getReleasedPosts([post("first", 20)], releases)).toEqual([
      { ...post("first", 20), version: "1.0.0", date: "2026-11-02" },
    ]);
  });

  it("should leave out a post with no matching release", () => {
    expect(getReleasedPosts([post("unreleased", 99)], releases)).toEqual([]);
  });

  it("should leave out a research post", () => {
    const posts = [research("paper", "2026-11-03")];

    expect(getReleasedPosts(posts, releases)).toEqual([]);
  });

  it("should return the newest post first", () => {
    const posts = [post("older", 20), post("newer", 30)];

    expect(getReleasedPosts(posts, releases).map(({ slug }) => slug)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("should use the first release that shipped the pull request", () => {
    const [{ version }] = getReleasedPosts([post("repeated", 31)], releases);

    expect(version).toBe("1.0.0");
  });
});

describe("getHiddenPosts", () => {
  it("should return only release posts with no matching release", () => {
    const posts = [
      post("released", 20),
      post("unreleased", 99),
      research("paper", "2026-11-03"),
    ];

    expect(getHiddenPosts(posts, releases)).toEqual([post("unreleased", 99)]);
  });
});

describe("getPublishedPosts", () => {
  it("should merge released and research posts, newest first", () => {
    const posts = [
      post("older", 20),
      post("unreleased", 99),
      post("newer", 30),
      research("paper", "2026-11-03"),
    ];

    expect(getPublishedPosts(posts, releases).map(({ slug }) => slug)).toEqual([
      "newer",
      "paper",
      "older",
    ]);
  });
});
