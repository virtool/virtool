import { describe, expect, it } from "vitest";
import {
  getReleaseHref,
  parseChangelog,
  RELEASES_PER_PAGE,
} from "./changelog";

function link(number: number) {
  return `([#${number}](https://github.com/virtool/virtool/pull/${number}))`;
}

const changelog = `## 2.0.0 (2026-11-04)

### Fixes

- Fix the sample list ${link(10)}
- Bump \`zod\` from 3.0.0 to 4.0.0. ${link(11)}
- Update the \`node\` digest ${link(12)}

#### Return to the correct page ${link(13)}

Virtool now takes you to that page.

- It keeps the filters.

#### Update auth dependencies ${link(14)}

- Bump \`better-auth\` from 1.7.12 to 1.7.15.

#### Update dependencies ${link(15)}

- Bump \`pino\` from 10.1.0 to 10.4.0.

### Maintenance

- Bump \`execa\` from 10.2.0 to 10.2.1. ${link(16)}

## 1.0.0 (2026-11-02)

### Fixes

- Bump \`react-day-picker\` from 10.0.1 to 10.0.2. ${link(20)}
`;

describe("parseChangelog", () => {
  it("should return releases in file order with version and date", () => {
    const releases = parseChangelog(changelog);

    expect(releases.map(({ version, date }) => ({ version, date }))).toEqual([
      { version: "2.0.0", date: "2026-11-04" },
      { version: "1.0.0", date: "2026-11-02" },
    ]);
  });

  it("should return no releases for text with no release heading", () => {
    expect(parseChangelog("# Changelog\n\nNothing yet.\n")).toEqual([]);
  });

  it("should keep bullet entries and remove dependency bullets", () => {
    const [{ body }] = parseChangelog(changelog);

    expect(body).toContain(`- Fix the sample list ${link(10)}`);
    expect(body).not.toContain("zod");
    expect(body).not.toContain("digest");
  });

  it("should keep heading entries with their details", () => {
    const [{ body }] = parseChangelog(changelog);

    expect(body).toContain(
      `#### Return to the correct page ${link(13)}\n\nVirtool now takes you to that page.\n\n- It keeps the filters.`,
    );
  });

  it("should remove dependency sections", () => {
    const [{ body }] = parseChangelog(changelog);

    expect(body).not.toContain("dependencies");
    expect(body).not.toContain("better-auth");
    expect(body).not.toContain("pino");
  });

  it("should remove a heading that has only dependency entries", () => {
    const [latest, previous] = parseChangelog(changelog);

    expect(latest.body).not.toContain("### Maintenance");
    expect(previous.body).toBe("");
  });

  it("should keep a section heading when another entry remains", () => {
    const [{ body }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Fixes

- Fix the sample list ${link(1)}

#### Update dependencies ${link(2)}

- Bump \`zod\` from 3.0.0 to 4.0.0.
`);

    expect(body).toBe(`### Fixes\n\n- Fix the sample list ${link(1)}`);
  });

  it("should remove the maintenance section and keep what follows", () => {
    const [{ body }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Maintenance

- Prepare the schema ${link(1)}

#### Move the build ${link(2)}

The build now runs in Docker.

### Features

- Add a sample filter ${link(3)}
`);

    expect(body).toBe(`### Features\n\n- Add a sample filter ${link(3)}`);
  });

  it("should keep pull requests from the maintenance section", () => {
    const [{ pullRequests }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Maintenance

- Prepare the schema ${link(1)}
`);

    expect(pullRequests).toEqual([1]);
  });

  it("should collect each pull request before it removes entries", () => {
    const [latest, previous] = parseChangelog(changelog);

    expect(latest.pullRequests).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(previous.pullRequests).toEqual([20]);
  });

  it("should leave headings and bullets in a code fence", () => {
    const fence = [
      "```md",
      "## 9.9.9 (2026-01-01)",
      "#### Update dependencies",
      "- Bump `zod` from 3.0.0 to 4.0.0.",
      "```",
    ].join("\n");

    const releases = parseChangelog(`## 1.0.0 (2026-11-02)

### Fixes

#### Show an example ${link(1)}

${fence}
`);

    expect(releases).toHaveLength(1);
    expect(releases[0].body).toContain(fence);
  });
});

describe("getReleaseHref", () => {
  it("links a release on the first page to the base path", () => {
    expect(getReleaseHref("2.0.0", 0)).toBe("/changelog#2.0.0");
    expect(getReleaseHref("1.0.0", RELEASES_PER_PAGE - 1)).toBe(
      "/changelog#1.0.0",
    );
  });

  it("links a later release to its numbered page", () => {
    expect(getReleaseHref("1.0.0", RELEASES_PER_PAGE)).toBe(
      "/changelog/2#1.0.0",
    );
    expect(getReleaseHref("0.9.0", RELEASES_PER_PAGE * 2)).toBe(
      "/changelog/3#0.9.0",
    );
  });
});
