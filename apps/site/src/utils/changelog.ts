import type { Release } from "@virtool/changelog";

/** A minor version group of releases in the changelog sidebar. */
export type ReleaseSection = {
  title: string;
  items: { title: string; slug: string; maintenance: boolean }[];
};

const PULL_REQUEST_LINK =
  /\s*\(<a href="https:\/\/github\.com\/virtool\/virtool\/pull\/\d+">#(\d+)<\/a>\)/;

export function isMaintenanceOnly({ actions, body, maintenance }: Release) {
  return maintenance !== "" && body === "" && actions.length === 0;
}

// The parts can hold unbalanced tags, because a link usually sits inside a
// heading. This is safe only if the caller writes the parts out in sequence.
export function splitPullRequestLinks(html: string): (string | number)[] {
  return html
    .split(PULL_REQUEST_LINK)
    .map((part, index) => (index % 2 === 1 ? Number(part) : part));
}

export function getReleaseHref(version: string): string {
  return `/changelog/${version}`;
}

export function getReleaseSections(releases: Release[]): ReleaseSection[] {
  const sections: ReleaseSection[] = [];

  for (const release of releases) {
    const { version } = release;
    const title = version.split(".").slice(0, 2).join(".");
    const item = {
      title: version,
      slug: getReleaseHref(version),
      maintenance: isMaintenanceOnly(release),
    };
    const section = sections.at(-1);

    if (section?.title === title) {
      section.items.push(item);
    } else {
      sections.push({ title, items: [item] });
    }
  }

  return sections;
}
