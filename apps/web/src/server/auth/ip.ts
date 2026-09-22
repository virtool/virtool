import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getClientIpFromHeaders } from "./sessionMetadata";

/** Best-effort client IP recorded on a restricted setup session. */
export const getClientIp: () => string = createServerOnlyFn((): string => {
	return getClientIpFromHeaders(getRequest().headers) ?? "";
});
