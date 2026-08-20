/**
 * The name that Virtool gives to the third-party services it calls.
 *
 * NCBI limits or blocks requests that do not give a name. GitHub refuses a
 * request that has no `User-Agent` header. This repository has no shared HTTP
 * client, because each caller sets its own timeout. So each caller sends this
 * constant as its `User-Agent` header.
 *
 * The name has no version number. Only an application knows its own version.
 * A shared package cannot read one, and a name that all callers agree on is
 * more useful than a version on some of them. NCBI and GitHub ask only for a
 * name.
 */
export const USER_AGENT = "virtool";
