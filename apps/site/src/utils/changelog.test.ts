import type { Release } from "@virtool/changelog";
import { describe, expect, it } from "vitest";
import {
  getReleaseHref,
  getReleaseSections,
  isMaintenanceOnly,
  splitPullRequestLinks,
} from "./changelog";

describe("getReleaseHref", () => {
  it("links a release to its version page", () => {
    expect(getReleaseHref("2.0.0")).toBe("/changelog/2.0.0");
  });
});

describe("isMaintenanceOnly", () => {
  const release: Release = {
    version: "1.0.0",
    date: "2026-11-04",
    body: "",
    maintenance: "### Maintenance",
    actions: [],
    pullRequests: [],
  };

  it("should be true when a release has only maintenance content", () => {
    expect(isMaintenanceOnly(release)).toBe(true);
  });

  it("should be false when a release has other content", () => {
    expect(isMaintenanceOnly({ ...release, body: "### Fixes" })).toBe(false);
    expect(isMaintenanceOnly({ ...release, actions: ["Act"] })).toBe(false);
  });

  it("should be false when a release has no maintenance content", () => {
    expect(isMaintenanceOnly({ ...release, maintenance: "" })).toBe(false);
  });
});

describe("getReleaseSections", () => {
  function release(version: string): Release {
    return {
      version,
      date: "2026-11-04",
      body: "",
      maintenance: "",
      actions: [],
      pullRequests: [],
    };
  }

  it("groups releases by minor version and keeps their order", () => {
    expect(
      getReleaseSections([
        release("2.1.1"),
        release("2.1.0"),
        release("2.0.0"),
      ]),
    ).toEqual([
      {
        title: "2.1",
        items: [
          { title: "2.1.1", slug: "/changelog/2.1.1", maintenance: false },
          { title: "2.1.0", slug: "/changelog/2.1.0", maintenance: false },
        ],
      },
      {
        title: "2.0",
        items: [{ title: "2.0.0", slug: "/changelog/2.0.0", maintenance: false }],
      },
    ]);
  });
});

describe("splitPullRequestLinks", () => {
  function anchor(number: number) {
    return `<a href="https://github.com/virtool/virtool/pull/${number}">#${number}</a>`;
  }

  it("should separate each pull request link from the markup", () => {
    expect(
      splitPullRequestLinks(
        `<h4>Encrypt links (${anchor(1)})</h4>\n<ul>\n<li>Fix it (${anchor(2)})</li>\n</ul>`,
      ),
    ).toEqual(["<h4>Encrypt links", 1, "</h4>\n<ul>\n<li>Fix it", 2, "</li>\n</ul>"]);
  });

  it("should keep other links in the markup", () => {
    const html = `<p>See <a href="https://www.virtool.ca">#1</a> and (<a href="https://example.com">#2</a>)</p>`;

    expect(splitPullRequestLinks(html)).toEqual([html]);
  });
});
