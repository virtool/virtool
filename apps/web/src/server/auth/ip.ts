import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Best-effort client IP recorded on a restricted setup session. */
export const getClientIp: () => string = createServerOnlyFn((): string => {
	const request = getRequest();
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		""
	);
});
