import { describe, expect, it } from "vitest";
import {
  getReleaseHref,
  getReleaseSections,
  isMaintenanceOnly,
  type Release,
  parseChangelog,
  splitPullRequestLinks,
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
    expect(latest.maintenance).toBe("");
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

  it("should separate the maintenance section and keep what follows", () => {
    const [{ body, maintenance }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Maintenance

- Prepare the schema ${link(1)}

#### Move the build ${link(2)}

The build now runs in Docker.

### Features

- Add a sample filter ${link(3)}
`);

    expect(body).toBe(`### Features\n\n- Add a sample filter ${link(3)}`);
    expect(maintenance).toBe(
      `### Maintenance\n\n- Prepare the schema ${link(1)}\n\n#### Move the build ${link(2)}\n\nThe build now runs in Docker.`,
    );
  });

  it("should keep pull requests from the maintenance section", () => {
    const [{ pullRequests }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Maintenance

- Prepare the schema ${link(1)}
`);

    expect(pullRequests).toEqual([1]);
  });

  it("should move action paragraphs out of their entries", () => {
    const [{ actions, body }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Fixes

#### Send recovery links ${link(1)}

Administrators can send a link.

**Action required:** Send each user a
recovery link.

Users get a notice.

#### Change the port ${link(2)}

**Action required:** Update your proxy.
`);

    expect(actions).toEqual([
      "Send each user a recovery link.",
      "Update your proxy.",
    ]);
    expect(body).toBe(
      `### Fixes\n\n#### Send recovery links ${link(1)}\n\nAdministrators can send a link.\n\nUsers get a notice.\n\n#### Change the port ${link(2)}`,
    );
  });

  it("should return no actions for a release with none", () => {
    const [{ actions }] = parseChangelog(changelog);

    expect(actions).toEqual([]);
  });

  it("should leave an action marker in a code fence", () => {
    const fence = "```md\n**Action required:** Example.\n```";

    const [{ actions, body }] = parseChangelog(`## 1.0.0 (2026-11-02)

### Fixes

#### Show an example ${link(1)}

${fence}
`);

    expect(actions).toEqual([]);
    expect(body).toContain(fence);
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
