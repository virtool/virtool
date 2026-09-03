import { parseServerConfig, type ServerConfig } from "./configSchema";

/**
 * The configuration this process runs on.
 *
 * `startup.ts` has already parsed the same environment before the listener
 * bound, so anything importing this reads values that are known good. It parses
 * a second time rather than sharing that result: the startup plugin is bundled
 * into the Nitro entry and this module into the lazily loaded SSR chunk, which
 * are separate module graphs in the same process.
 */
export const config: ServerConfig = parseServerConfig();
