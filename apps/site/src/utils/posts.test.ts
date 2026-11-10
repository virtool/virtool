import { describe, expect, it } from "vitest";
import { getPostSections } from "./posts";

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

describe("getPostSections", () => {
  it("should group posts by year, newest first", () => {
    const posts = [
      research("recent", "2026-01-05"),
      research("late", "2025-12-30"),
      research("early", "2025-02-01"),
    ];

    expect(
      getPostSections(posts).map(({ title, posts }) => ({
        title,
        slugs: posts.map(({ slug }) => slug),
      })),
    ).toEqual([
      { title: "2026", slugs: ["recent"] },
      { title: "2025", slugs: ["late", "early"] },
    ]);
  });

  it("should put posts with no release in an Unreleased group", () => {
    const posts = [post("unreleased", 99), research("paper", "2026-11-03")];

    expect(getPostSections(posts).map(({ title }) => title)).toEqual([
      "Unreleased",
      "2026",
    ]);
  });
});
