/** A `virtool` release, as the changelog records it. */
export type Release = {
  version: string;
  date: string;
  body: string;
  maintenance: string;
  actions: string[];
  pullRequests: number[];
};

type Line = { text: string; fenced: boolean };

type ReleaseSection = {
  title: string;
  items: { title: string; slug: string; maintenance: boolean }[];
};

export const RELEASES_PER_PAGE = 10;

const RELEASE_HEADING = /^## (\S+) \((\d{4}-\d{2}-\d{2})\)$/;
const ENTRY_HEADING = /^(#{3,}) /;
const SECTION_HEADING = /^### /;
const DEPENDENCY_HEADING = /^#### Update (.+ )?dependencies\b/;
const MAINTENANCE_HEADING = /^### Maintenance$/;
const DEPENDENCY_BULLET = /^- (Bump `|Update the `.+` digest)/;
const FENCE = /^(```|~~~)/;
const PULL_REQUEST = /\[#(\d+)\]/g;
const PULL_REQUEST_LINK =
  /\s*\(<a href="https:\/\/github\.com\/virtool\/virtool\/pull\/\d+">#(\d+)<\/a>\)/;
const ACTION_MARKER = "**Action required:**";

function getLines(text: string): Line[] {
  let open = false;

  return text.split("\n").map((line) => {
    const isFence = FENCE.test(line);
    const fenced = open || isFence;

    if (isFence) {
      open = !open;
    }

    return { text: line, fenced };
  });
}

function splitMaintenance(lines: Line[]) {
  const main: Line[] = [];
  const maintenance: Line[] = [];
  let target = main;

  for (const line of lines) {
    if (!line.fenced && SECTION_HEADING.test(line.text)) {
      target = MAINTENANCE_HEADING.test(line.text) ? maintenance : main;
    }

    target.push(line);
  }

  return { main, maintenance };
}

// A heading waits in `pending` until content follows it, so a section that
// held only dependency entries leaves no empty heading behind.
function getContent(lines: Line[]): { body: string; actions: string[] } {
  const actions: string[][] = [];
  const kept: string[] = [];
  const pending: { level: number; text: string }[] = [];
  let inAction = false;
  let skipping = false;

  function flushHeadings() {
    kept.push(...pending.splice(0).flatMap((entry) => [entry.text, ""]));
  }

  for (const { text, fenced } of lines) {
    const heading = fenced ? null : text.match(ENTRY_HEADING);

    if (heading) {
      const level = heading[1].length;

      inAction = false;

      skipping = DEPENDENCY_HEADING.test(text);

      while (pending.length > 0 && (pending.at(-1)?.level ?? 0) >= level) {
        pending.pop();
      }

      if (!skipping) {
        pending.push({ level, text });
      }

      continue;
    }

    if (skipping || (!fenced && DEPENDENCY_BULLET.test(text))) {
      continue;
    }

    if (text === "" && !fenced) {
      inAction = false;

      if (pending.length === 0) {
        kept.push(text);
      }

      continue;
    }

    if (inAction) {
      actions.at(-1)?.push(text);
      continue;
    }

    flushHeadings();

    if (!fenced && text.startsWith(ACTION_MARKER)) {
      inAction = true;
      actions.push([text.slice(ACTION_MARKER.length).trim()]);
      continue;
    }

    kept.push(text);
  }

  return {
    actions: actions.map((action) => action.join(" ")),
    body: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

export function parseChangelog(text: string): Release[] {
  const sections: { version: string; date: string; lines: Line[] }[] = [];

  for (const line of getLines(text)) {
    const heading = line.fenced ? null : line.text.match(RELEASE_HEADING);

    if (heading) {
      sections.push({ version: heading[1], date: heading[2], lines: [] });
    } else {
      sections.at(-1)?.lines.push(line);
    }
  }

  return sections.map(({ version, date, lines }) => {
    const { main, maintenance } = splitMaintenance(lines);

    return {
      version,
      date,
      ...getContent(main),
      maintenance: getContent(maintenance).body,
      pullRequests: lines.flatMap(({ text }) =>
        [...text.matchAll(PULL_REQUEST)].map((match) => Number(match[1])),
      ),
    };
  });
}

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

export function getReleaseHref(version: string, index: number): string {
  const page = Math.floor(index / RELEASES_PER_PAGE) + 1;
  const path = page === 1 ? "/changelog" : `/changelog/${page}`;

  return `${path}#${version}`;
}

export function getReleaseSections(releases: Release[]): ReleaseSection[] {
  const sections: ReleaseSection[] = [];

  releases.forEach((release, index) => {
    const { version } = release;
    const title = version.split(".").slice(0, 2).join(".");
    const item = {
      title: version,
      slug: getReleaseHref(version, index),
      maintenance: isMaintenanceOnly(release),
    };
    const section = sections.at(-1);

    if (section?.title === title) {
      section.items.push(item);
    } else {
      sections.push({ title, items: [item] });
    }
  });

  return sections;
}
