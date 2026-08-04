import { createServerFn } from "@tanstack/react-start";
import { getUserCount } from "@virtool/data/users/data";
import { open } from "../auth/policy";
import { db } from "../composition";

// Public, like Python's `GET /`: the `_authenticated` guard reads `firstUser`
// before any session exists to decide whether to redirect to first-user setup,
// so this cannot require a session. `version` is the running deployment's build
// version, injected by Vite's `define` (see appVersion.d.ts).
export const getRootFn = createServerFn({ method: "GET" })
	.middleware([open()])
	.handler(async () => ({
		firstUser: (await getUserCount(db)) === 0,
		version: __APP_VERSION__,
	}));
