import { Cache } from "./cache";

const RELEASE_KEYS = [
  "id",
  "name",
  "body",
  "prerelease",
  "published_at",
  "html_url",
];

export function filterReleases(releases: Array<object>): Array<object> {
  return releases.filter((release) => {
    return release["assets"]?.length > 0 && !release["draft"];
  });
}

export function formatRelease(release) {
  const formatted = Object.fromEntries(
    RELEASE_KEYS.filter((key) => key in release).map((key) => [
      key,
      release[key],
    ]),
  );

  try {
    const asset = release["assets"][0];

    return {
      ...formatted,
      asset_error: false,
      content_type: asset.content_type,
      download_url: asset.browser_download_url,
      filename: asset.name,
      size: asset.size,
    };
  } catch (error) {
    if (error instanceof TypeError) {
      return { ...formatted, asset_error: true };
    }

    throw error;
  }
}

async function fetchRepoReleases(repo: string): Promise<Array<object>> {
  let allReleases = [];
  let page = 1;

  const headers = new Headers();

  if (process.env.GITHUB_TOKEN) {
    headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  } else {
    console.warn(
      "GITHUB_TOKEN is not set; fetching releases unauthenticated (60 requests/hour/IP). Set it to avoid rate-limit build failures.",
    );
  }

  while (true) {
    const url = `https://api.github.com/repos/virtool/${repo}/releases?per_page=100&page=${page}`;

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch releases for ${repo} from GitHub (page ${page}): ${response.status} ${response.statusText}`,
      );
    }

    const releases = await response.json();

    if (releases.length == 0) {
      break;
    }

    allReleases.push(...releases);

    page++;
  }

  return allReleases;
}

export async function getRepoReleases(repo: string): Promise<Array<object>> {
  const cache = new Cache();
  await cache.load();

  const date = Date.now();

  const cached = await cache.get(repo);

  if (cached && date - cached.timestamp < 1000 * 60 * 60) {
    return cached.data;
  }

  const releases = filterReleases(await fetchRepoReleases(repo));

  const data = releases.map(formatRelease).filter(
    (release) => !release.asset_error,
  );

  await cache.set(repo, {
    data,
    timestamp: date,
  });

  return data;
}

export function getLatestLegacyVersion(releases) {
  const legacyReleases = releases.filter((release) => {
    return (
      !release.prerelease &&
      (release.name.startsWith("v4.") || release.name.startsWith("4."))
    );
  });

  const latestRelease = legacyReleases[0];

  return latestRelease.name.replace("v", "");
}
