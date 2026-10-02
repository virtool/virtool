export const CONFIG_VERSION = 1;
export const PROTOCOL_VERSION = 1;
export const MANAGEMENT_ORIGIN = "https://dev.localhost:9443";
export const WORKFLOWS = [
	"create_sample",
	"create_subtraction",
	"nuvs",
	"pathoscope",
] as const;

/** The Compose service that runs `@virtool/dev-tools` commands. */
export const DEV_TOOLS_SERVICE = "dev-tools";

/** The variable that carries the default administrator password to `dev-tools`. */
export const ADMINISTRATOR_PASSWORD_ENV = "VT_ADMINISTRATOR_PASSWORD";
