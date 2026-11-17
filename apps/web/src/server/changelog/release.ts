/// <reference types="vite/client" />
import { parseChangelog } from "@virtool/changelog";
import changelog from "../../../CHANGELOG.md?raw";

/**
 * Get the release date of this build's version from its bundled changelog.
 *
 * A new user's changelog watermark starts here, not at the signup time. The
 * image holds only the posts of its own changelog, so the user gets no backlog,
 * but a post from a later deploy is still unread even if its release is
 * earlier than the signup.
 *
 * `knope prepare-release` writes the version and its heading in one commit, and
 * builds between releases carry the last released version, so every build
 * finds its heading.
 */
export function getReleaseDate(
	text: string = changelog,
	version: string = __APP_VERSION__,
): Date {
	const release = parseChangelog(text).find(
		(release) => release.version === version,
	);

	if (!release) {
		throw new Error(`The changelog has no release for version ${version}`);
	}

	return new Date(release.date);
}
