/** A `virtool` release, as the changelog records it. */
export type Release = {
  version: string;
  date: string;
  body: string;
  pullRequests: number[];
};

type Line = { text: string; fenced: boolean };

export const RELEASES_PER_PAGE = 10;

const RELEASE_HEADING = /^## (\S+) \((\d{4}-\d{2}-\d{2})\)$/;
const ENTRY_HEADING = /^(#{3,}) /;
const DEPENDENCY_HEADING = /^#### Update (.+ )?dependencies\b/;
const DEPENDENCY_BULLET = /^- (Bump `|Update the `.+` digest)/;
const FENCE = /^(```|~~~)/;
const PULL_REQUEST = /\[#(\d+)\]/g;

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

// A heading waits in `pending` until content follows it, so a section that
// held only dependency entries leaves no empty heading behind.
function getBody(lines: Line[]): string {
  const kept: string[] = [];
  const pending: { level: number; text: string }[] = [];
  let skipping = false;

  for (const { text, fenced } of lines) {
    const heading = fenced ? null : text.match(ENTRY_HEADING);

    if (heading) {
      const level = heading[1].length;

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
      if (pending.length === 0) {
        kept.push(text);
      }

      continue;
    }

    kept.push(...pending.splice(0).flatMap((entry) => [entry.text, ""]), text);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

  return sections.map(({ version, date, lines }) => ({
    version,
    date,
    body: getBody(lines),
    pullRequests: lines.flatMap(({ text }) =>
      [...text.matchAll(PULL_REQUEST)].map((match) => Number(match[1])),
    ),
  }));
}

export function getReleaseHref(version: string, index: number): string {
  const page = Math.floor(index / RELEASES_PER_PAGE) + 1;
  const path = page === 1 ? "/changelog" : `/changelog/${page}`;

  return `${path}#${version}`;
}
