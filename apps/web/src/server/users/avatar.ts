import { createHash, createHmac, randomBytes } from "node:crypto";
import { USER_AGENT } from "@virtool/contracts/userAgent";
import { getGravatarEmail } from "@virtool/data/users/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../composition";
import { textResponse } from "../http";
import { logger } from "../logger";

// Twice the largest icon, so the image stays sharp on high-density screens.
const GRAVATAR_SIZE = 120;

const GRAVATAR_TIMEOUT_MS = 5000;

// The browser asks again on each use and gets a 304 while the ETag matches, so a
// user who stops using Gravatar stops showing it at once.
const IMAGE_CACHE_CONTROL = "private, no-cache";

// Short, so a user who starts using Gravatar shows it soon.
const NOT_FOUND_CACHE_CONTROL = "private, max-age=60";

const DAY_MS = 24 * 60 * 60 * 1000;

function getGravatarHash(email: string): string {
	return createHash("sha256").update(email).digest("hex");
}

// Keyed, so the ETag does not give the browser a hash it can match against a
// list of addresses. A new key after a restart only costs one fetch per image.
const ETAG_KEY = randomBytes(32);

// Includes the day, so a changed Gravatar image reaches browsers within a day.
function getETag(hash: string): string {
	const day = Math.floor(Date.now() / DAY_MS);
	const tag = createHmac("sha256", ETAG_KEY)
		.update(`${hash}:${day}`)
		.digest("base64url")
		.slice(0, 22);
	return `"${tag}"`;
}

/**
 * Serve the avatar of the user with `handle`, backing `GET /avatars/{handle}`.
 *
 * The image is proxied rather than linked, so the browser never receives the
 * email hash and Gravatar never sees the viewer's address. A 404 tells the
 * client to show the user's initials instead.
 */
export async function handleAvatar(
	request: Request,
	handle: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const email = await getGravatarEmail(db, handle);

	if (email === null) {
		return notFound();
	}

	const hash = getGravatarHash(email);
	const etag = getETag(hash);

	if (request.headers.get("if-none-match") === etag) {
		return new Response(null, {
			status: 304,
			headers: { "cache-control": IMAGE_CACHE_CONTROL, etag },
		});
	}

	let upstream: Response;

	try {
		upstream = await fetch(
			`https://gravatar.com/avatar/${hash}?s=${GRAVATAR_SIZE}&d=identicon`,
			{
				headers: { "user-agent": USER_AGENT },
				signal: AbortSignal.timeout(GRAVATAR_TIMEOUT_MS),
			},
		);
	} catch (err) {
		logger.warn({ err }, "gravatar request failed");
		return textResponse("Bad gateway", 502);
	}

	const contentType = upstream.headers.get("content-type");

	if (!upstream.ok || !contentType?.startsWith("image/")) {
		logger.warn({ status: upstream.status }, "gravatar request failed");
		return textResponse("Bad gateway", 502);
	}

	return new Response(upstream.body, {
		headers: {
			"cache-control": IMAGE_CACHE_CONTROL,
			"content-type": contentType,
			etag,
			"x-content-type-options": "nosniff",
		},
	});
}

// Cached briefly, so a page full of users without an image does not ask again
// on every render.
function notFound(): Response {
	return new Response("Not found", {
		status: 404,
		headers: { "cache-control": NOT_FOUND_CACHE_CONTROL },
	});
}
